import type { DailyAction, GameConfig, GameState, StoryEvent } from './gameCore/types'

type GenerateActionStoryParams = {
  action: DailyAction
  config: GameConfig
  state: GameState
  triggeredEvents: StoryEvent[]
  previousLines?: string[]
  signal?: AbortSignal
}

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>
    }
  }>
}

type ResponsesApiResponse = {
  output_text?: string
  output?: Array<{
    content?: Array<{
      text?: string
      type?: string
    }>
  }>
}

export function canUseAiStory(config: GameConfig) {
  return Boolean(config.ai.enabled && config.ai.apiBaseUrl.trim() && config.ai.apiKey.trim() && config.ai.model.trim())
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

function sanitizeLines(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
}

function extractJsonCandidates(raw: string) {
  const candidates = [raw.trim()]
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) candidates.unshift(fencedMatch[1].trim())

  const firstObject = raw.indexOf('{')
  const lastObject = raw.lastIndexOf('}')
  if (firstObject >= 0 && lastObject > firstObject) candidates.push(raw.slice(firstObject, lastObject + 1))

  const firstArray = raw.indexOf('[')
  const lastArray = raw.lastIndexOf(']')
  if (firstArray >= 0 && lastArray > firstArray) candidates.push(raw.slice(firstArray, lastArray + 1))

  return Array.from(new Set(candidates.filter(Boolean)))
}

function parseLinesFromText(raw: string) {
  for (const candidate of extractJsonCandidates(raw)) {
    try {
      const parsed = JSON.parse(candidate) as { lines?: string[] } | string[]
      if (Array.isArray(parsed)) {
        const lines = sanitizeLines(parsed.filter((line): line is string => typeof line === 'string'))
        if (lines.length > 0) return lines
      }
      if (!Array.isArray(parsed) && parsed && typeof parsed === 'object' && Array.isArray(parsed.lines)) {
        const lines = sanitizeLines(parsed.lines.filter((line: unknown): line is string => typeof line === 'string'))
        if (lines.length > 0) return lines
      }
    } catch {
      continue
    }
  }

  return sanitizeLines(raw.split(/\r?\n+/))
}

function extractChatContent(payload: ChatCompletionsResponse) {
  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((part) => part.text || '').join('\n')
  return ''
}

function extractResponsesContent(payload: ResponsesApiResponse) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((part) => part.text || '')
    .join('\n')
}

function buildResponsesReasoning(config: GameConfig) {
  return config.ai.reasoningEffort === 'default' ? undefined : { effort: config.ai.reasoningEffort }
}

function buildChatReasoningEffort(config: GameConfig) {
  return config.ai.reasoningEffort === 'default' ? undefined : config.ai.reasoningEffort
}

function shouldSendTemperature(config: GameConfig) {
  const model = config.ai.model.trim().toLowerCase()
  if (config.ai.apiMode === 'responses') return false
  if (model.startsWith('gpt-5')) return config.ai.reasoningEffort === 'none'
  return true
}

async function parseErrorMessage(response: Response) {
  const text = await response.text()
  if (!text) return `Request failed (${response.status})`

  try {
    const payload = JSON.parse(text) as { error?: { message?: string } }
    return payload.error?.message || text
  } catch {
    return text
  }
}

function buildSystemPrompt(config: GameConfig) {
  return [
    'You are the scenario writer for a daily raising visual novel.',
    'Write the next single micro-scene beat that happens right after the player action.',
    'Write in Simplified Chinese.',
    'Return JSON only, using the exact shape {"lines":["line 1"]}.',
    'Return exactly 1 line.',
    'That line should be 1 to 2 sentences and suitable for one-step reveal.',
    'Continue naturally from the already generated lines if any are provided.',
    'Keep the tone grounded, intimate, and slightly unpredictable, but do not jump too far ahead in the plot.',
    'Do not use Markdown. Do not explain your answer. Do not include any fields other than lines.',
    config.ai.promptNotes.trim(),
  ].join('\n')
}

function buildUserPrompt(params: GenerateActionStoryParams) {
  const { action, config, state, triggeredEvents, previousLines = [] } = params
  const currentScene = config.scenes.find((scene) => scene.id === state.currentSceneId)
  const stats = config.stats.map((stat) => ({
    id: stat.id,
    name: stat.name,
    description: stat.description,
    current: state.stats[stat.id] ?? stat.defaultValue,
    range: [stat.min, stat.max],
  }))

  const context = {
    gameTitle: config.title,
    subtitle: config.subtitle,
    day: state.day,
    energy: `${state.energy}/${config.maxEnergy}`,
    currentScene: currentScene ? { id: currentScene.id, name: currentScene.name } : null,
    heroine: {
      name: config.ai.characterName,
      profile: config.ai.characterProfile,
    },
    worldSetting: config.ai.worldSetting,
    stats,
    recentStory: state.log.slice(-config.ai.recentLogLimit),
    latestAction: {
      id: action.id,
      name: action.name,
      description: action.description,
      flavor: action.flavor,
      sceneId: action.sceneId || state.currentSceneId,
      effects: action.effects,
      scriptedLines: action.narrative?.lines || [],
    },
    triggeredEvents: triggeredEvents.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      effects: event.effects,
    })),
    previouslyGeneratedLines: previousLines,
  }

  return [
    'Use the JSON context below to generate exactly one new follow-up line after the action.',
    'Focus on the girl\'s reaction, the atmosphere, relationship changes, and specific daily-life details.',
    'If previouslyGeneratedLines is not empty, continue after them instead of restarting the scene.',
    'Do not summarize multiple beats into a long paragraph; only write the next beat.',
    JSON.stringify(context, null, 2),
  ].join('\n\n')
}

export async function generateActionStoryLine(params: GenerateActionStoryParams) {
  const { config, signal } = params
  const endpointBase = normalizeBaseUrl(config.ai.apiBaseUrl)
  const systemPrompt = buildSystemPrompt(config)
  const userPrompt = buildUserPrompt(params)

  const endpoint = config.ai.apiMode === 'responses' ? `${endpointBase}/responses` : `${endpointBase}/chat/completions`
  const payload =
    config.ai.apiMode === 'responses'
      ? {
          model: config.ai.model,
          instructions: systemPrompt,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: userPrompt,
                },
              ],
            },
          ],
          ...(buildResponsesReasoning(config) ? { reasoning: buildResponsesReasoning(config) } : {}),
          max_output_tokens: 180,
        }
      : {
          model: config.ai.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          ...(buildChatReasoningEffort(config) ? { reasoning_effort: buildChatReasoningEffort(config) } : {}),
          ...(shouldSendTemperature(config) ? { temperature: config.ai.temperature } : {}),
          max_tokens: 180,
        }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  const data = (await response.json()) as ResponsesApiResponse | ChatCompletionsResponse
  const rawText = config.ai.apiMode === 'responses' ? extractResponsesContent(data as ResponsesApiResponse) : extractChatContent(data as ChatCompletionsResponse)
  const line = parseLinesFromText(rawText)[0]

  if (!line) {
    throw new Error('AI returned no usable story line.')
  }

  return line
}
