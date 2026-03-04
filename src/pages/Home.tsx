import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactNode } from 'react'

import { rollDice } from '@/lib/dice'
import { callOpenAIJson, callOpenAIJsonStream } from '@/lib/openai'
import type { ApiConfig, ApiFormat, ConversationTurn } from '@/lib/openai'

type MessageRole = 'user' | 'assistant' | 'system'

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
}

interface GameContext {
  background: string
  rules: string
  characters: string
  styleReference: string
}

interface AgentAction {
  type: 'update_context' | 'roll_dice'
  target?: 'background' | 'rules' | 'characters' | 'styleReference'
  operation?: 'append' | 'replace'
  content?: string
  expression?: string
  reason?: string
}

interface AgentPayload {
  analysis?: string
  actions?: AgentAction[]
  reply?: string
}

interface PersistedState {
  apiConfig: ApiConfig
  context: GameContext
  conceptInput: string
  sendFullHistory: boolean
  messages: ChatMessage[]
}

interface SaveArchive {
  version: 1
  exportedAt: string
  state: PersistedState
}

const STORAGE_KEY = 'ai-trpg-studio-v1'

const DEFAULT_CONFIG: ApiConfig = {
  apiKey: 'sk-MWqWbvfrrWlAaxPdCnIrRtFsteAs1gI6',
  baseUrl: 'https://codex-api.packycode.com/v1',
  model: 'gpt-5.3-codex',
  format: 'responses',
  maxTokens: 900,
}

function normalizeMaxTokens(value: unknown): number | null {
  if (value === null || value === 'unlimited') {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CONFIG.maxTokens
  }

  return Math.floor(parsed)
}

function estimateTokenCount(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return 0
  }

  let tokens = 0
  let asciiRun = 0

  const flushAsciiRun = () => {
    if (asciiRun > 0) {
      tokens += Math.max(1, Math.ceil(asciiRun / 4))
      asciiRun = 0
    }
  }

  for (const char of normalized) {
    if (/\s/.test(char)) {
      flushAsciiRun()
      continue
    }

    if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(char)) {
      flushAsciiRun()
      tokens += 1
      continue
    }

    if (/[a-zA-Z0-9]/.test(char)) {
      asciiRun += 1
      continue
    }

    flushAsciiRun()
    tokens += 1
  }

  flushAsciiRun()
  return tokens
}

const DEFAULT_CONTEXT: GameContext = {
  background:
    '【世界观】\n大陆名为“弧光群屿”，由漂浮岛链与地下海构成。各势力通过古代遗物“共鸣核”维持领地稳定。',
  rules:
    '【规则】\n- DM 会给出场景、选项与风险提示。\n- 关键行动可掷骰（默认 1d20），高点成功，低点失败。\n- 剧情可以失败，但失败应推动新事件。',
  characters:
    '【人物】\n- 玩家：新上任的调查员，擅长观察与社交。\n- 同伴“灰鸦”：谨慎的情报商，习惯隐藏真实动机。',
  styleReference:
    '【风格参考】\n短句叙事、张力推进、每轮包含可操作选择；强调结果反馈和悬念。',
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      '欢迎来到 AI 跑团工作台。你可以先用“世界观生成”创建设定，再开始对话。若你希望，我也可以直接用当前设定开局。',
    timestamp: Date.now(),
  },
]

function nowId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function parseJsonFromText(text: string): AgentPayload {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const target = fenced?.[1]?.trim() ?? text.trim()

  let candidate = target
  const firstBrace = target.indexOf('{')
  const lastBrace = target.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidate = target.slice(firstBrace, lastBrace + 1)
  }

  try {
    const parsed = JSON.parse(candidate) as AgentPayload
    return parsed
  } catch {
    return {
      reply: text.trim(),
      actions: [],
    }
  }
}

function buildHistory(messages: ChatMessage[], sendFullHistory: boolean): ConversationTurn[] {
  const turns: ConversationTurn[] = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }))

  if (sendFullHistory) {
    return turns
  }

  return turns.slice(-8)
}

