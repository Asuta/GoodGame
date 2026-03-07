import type { DailyAction, Effect, GameConfig, GameState, StatDef, StoryEvent } from './gameCore/types'

type GenerateActionStoryParams = {
  action: DailyAction
  config: GameConfig
  state: GameState
  triggeredEvents: StoryEvent[]
  previousLines?: string[]
  playerIntent?: string
  signal?: AbortSignal
}

type EvaluateActionInteractionParams = {
  action: DailyAction
  config: GameConfig
  state: GameState
  generatedLines: string[]
  playerIntents: string[]
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

type StoryTurnPayload = {
  line?: string
  lines?: string[]
  choices?: string[]
}

type InteractionEffectPayload = {
  statId?: string
  id?: string
  delta?: number | string
}

type InteractionEvaluationPayload = {
  effects?: InteractionEffectPayload[]
  statChanges?: InteractionEffectPayload[]
  summary?: string
  rationale?: string
}

export type AiStoryTurn = {
  line: string
  choices: string[]
}

export type AiInteractionEvaluation = {
  effects: Effect[]
  summary: string
}

export function canUseAiStory(config: GameConfig) {
  return Boolean(config.ai.enabled && config.ai.apiBaseUrl.trim() && config.ai.apiKey.trim() && config.ai.model.trim())
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

function sanitizeText(value: string) {
  return value.trim().replace(/^[-*\d.\s]+/, '').trim()
}

function sanitizeChoices(choices: string[] | undefined) {
  return (choices || [])
    .map((choice) => sanitizeText(choice))
    .filter(Boolean)
    .slice(0, 2)
}

function clampDelta(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractJsonCandidates(raw: string) {
  const candidates = [raw.trim()]
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) candidates.unshift(fencedMatch[1].trim())

  const firstObject = raw.indexOf('{')
  const lastObject = raw.lastIndexOf('}')
  if (firstObject >= 0 && lastObject > firstObject) candidates.push(raw.slice(firstObject, lastObject + 1))

  return Array.from(new Set(candidates.filter(Boolean)))
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

function buildStatsContext(config: GameConfig, state: GameState) {
  return config.stats.map((stat) => ({
    id: stat.id,
    name: stat.name,
    description: stat.description,
    current: state.stats[stat.id] ?? stat.defaultValue,
    range: [stat.min, stat.max],
  }))
}

function buildBaseContext(action: DailyAction, config: GameConfig, state: GameState) {
  const currentScene = config.scenes.find((scene) => scene.id === state.currentSceneId)

  return {
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
    stats: buildStatsContext(config, state),
    latestAction: {
      id: action.id,
      name: action.name,
      description: action.description,
      flavor: action.flavor,
      sceneId: action.sceneId || state.currentSceneId,
      scriptedLines: action.narrative?.lines || [],
    },
  }
}

function buildStorySystemPrompt(config: GameConfig) {
  return [
    'You are the scenario writer for a daily raising visual novel.',
    'Write exactly one new story line and exactly two next-step player options.',
    'Write in Simplified Chinese.',
    'Return JSON only, using the exact shape {"line":"...","choices":["选项1","选项2"]}.',
    'line must be exactly one short beat, 1 to 2 sentences, suitable for one-step reveal.',
    'choices must contain exactly two short actionable options the player can choose next.',
    'The options should be natural, concrete, and different from each other.',
    'Continue naturally from previous lines and any player intent that is provided.',
    'Do not use Markdown. Do not explain your answer. Do not include any fields other than line and choices.',
    config.ai.promptNotes.trim(),
  ].join('\n')
}

function buildStoryUserPrompt(params: GenerateActionStoryParams) {
  const { action, config, state, triggeredEvents, previousLines = [], playerIntent } = params
  const context = {
    ...buildBaseContext(action, config, state),
    recentStory: state.log.slice(-config.ai.recentLogLimit),
    triggeredEvents: triggeredEvents.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      effects: event.effects,
    })),
    previouslyGeneratedLines: previousLines,
    playerIntent: playerIntent || null,
  }

  return [
    'Use the JSON context below to generate exactly one new line and two suggested next actions.',
    'If playerIntent is present, treat it as what the player just chose or typed, and continue from it.',
    'The two generated options should be good suggestions only; the player may still type their own custom action.',
    'Keep the line concise and do not restart the scene from the beginning.',
    JSON.stringify(context, null, 2),
  ].join('\n\n')
}

