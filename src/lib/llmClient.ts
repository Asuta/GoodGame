import type { ApiMode } from '@/types/game'

type LlmRequestInput = {
  apiMode: ApiMode
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxOutputTokens: number
  systemPrompt: string
  contextPrompt: string
  userInstruction: string
}

function trimBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

function buildApiUrl(baseUrl: string, endpoint: 'completions' | 'responses'): string {
  const trimmed = trimBaseUrl(baseUrl)
  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/${endpoint}`
  }
  return `${trimmed}/v1/${endpoint}`
}

function extractResponsesText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Responses API returned invalid payload')
  }

  const rawOutputText = (payload as { output_text?: unknown }).output_text
  if (typeof rawOutputText === 'string' && rawOutputText.trim()) {
    return rawOutputText
  }

  const output = (payload as { output?: unknown }).output
  if (!Array.isArray(output)) {
    throw new Error('Responses API output is empty')
  }

  const chunks: string[] = []
  output.forEach((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return
    }
    const content = (entry as { content?: unknown }).content
    if (!Array.isArray(content)) {
      return
    }
    content.forEach((part) => {
      if (typeof part !== 'object' || part === null) {
        return
      }
      const text = (part as { text?: unknown }).text
      if (typeof text === 'string') {
        chunks.push(text)
      }
    })
  })

  const joined = chunks.join('\n').trim()
  if (!joined) {
    throw new Error('Responses API did not return any text content')
  }
  return joined
}

function extractCompletionsText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Completions API returned invalid payload')
  }

  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('Completions API choices are empty')
  }

  const text = (choices[0] as { text?: unknown }).text
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Completions API first choice does not include text')
  }

  return text.trim()
}

export async function requestModelReply(input: LlmRequestInput): Promise<string> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${input.apiKey}`,
  }

  const joinedPrompt = `${input.systemPrompt}\n\n${input.contextPrompt}\n\n${input.userInstruction}`

  if (input.apiMode === 'completions') {
    const response = await fetch(buildApiUrl(input.baseUrl, 'completions'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: input.model,
        prompt: joinedPrompt,
        temperature: input.temperature,
        max_tokens: input.maxOutputTokens,
      }),
    })

    if (!response.ok) {
      throw new Error(`Completions API error: ${response.status} ${response.statusText}`)
    }

    return extractCompletionsText(await response.json())
  }

  const response = await fetch(buildApiUrl(input.baseUrl, 'responses'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: input.model,
      input: [
        {
          role: 'system',
          content: input.systemPrompt,
        },
        {
          role: 'user',
          content: `${input.contextPrompt}\n\n${input.userInstruction}`,
        },
      ],
      temperature: input.temperature,
      max_output_tokens: input.maxOutputTokens,
    }),
  })

  if (!response.ok) {
    throw new Error(`Responses API error: ${response.status} ${response.statusText}`)
  }

  return extractResponsesText(await response.json())
}