function updateContext(current: GameContext, action: AgentAction): GameContext {
  if (action.type !== 'update_context' || !action.target || !action.content) {
    return current
  }

  const previous = current[action.target]
  const nextValue = action.operation === 'replace' ? action.content.trim() : `${previous}\n${action.content.trim()}`.trim()

  return {
    ...current,
    [action.target]: nextValue,
  }
}

function renderApiModeLabel(mode: ApiFormat): string {
  if (mode === 'completions') {
    return 'Completions (旧接口)'
  }

  if (mode === 'chat_completions') {
    return 'Chat Completions'
  }

  return 'Responses (新接口)'
}

function normalizeMessageContent(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t')
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const chunks = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)

  return chunks.filter(Boolean).map((chunk, index) => {
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4) {
      return <strong key={`${keyPrefix}-strong-${index}`}>{chunk.slice(2, -2)}</strong>
    }

    if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2) {
      return <code key={`${keyPrefix}-code-${index}`}>{chunk.slice(1, -1)}</code>
    }

    return <Fragment key={`${keyPrefix}-text-${index}`}>{chunk}</Fragment>
  })
}

function MessageBody({ content }: { content: string }) {
  const normalized = normalizeMessageContent(content)
  const lines = normalized.split('\n')

  return (
    <div className="message-content">
      {lines.map((line, index) => (
        <Fragment key={`line-${index}`}>
          {index > 0 ? <br /> : null}
          {renderInlineMarkdown(line, `line-${index}`)}
        </Fragment>
      ))}
    </div>
  )
}

function extractReplyPreview(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    return ''
  }

  const payload = parseJsonFromText(trimmed)
  if (typeof payload.reply === 'string' && payload.reply.trim()) {
    return payload.reply
  }

  const match = raw.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)/)
  if (!match?.[1]) {
    return ''
  }

  const normalized = match[1]
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')

  return normalized.trim()
}

function toPersistedStateSnapshot(
  apiConfig: ApiConfig,
  context: GameContext,
  conceptInput: string,
  sendFullHistory: boolean,
  messages: ChatMessage[],
): PersistedState {
  return {
    apiConfig,
    context,
    conceptInput,
    sendFullHistory,
    messages,
  }
}

function parseImportedArchive(payload: unknown): PersistedState | null {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }

  const rawState = 'state' in payload ? (payload as { state?: unknown }).state : payload
  if (typeof rawState !== 'object' || rawState === null) {
    return null
  }

  const candidate = rawState as Partial<PersistedState>

  if (!candidate.apiConfig || !candidate.context || !Array.isArray(candidate.messages)) {
    return null
  }

  const safeApiConfig: ApiConfig = {
    ...DEFAULT_CONFIG,
    ...candidate.apiConfig,
    maxTokens: normalizeMaxTokens(candidate.apiConfig.maxTokens),
  }

  const safeContext: GameContext = {
    ...DEFAULT_CONTEXT,
    ...candidate.context,
  }

  const safeMessages: ChatMessage[] = (candidate.messages as unknown[])
    .filter((item): item is Partial<ChatMessage> => typeof item === 'object' && item !== null)
    .map((item) => {
      const role: MessageRole = item.role === 'assistant' || item.role === 'system' ? item.role : 'user'

      return {
        id: typeof item.id === 'string' && item.id.trim() ? item.id : nowId(),
        role,
        content: typeof item.content === 'string' ? item.content : '',
        timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
      }
    })

  return {
    apiConfig: safeApiConfig,
    context: safeContext,
    conceptInput: typeof candidate.conceptInput === 'string' ? candidate.conceptInput : '',
    sendFullHistory: typeof candidate.sendFullHistory === 'boolean' ? candidate.sendFullHistory : true,
    messages: safeMessages.length > 0 ? safeMessages : INITIAL_MESSAGES,
  }
}