function buildEvaluationSystemPrompt() {
  return [
    'You evaluate the result of one completed interaction in a daily raising visual novel.',
    'Write in Simplified Chinese.',
    'Decide whether the interaction changed any stats after considering the whole exchange.',
    'Return JSON only, using the exact shape {"effects":[{"statId":"trust","delta":2}],"summary":"..."}.',
    'effects may contain 0 to 3 entries.',
    'Use only statId values that appear in the provided stats list.',
    'delta must be an integer between -4 and 4, and must not be 0.',
    'Be conservative. Small changes are usually better than large changes.',
    'Ignore any legacy scripted action effects and judge the interaction on its own merits.',
    'summary must be one short sentence explaining the result.',
    'If you fail to return JSON, use one line per effect in the format statId:+2 and then one summary line.',
  ].join('\n')
}

function buildEvaluationUserPrompt(params: EvaluateActionInteractionParams) {
  const { action, config, state, generatedLines, playerIntents } = params
  const context = {
    ...buildBaseContext(action, config, state),
    recentStory: state.log.slice(-config.ai.recentLogLimit),
    interactionTranscript: generatedLines,
    playerIntents,
  }

  return [
    'Use the JSON context below to judge the completed interaction and decide the final stat changes.',
    'The stat changes should reflect the whole interaction, including the player intents and the girl\'s reactions.',
    'You may lower stats if the interaction felt awkward, unsafe, dismissive, or hurtful.',
    'You may return no stat changes if the exchange had no meaningful effect.',
    JSON.stringify(context, null, 2),
  ].join('\n\n')
}

function parseChoicesFromPlainText(rawText: string) {
  const lines = rawText
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const choices: string[] = []

  for (const line of lines) {
    const match = line.match(/^(?:[-*]|\d+[.)\u3001:\uFF1A-])\s*(.+)$/)
    const choice = match?.[1] ? sanitizeText(match[1]) : ''
    if (!choice || choices.includes(choice)) continue
    choices.push(choice)
    if (choices.length === 2) break
  }

  return choices
}

function extractStoryLineFromPlainText(rawText: string) {
  const lines = rawText
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const storyLine = lines.find((line) => {
    if (/^(?:[-*]|\d+[.)\u3001:\uFF1A-])\s*/.test(line)) return false
    if (/[:\uFF1A]$/.test(line)) return false
    return true
  })

  return sanitizeText(storyLine || lines[0] || '')
}

function parseStoryTurn(rawText: string): AiStoryTurn {
  const fallbackChoices = ['\u8f7b\u58f0\u5b89\u6170\u5979', '\u5148\u8ba9\u5979\u4f11\u606f\u4e00\u4f1a\u513f']
  const plainTextChoices = sanitizeChoices(parseChoicesFromPlainText(rawText))

  for (const candidate of extractJsonCandidates(rawText)) {
    try {
      const parsed = JSON.parse(candidate) as StoryTurnPayload
      const line = sanitizeText(parsed.line || parsed.lines?.[0] || '')
      const jsonChoices = sanitizeChoices(parsed.choices)
      if (line) {
        return {
          line,
          choices: jsonChoices.length === 2 ? jsonChoices : plainTextChoices.length === 2 ? plainTextChoices : fallbackChoices,
        }
      }
    } catch {
      continue
    }
  }

  const line = extractStoryLineFromPlainText(rawText)
  if (!line) throw new Error('AI returned no usable story line.')
  return {
    line,
    choices: plainTextChoices.length === 2 ? plainTextChoices : fallbackChoices,
  }
}

