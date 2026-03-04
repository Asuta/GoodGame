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
  maxTokens: number | null
}

interface OpenAIErrorBody {
  error?: {
    message?: string
  }
}

interface StreamOptions {
  onDelta?: (delta: string, accumulated: string) => void
}

const REQUEST_TIMEOUT_MS = 45000

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function withTokenLimit<T extends Record<string, unknown>>(
  payload: T,
  tokenField: 'max_tokens' | 'max_output_tokens',
  maxTokens: number | null,
): T & Partial<Record<'max_tokens' | 'max_output_tokens', number>> {
  if (typeof maxTokens === 'number' && Number.isFinite(maxTokens) && maxTokens > 0) {
    return {
      ...payload,
      [tokenField]: Math.floor(maxTokens),
    }
  }

  return payload
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

function parseChatCompletionsOutput(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return ''
  }

  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices)) {
    return ''
  }

  const first = choices[0]
  if (typeof first !== 'object' || first === null) {
    return ''
  }

  const message = (first as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) {
    return ''
  }

  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') {
    return content.trim()
  }

  if (!Array.isArray(content)) {
    return ''
  }

  const text = content
    .map((item) => {
      if (typeof item === 'object' && item !== null) {
        const value = (item as { text?: unknown }).text
        return typeof value === 'string' ? value : ''
      }
      return ''
    })
    .join('\n')
    .trim()

  return text
}

function parseCompletionsOutput(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return ''
  }

  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices)) {
    return ''
  }

  const first = choices[0]
  if (typeof first !== 'object' || first === null) {
    return ''
  }

  const text = (first as { text?: unknown }).text
  return typeof text === 'string' ? text.trim() : ''
}

function extractDeltaFromStreamEvent(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return ''
  }

  const eventType = (payload as { type?: unknown }).type

  if (eventType === 'response.output_text.delta') {
    const delta = (payload as { delta?: unknown }).delta
    return typeof delta === 'string' ? delta : ''
  }

  const choices = (payload as { choices?: unknown }).choices
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0]
    if (typeof first === 'object' && first !== null) {
      const delta = (first as { delta?: unknown }).delta
      if (typeof delta === 'object' && delta !== null) {
        const content = (delta as { content?: unknown }).content
        if (typeof content === 'string') {
          return content
        }

        if (Array.isArray(content)) {
          const text = content
            .map((item) => {
              if (typeof item === 'object' && item !== null) {
                const value = (item as { text?: unknown }).text
                return typeof value === 'string' ? value : ''
              }
              return ''
            })
            .join('')
          if (text) {
            return text
          }
        }
      }

      const text = (first as { text?: unknown }).text
      if (typeof text === 'string') {
        return text
      }
    }
  }

  const delta = (payload as { delta?: unknown }).delta
  if (typeof delta === 'string') {
    return delta
  }

  return ''
}

async function readSseStream(response: Response, onDelta?: StreamOptions['onDelta']): Promise<string> {
  if (!response.body) {
    return ''
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let accumulated = ''
  let latestPayload: unknown = null

  const flushEvent = (eventRaw: string) => {
    const dataLines = eventRaw
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())

    if (dataLines.length === 0) {
      return
    }

    const joined = dataLines.join('\n')
    if (!joined || joined === '[DONE]') {
      return
    }

    try {
      const payload = JSON.parse(joined) as unknown
      latestPayload = payload
      const delta = extractDeltaFromStreamEvent(payload)
      if (delta) {
        accumulated += delta
        onDelta?.(delta, accumulated)
      }
    } catch {
      // Ignore non-JSON chunks.
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })

    let separatorIndex = buffer.indexOf('\n\n')
    while (separatorIndex !== -1) {
      const eventRaw = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)
      flushEvent(eventRaw)
      separatorIndex = buffer.indexOf('\n\n')
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    flushEvent(buffer)
  }

  if (accumulated.trim().length > 0) {
    return accumulated.trim()
  }

  if (latestPayload && typeof latestPayload === 'object') {
    return (
      parseResponsesOutput(latestPayload) ||
      parseChatCompletionsOutput(latestPayload) ||
      parseCompletionsOutput(latestPayload)
    )
  }

  return ''
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
          ...withTokenLimit(
            {
              model: config.model,
              prompt: toCompletionsPrompt(systemPrompt, history, userPrompt),
            },
            'max_tokens',
            config.maxTokens,
          ),
        }),
      })

      if (!response.ok) {
        throw new Error(await parseError(response))
      }

      const payload = (await response.json()) as unknown
      const content = parseCompletionsOutput(payload)
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
          ...withTokenLimit(
            {
              model: config.model,
              messages: toChatMessages(systemPrompt, history, userPrompt),
            },
            'max_tokens',
            config.maxTokens,
          ),
        }),
      })

      if (!response.ok) {
        throw new Error(await parseError(response))
      }

      const payload = (await response.json()) as unknown
      const content = parseChatCompletionsOutput(payload)

      if (content.length > 0) {
        return content
      }

      throw new Error('Chat Completions 接口返回了空内容。')
    }

    const response = await fetch(joinUrl(config.baseUrl, '/responses'), {
      method: 'POST',
      headers,
      signal: timeoutController.signal,
      body: JSON.stringify({
        ...withTokenLimit(
          {
            model: config.model,
            input: toResponsesInput(systemPrompt, history, userPrompt),
          },
          'max_output_tokens',
          config.maxTokens,
        ),
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

export async function callOpenAIJsonStream(
  config: ApiConfig,
  systemPrompt: string,
  history: ConversationTurn[],
  userPrompt: string,
  options: StreamOptions = {},
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
          ...withTokenLimit(
            {
              model: config.model,
              prompt: toCompletionsPrompt(systemPrompt, history, userPrompt),
              stream: true,
            },
            'max_tokens',
            config.maxTokens,
          ),
        }),
      })

      if (!response.ok) {
        throw new Error(await parseError(response))
      }

      const content = await readSseStream(response, options.onDelta)
      if (!content) {
        throw new Error('Completions 流式接口返回了空内容。')
      }

      return content
    }

    if (config.format === 'chat_completions') {
      const response = await fetch(joinUrl(config.baseUrl, '/chat/completions'), {
        method: 'POST',
        headers,
        signal: timeoutController.signal,
        body: JSON.stringify({
          ...withTokenLimit(
            {
              model: config.model,
              messages: toChatMessages(systemPrompt, history, userPrompt),
              stream: true,
            },
            'max_tokens',
            config.maxTokens,
          ),
        }),
      })

      if (!response.ok) {
        throw new Error(await parseError(response))
      }

      const content = await readSseStream(response, options.onDelta)
      if (!content) {
        throw new Error('Chat Completions 流式接口返回了空内容。')
      }

      return content
    }

    const response = await fetch(joinUrl(config.baseUrl, '/responses'), {
      method: 'POST',
      headers,
      signal: timeoutController.signal,
      body: JSON.stringify({
        ...withTokenLimit(
          {
            model: config.model,
            input: toResponsesInput(systemPrompt, history, userPrompt),
            stream: true,
          },
          'max_output_tokens',
          config.maxTokens,
        ),
      }),
    })

    if (!response.ok) {
      throw new Error(await parseError(response))
    }

    const content = await readSseStream(response, options.onDelta)
    if (!content) {
      throw new Error('Responses 流式接口返回了空内容。')
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