export default function Home() {
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const importFileRef = useRef<HTMLInputElement | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const [apiConfig, setApiConfig] = useState<ApiConfig>(DEFAULT_CONFIG)
  const [context, setContext] = useState<GameContext>(DEFAULT_CONTEXT)
  const [conceptInput, setConceptInput] = useState('')
  const [sendFullHistory, setSendFullHistory] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [worldBusy, setWorldBusy] = useState(false)
  const [streamingReply, setStreamingReply] = useState('')
  const [showContextPanel, setShowContextPanel] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PersistedState>
      if (parsed.apiConfig) {
        setApiConfig({
          ...DEFAULT_CONFIG,
          ...parsed.apiConfig,
          maxTokens: normalizeMaxTokens(parsed.apiConfig.maxTokens),
        })
      }
      if (parsed.context) {
        setContext({ ...DEFAULT_CONTEXT, ...parsed.context })
      }
      if (typeof parsed.conceptInput === 'string') {
        setConceptInput(parsed.conceptInput)
      }
      if (typeof parsed.sendFullHistory === 'boolean') {
        setSendFullHistory(parsed.sendFullHistory)
      }
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        setMessages(parsed.messages)
      }
    } catch {
      // Keep default state when local cache is invalid.
    }
  }, [])

  useEffect(() => {
    const payload = toPersistedStateSnapshot(apiConfig, context, conceptInput, sendFullHistory, messages)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [apiConfig, context, conceptInput, sendFullHistory, messages])

  useEffect(() => {
    const box = messagesRef.current
    if (!box || !shouldStickToBottomRef.current) {
      return
    }

    box.scrollTop = box.scrollHeight
  }, [messages, streamingReply])

  useEffect(() => {
    if (!showContextPanel) {
      return
    }

    const onEsc = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowContextPanel(false)
      }
    }

    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('keydown', onEsc)
    }
  }, [showContextPanel])

  const contextPreview = useMemo(() => {
    return [context.background, context.rules, context.characters, context.styleReference].join('\n\n')
  }, [context])

  const contextTokenUsage = useMemo(() => {
    const historyTurns = buildHistory(messages, true)
    const historyText = historyTurns
      .map((turn) => `${turn.role === 'assistant' ? 'DM' : 'Player'}: ${turn.content}`)
      .join('\n')

    const contextTokens = estimateTokenCount(contextPreview)
    const historyTokens = estimateTokenCount(historyText)

    return {
      contextTokens,
      historyTokens,
      total: contextTokens + historyTokens,
    }
  }, [contextPreview, messages])

  function handleMessagesScroll() {
    const box = messagesRef.current
    if (!box) {
      return
    }

    const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight
    shouldStickToBottomRef.current = distanceFromBottom <= 24
  }

  async function runAgentTurn(
    userText: string,
    messageSnapshot: ChatMessage[],
    onReplyStream?: (text: string) => void,
  ): Promise<{ reply: string; nextContext: GameContext; logs: string[] }> {
    let workingContext = context
    const toolLogs: string[] = []
    let finalReply = ''

    const history = buildHistory(messageSnapshot, sendFullHistory)

    for (let round = 1; round <= 3; round += 1) {
      const systemPrompt = `你是一个网页跑团游戏的 DM Agent。你必须输出 JSON 对象，不允许输出额外文本。\n\n当前设定:\n${workingContext.background}\n\n${workingContext.rules}\n\n${workingContext.characters}\n\n${workingContext.styleReference}\n\n能力限制:\n1) 你可以通过 actions 执行 update_context 或 roll_dice。\n2) update_context 用于更新 background / rules / characters / styleReference。\n3) roll_dice 的 expression 仅使用 NdM+K 或 NdM-K 格式。\n\n输出格式:\n{\n  "analysis": "简短说明",\n  "actions": [\n    {"type":"update_context","target":"characters","operation":"append","content":"..."},\n    {"type":"roll_dice","expression":"1d20+2","reason":"潜行检定"}\n  ],\n  "reply": "给玩家展示的最终回复"\n}\n\n如果你执行了 actions，请在下一轮综合 actions 结果再给更准确回复。若无需 actions，actions 返回空数组。`

      const userPrompt = `玩家输入: ${userText}\n\n历史工具结果:\n${toolLogs.join('\n') || '无'}`
      let raw = ''

      try {
        raw = await callOpenAIJsonStream(apiConfig, systemPrompt, history, userPrompt, {
          onDelta: (_delta: string, accumulated: string) => {
            if (!onReplyStream) {
              return
            }

            const preview = extractReplyPreview(accumulated)
            if (preview) {
              onReplyStream(preview)
            }
          },
        })
      } catch (streamIssue) {
        const streamReason = streamIssue instanceof Error ? streamIssue.message : '未知错误'
        toolLogs.push(`stream_fallback: 流式请求失败（${streamReason}），已自动切换普通请求`)

        try {
          raw = await callOpenAIJson(apiConfig, systemPrompt, history, userPrompt)
        } catch (nonStreamIssue) {
          if (streamIssue instanceof Error && nonStreamIssue instanceof Error) {
            throw new Error(`流式与普通请求均失败: ${streamIssue.message} / ${nonStreamIssue.message}`)
          }

          throw nonStreamIssue
        }
      }

      const payload = parseJsonFromText(raw)
      const actions = payload.actions ?? []

      if (actions.length === 0) {
        finalReply = payload.reply?.trim() || 'DM 沉默了片刻，但没有给出有效回应。'
        break
      }

      for (const action of actions) {
        if (action.type === 'update_context') {
          const previous = workingContext
          workingContext = updateContext(workingContext, action)
          if (workingContext !== previous && action.target) {
            toolLogs.push(`context_updated: ${action.target} (${action.operation ?? 'append'})`)
          }
        }

        if (action.type === 'roll_dice' && action.expression) {
          const result = rollDice(action.expression)
          if (result) {
            toolLogs.push(`dice_result: ${result.expression} => ${result.detail} = ${result.total}${action.reason ? ` (${action.reason})` : ''}`)
          } else {
            toolLogs.push(`dice_result: invalid expression "${action.expression}"`)
          }
        }
      }

      finalReply = payload.reply?.trim() || finalReply

      if (round === 3 && !finalReply) {
        finalReply = '我完成了内部检定和状态更新。你准备好继续推进剧情了吗？'
      }
    }

    return {
      reply: finalReply || '剧情继续推进。',
      nextContext: workingContext,
      logs: toolLogs,
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const text = input.trim()
    if (!text || busy) {
      return
    }

    setBusy(true)
    setError('')
    setStreamingReply('')

    const userMessage: ChatMessage = {
      id: nowId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')

    try {
      const { reply, nextContext, logs } = await runAgentTurn(text, nextMessages, setStreamingReply)
      setContext(nextContext)

      const assistantMessage: ChatMessage = {
        id: nowId(),
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      }

      const systemMessages: ChatMessage[] = logs.map((log) => ({
        id: nowId(),
        role: 'system',
        content: `[Agent] ${log}`,
        timestamp: Date.now(),
      }))

      setMessages((current) => [...current, ...systemMessages, assistantMessage])
      setStreamingReply('')
    } catch (issue) {
      const reason = issue instanceof Error ? issue.message : '未知错误'
      setError(reason)
      setStreamingReply('')
      setMessages((current) => [
        ...current,
        {
          id: nowId(),
          role: 'system',
          content: `调用失败: ${reason}`,
          timestamp: Date.now(),
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return
    }

    event.preventDefault()

    if (busy || !input.trim()) {
      return
    }

    event.currentTarget.form?.requestSubmit()
  }

  async function generateWorld() {
    const concept = conceptInput.trim()
    if (!concept || worldBusy) {
      return
    }

    setWorldBusy(true)
    setError('')

    const systemPrompt = `你是跑团设定生成器。请根据玩家给出的倾向，输出 JSON，且必须包含以下字段:\n- background\n- rules\n- characters\n- styleReference\n- openingLine\n\n所有字段都必须是字符串，长度适中，可直接用于游戏开始。`

    try {
      const raw = await callOpenAIJson(apiConfig, systemPrompt, [], `请基于这个概念生成设定: ${concept}`)
      const payload = parseJsonFromText(raw) as Record<string, unknown>

      const nextContext: GameContext = {
        background: String(payload.background ?? DEFAULT_CONTEXT.background),
        rules: String(payload.rules ?? DEFAULT_CONTEXT.rules),
        characters: String(payload.characters ?? DEFAULT_CONTEXT.characters),
        styleReference: String(payload.styleReference ?? DEFAULT_CONTEXT.styleReference),
      }

      setContext(nextContext)

      const openingLine = String(
        payload.openingLine ?? '设定已生成：夜幕将临，新的故事正在等你迈出第一步。',
      )

      setMessages((current) => [
        ...current,
        {
          id: nowId(),
          role: 'system',
          content: '[World Builder] 已根据概念重建世界设定。',
          timestamp: Date.now(),
        },
        {
          id: nowId(),
          role: 'assistant',
          content: openingLine,
          timestamp: Date.now(),
        },
      ])
    } catch (issue) {
      const reason = issue instanceof Error ? issue.message : '未知错误'
      setError(reason)
    } finally {
      setWorldBusy(false)
    }
  }

  function exportArchive() {
    const snapshot = toPersistedStateSnapshot(apiConfig, context, conceptInput, sendFullHistory, messages)
    const archive: SaveArchive = {
      version: 1,
      exportedAt: new Date().toISOString(),
      state: snapshot,
    }

    const json = JSON.stringify(archive, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

    anchor.href = url
    anchor.download = `trpg-save-${stamp}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function importArchive(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const restored = parseImportedArchive(parsed)

      if (!restored) {
        throw new Error('存档格式不正确，无法导入。')
      }

      setApiConfig(restored.apiConfig)
      setContext(restored.context)
      setConceptInput(restored.conceptInput)
      setSendFullHistory(restored.sendFullHistory)
      setMessages(restored.messages)
      setInput('')
      setStreamingReply('')
      setError('')
    } catch (issue) {
      const reason = issue instanceof Error ? issue.message : '未知错误'
      setError(`导入失败: ${reason}`)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <main className="trpg-shell">
      <section className="control-panel">
        <h1>AI 跑团工作台</h1>
        <p className="sub">纯前端 Agent DM，支持设定生成、剧情对话、上下文变更与掷骰。</p>

        <div className="panel-block">
          <h2>API 设置</h2>
          <label>
            API Key
            <input
              type="password"
              value={apiConfig.apiKey}
              onChange={(event) => setApiConfig((current) => ({ ...current, apiKey: event.target.value }))}
              placeholder="sk-..."
            />
          </label>
          <label>
            Base URL
            <input
              type="text"
              value={apiConfig.baseUrl}
              onChange={(event) => setApiConfig((current) => ({ ...current, baseUrl: event.target.value }))}
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label>
            Model
            <input
              type="text"
              value={apiConfig.model}
              onChange={(event) => setApiConfig((current) => ({ ...current, model: event.target.value }))}
              placeholder="gpt-4o-mini"
            />
          </label>
          <label>
            接口格式
            <select
              value={apiConfig.format}
              onChange={(event) =>
                setApiConfig((current) => ({ ...current, format: event.target.value as ApiFormat }))
              }
            >
              <option value="completions">{renderApiModeLabel('completions')}</option>
              <option value="chat_completions">{renderApiModeLabel('chat_completions')}</option>
              <option value="responses">{renderApiModeLabel('responses')}</option>
            </select>
          </label>
          <div className="split">
            <label>
              Max Tokens
              <input
                type="number"
                min={128}
                max={4096}
                step={1}
                value={apiConfig.maxTokens ?? ''}
                disabled={apiConfig.maxTokens === null}
                placeholder={apiConfig.maxTokens === null ? '不限制' : undefined}
                onChange={(event) =>
                  setApiConfig((current) => ({
                    ...current,
                    maxTokens: normalizeMaxTokens(event.target.value),
                  }))
                }
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={apiConfig.maxTokens === null}
              onChange={(event) =>
                setApiConfig((current) => ({
                  ...current,
                  maxTokens: event.target.checked ? null : DEFAULT_CONFIG.maxTokens,
                }))
              }
            />
            Max Tokens 不限制
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={sendFullHistory}
              onChange={(event) => setSendFullHistory(event.target.checked)}
            />
            对话时携带完整历史记录
          </label>
        </div>

        <div className="panel-block">
          <h2>世界观生成</h2>
          <label>
            概念倾向
            <textarea
              value={conceptInput}
              onChange={(event) => setConceptInput(event.target.value)}
              placeholder="例如：赛博朋克 + 门派武学 + 家族政治"
              rows={3}
            />
          </label>
          <button type="button" onClick={generateWorld} disabled={worldBusy}>
            {worldBusy ? '生成中...' : '根据概念生成设定'}
          </button>
        </div>

        <div className="panel-block">
          <h2>设定编辑</h2>
          <label>
            背景上下文
            <textarea
              value={context.background}
              onChange={(event) => setContext((current) => ({ ...current, background: event.target.value }))}
              rows={5}
            />
          </label>
          <label>
            规则
            <textarea
              value={context.rules}
              onChange={(event) => setContext((current) => ({ ...current, rules: event.target.value }))}
              rows={5}
            />
          </label>
          <label>
            人物信息
            <textarea
              value={context.characters}
              onChange={(event) => setContext((current) => ({ ...current, characters: event.target.value }))}
              rows={5}
            />
          </label>
          <label>
            风格参考
            <textarea
              value={context.styleReference}
              onChange={(event) => setContext((current) => ({ ...current, styleReference: event.target.value }))}
              rows={4}
            />
          </label>
        </div>

        <div className="panel-block">
          <h2>存档管理</h2>
          <div className="split">
            <button type="button" onClick={exportArchive}>
              导出存档
            </button>
            <button type="button" className="ghost" onClick={() => importFileRef.current?.click()}>
              导入存档
            </button>
          </div>
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            onChange={importArchive}
            style={{ display: 'none' }}
          />
        </div>
      </section>

      <section className="chat-panel">
        <header>
          <div>
            <h2>剧情会话</h2>
            <p>{renderApiModeLabel(apiConfig.format)} · {sendFullHistory ? '全历史模式' : '短历史模式'}</p>
            <p>
              上下文 Token 估算: {contextTokenUsage.total}（设定 {contextTokenUsage.contextTokens} + 对话历史{' '}
              {contextTokenUsage.historyTokens}）
            </p>
          </div>
          <div className="header-actions">
            <button type="button" className="ghost" onClick={() => setShowContextPanel(true)}>
              查看上下文
            </button>
            <button
              type="button"
              onClick={() => {
                setMessages(INITIAL_MESSAGES)
                setError('')
              }}
              className="ghost"
            >
              清空聊天
            </button>
          </div>
        </header>

        <div className="messages" ref={messagesRef} onScroll={handleMessagesScroll}>
          {messages.map((message) => (
            <article key={message.id} className={`bubble ${message.role}`}>
              <span className="meta">
                {message.role === 'assistant' ? 'DM' : message.role === 'user' ? '你' : 'System'}
              </span>
              <MessageBody content={message.content} />
            </article>
          ))}
          {busy && streamingReply ? (
            <article className="bubble assistant streaming">
              <span className="meta">DM</span>
              <MessageBody content={streamingReply} />
            </article>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="composer">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onComposerKeyDown}
            rows={4}
            placeholder="输入你的行动，例如：我尝试说服守卫放行，并且观察他的眼神。"
          />
          <div className="actions">
            {error ? <span className="error">{error}</span> : <span>Agent 会在内部多轮处理后再回复你。</span>}
            <button type="submit" disabled={busy || !input.trim()}>
              {busy ? 'DM 思考中...' : '发送'}
            </button>
          </div>
        </form>
      </section>

      {showContextPanel ? (
        <div className="context-modal" role="dialog" aria-modal="true" aria-label="当前上下文快照">
          <button type="button" className="context-backdrop" onClick={() => setShowContextPanel(false)} aria-label="关闭" />
          <section className="context-card">
            <header>
              <div>
                <h3>当前上下文快照</h3>
                <p>设定 + 历史对话的完整文本，按 ESC 或点击外部可关闭。</p>
              </div>
              <button type="button" className="ghost" onClick={() => setShowContextPanel(false)}>
                关闭
              </button>
            </header>
            <pre>{contextPreview}</pre>
          </section>
        </div>
      ) : null}
    </main>
  )
}
