export type ApiFormat = 'completions' | 'chat_completions' | 'responses'

export type ChatRole = 'user' | 'assistant'

export interface ConversationTurn {
  role: ChatRole
  content: string
}

export interface ApiConfig {
  apiKey: string
  baseUrl: string
  model: string
  format: ApiFormat
  temperature: number
  maxTokens: number
}

interface OpenAIErrorBody {
  error?: {
    message?: string
  }
}

const REQUEST_TIMEOUT_MS = 45000

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function toChatMessages(systemPrompt: string, history: ConversationTurn[], userPrompt: string) {
  return [
    { role: 'system', content: systemPrompt },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: 'user', content: userPrompt },
  ]
}

function toResponsesInput(systemPrompt: string, history: ConversationTurn[], userPrompt: string) {
  return [
    {
      role: 'system',
      content: systemPrompt,
    },
    ...history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    {
      role: 'user',
      content: userPrompt,
    },
  ]
}

function toCompletionsPrompt(systemPrompt: string, history: ConversationTurn[], userPrompt: string) {
  const historyText = history
    .map((turn) => `${turn.role === 'assistant' ? 'DM' : 'Player'}: ${turn.content}`)
    .join('\n')

  return [
    `System:\n${systemPrompt}`,
    historyText ? `Conversation:\n${historyText}` : '',
    `Player:\n${userPrompt}`,
    'DM (must return JSON only):',
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as OpenAIErrorBody
    if (body.error?.message) {
      return body.error.message
    }
  } catch {
    // ignore json parse failure and fall back to status text
  }

  return `${response.status} ${response.statusText}`
}

function parseResponsesOutput(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return ''
  }

  const maybeOutputText = (payload as { output_text?: unknown }).output_text
  if (typeof maybeOutputText === 'string' && maybeOutputText.length > 0) {
    return maybeOutputText
  }

  const output = (payload as { output?: unknown }).output
  if (!Array.isArray(output)) {
    return ''
  }

  const textSegments: string[] = []

  for (const item of output) {
    if (typeof item !== 'object' || item === null) {
      continue
    }

    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) {
      continue
    }

    for (const block of content) {
      if (typeof block !== 'object' || block === null) {
        continue
      }

      const text = (block as { text?: unknown }).text
      if (typeof text === 'string') {
        textSegments.push(text)
      }
    }
  }

  return textSegments.join('\n').trim()
}

export async function callOpenAIJson(
  config: ApiConfig,
  systemPrompt: string,
  history: ConversationTurn[],
  userPrompt: string,
): Promise<string> {
  if (!config.apiKey.trim()) {
    throw new Error('请先填写 API Key。')
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey.trim()}`,
  }

  const timeoutController = new AbortController()
  const timeoutId = window.setTimeout(() => {
    timeoutController.abort()
  }, REQUEST_TIMEOUT_MS)

  try {
    if (config.format === 'completions') {
      const response = await fetch(joinUrl(config.baseUrl, '/completions'), {
        method: 'POST',
        headers,
        signal: timeoutController.signal,
        body: JSON.stringify({
          model: config.model,
          prompt: toCompletionsPrompt(systemPrompt, history, userPrompt),
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      })

      if (!response.ok) {
        throw new Error(await parseError(response))
      }

      const payload = (await response.json()) as { choices?: Array<{ text?: string }> }
      const content = payload.choices?.[0]?.text?.trim() ?? ''
      if (!content) {
        throw new Error('Completions 接口返回了空内容。')
      }

      return content
    }

    if (config.format === 'chat_completions') {
      const response = await fetch(joinUrl(config.baseUrl, '/chat/completions'), {
        method: 'POST',
        headers,
        signal: timeoutController.signal,
        body: JSON.stringify({
          model: config.model,
          messages: toChatMessages(systemPrompt, history, userPrompt),
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      })

      if (!response.ok) {
        throw new Error(await parseError(response))
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>
      }

      const content = payload.choices?.[0]?.message?.content
      if (typeof content === 'string' && content.trim().length > 0) {
        return content.trim()
      }

      if (Array.isArray(content)) {
        const text = content
          .map((item) => (typeof item.text === 'string' ? item.text : ''))
          .join('\n')
          .trim()

        if (text.length > 0) {
          return text
        }
      }

      throw new Error('Chat Completions 接口返回了空内容。')
    }

    const response = await fetch(joinUrl(config.baseUrl, '/responses'), {
      method: 'POST',
      headers,
      signal: timeoutController.signal,
      body: JSON.stringify({
        model: config.model,
        input: toResponsesInput(systemPrompt, history, userPrompt),
        temperature: config.temperature,
        max_output_tokens: config.maxTokens,
      }),
    })

    if (!response.ok) {
      throw new Error(await parseError(response))
    }

    const payload = (await response.json()) as unknown
    const content = parseResponsesOutput(payload)

    if (!content) {
      throw new Error('Responses 接口返回了空内容。')
    }

    return content
  } catch (issue) {
    if (issue instanceof DOMException && issue.name === 'AbortError') {
      throw new Error(`请求超时（>${REQUEST_TIMEOUT_MS / 1000} 秒），请检查接口地址或稍后重试。`)
    }

    throw issue
  } finally {
    window.clearTimeout(timeoutId)
  }
}