function sanitizeEffects(config: GameConfig, effects: InteractionEffectPayload[] | undefined) {
  const allowedIds = new Set(config.stats.map((stat) => stat.id))
  const merged = new Map<string, number>()

  for (const effect of effects || []) {
    const statId = effect?.statId || effect?.id
    if (!statId || !allowedIds.has(statId)) continue
    const rawDelta = typeof effect.delta === 'string' ? Number(effect.delta) : effect.delta
    if (typeof rawDelta !== 'number' || !Number.isFinite(rawDelta)) continue
    const nextDelta = clampDelta(rawDelta, -4, 4)
    if (nextDelta === 0) continue
    merged.set(statId, clampDelta((merged.get(statId) || 0) + nextDelta, -4, 4))
  }

  return Array.from(merged.entries()).map(([statId, delta]) => ({ statId, delta }))
}

function parseEffectsFromPlainText(rawText: string, stats: StatDef[]) {
  const effects: InteractionEffectPayload[] = []
  const lines = rawText
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    for (const stat of stats) {
      const idPattern = new RegExp(`(?:^|\\b)${escapeRegExp(stat.id)}\\s*[:=]\\s*([+-]?\\d+)`, 'i')
      const namePattern = new RegExp(`${escapeRegExp(stat.name)}\\s*[:\\uFF1A=]?\\s*([+-]?\\d+)`)
      const match = line.match(idPattern) || line.match(namePattern)
      if (!match?.[1]) continue
      effects.push({ statId: stat.id, delta: Number(match[1]) })
      break
    }
  }

  return effects
}

function parseEvaluationSummary(rawText: string, stats: StatDef[]) {
  const lines = rawText
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    lines.find((line) => {
      return !stats.some((stat) => {
        const idPattern = new RegExp(`(?:^|\\b)${escapeRegExp(stat.id)}\\s*[:=]\\s*([+-]?\\d+)`, 'i')
        const namePattern = new RegExp(`${escapeRegExp(stat.name)}\\s*[:\\uFF1A=]?\\s*([+-]?\\d+)`)
        return idPattern.test(line) || namePattern.test(line)
      })
    }) || ''
  )
}

function parseInteractionEvaluation(rawText: string, config: GameConfig): AiInteractionEvaluation {
  for (const candidate of extractJsonCandidates(rawText)) {
    try {
      const parsed = JSON.parse(candidate) as InteractionEvaluationPayload
      return {
        effects: sanitizeEffects(config, parsed.effects || parsed.statChanges),
        summary: sanitizeText(parsed.summary || parsed.rationale || ''),
      }
    } catch {
      continue
    }
  }

  return {
    effects: sanitizeEffects(config, parseEffectsFromPlainText(rawText, config.stats)),
    summary: parseEvaluationSummary(rawText, config.stats),
  }
}

function buildRequestPayload(config: GameConfig, systemPrompt: string, userPrompt: string, maxTokens: number) {
  return config.ai.apiMode === 'responses'
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
        max_output_tokens: maxTokens,
      }
    : {
        model: config.ai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...(buildChatReasoningEffort(config) ? { reasoning_effort: buildChatReasoningEffort(config) } : {}),
        ...(shouldSendTemperature(config) ? { temperature: config.ai.temperature } : {}),
        max_tokens: maxTokens,
      }
}

async function requestAiText(config: GameConfig, systemPrompt: string, userPrompt: string, maxTokens: number, signal?: AbortSignal) {
  const endpointBase = normalizeBaseUrl(config.ai.apiBaseUrl)
  const endpoint = config.ai.apiMode === 'responses' ? `${endpointBase}/responses` : `${endpointBase}/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify(buildRequestPayload(config, systemPrompt, userPrompt, maxTokens)),
    signal,
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  const data = (await response.json()) as ResponsesApiResponse | ChatCompletionsResponse
  return config.ai.apiMode === 'responses' ? extractResponsesContent(data as ResponsesApiResponse) : extractChatContent(data as ChatCompletionsResponse)
}

export async function generateActionStoryTurn(params: GenerateActionStoryParams) {
  const rawText = await requestAiText(params.config, buildStorySystemPrompt(params.config), buildStoryUserPrompt(params), 220, params.signal)
  return parseStoryTurn(rawText)
}

export async function evaluateActionInteraction(params: EvaluateActionInteractionParams) {
  const rawText = await requestAiText(params.config, buildEvaluationSystemPrompt(), buildEvaluationUserPrompt(params), 180, params.signal)
  return parseInteractionEvaluation(rawText, params.config)
}
