import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useGameConfig } from '@/hooks/useGameConfig'
import { useTypewriterText } from '@/hooks/useTypewriterText'
import { DEFAULT_CONFIG, clamp } from '@/lib/gameCore'
import { useGameRuntime } from '@/hooks/useGameRuntime'

function PlaceholderVisual({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(232,220,196,0.25),transparent_40%),linear-gradient(130deg,#5f5146_0%,#2f2f36_45%,#1f2126_100%)] text-xs tracking-[0.3em] text-amber-100/75">
      {label}
    </div>
  )
}

const TYPING_SPEED_OPTIONS = [
  { id: 'slow', label: '慢', delay: 48 },
  { id: 'normal', label: '中', delay: 32 },
  { id: 'fast', label: '快', delay: 18 },
] as const

const AUTO_PLAY_DELAY = 700

export default function Home() {
  const { config, setConfig, resetConfig } = useGameConfig()
  const [typingSpeedId, setTypingSpeedId] = useState<(typeof TYPING_SPEED_OPTIONS)[number]['id']>('normal')
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiLogOpen, setAiLogOpen] = useState(false)
  const {
    game,
    currentScene,
    currentDialogueLine,
    canShowChoices,
    canShowAiSuggestions,
    dialogue,
    inPrologue,
    isDialogueOpen,
    isGeneratingNarrative,
    aiError,
    nextAiRequestPreview,
    lastAiRequestPreview,
    unlockedCount,
    currentTimeSlot,
    remainingTimeSlots,
    maxEnergy,
    handleAdvancePrologue,
    handleAiIntent,
    handleDialogueChoice,
    handleDialogueNext,
    handleDoAction,
    handleDoNothing,
    handleRestart,
  } = useGameRuntime(config)
  const typingDelay = useMemo(() => TYPING_SPEED_OPTIONS.find((option) => option.id === typingSpeedId)?.delay ?? 32, [typingSpeedId])
  const { displayedText, isTyping, finishTyping } = useTypewriterText(currentDialogueLine || '', typingDelay)
  const aiModeEnabled = config.ai.enabled
  const customIntentFormKey = dialogue ? `${dialogue.packet.source}-${dialogue.packet.lines[0] || ''}` : 'idle'
  const isAiDialogueEnding = Boolean(
    dialogue &&
      dialogue.packet.aiSession &&
      dialogue.lineIndex >= dialogue.packet.lines.length - 1 &&
      dialogue.packet.aiSession.generatedLines.length >= dialogue.packet.aiSession.maxLines &&
      !canShowChoices &&
      !canShowAiSuggestions,
  )
  const dialogueButtonLabel = isGeneratingNarrative ? '\u751f\u6210\u4e2d...' : isAiDialogueEnding ? '\u7ed3\u675f\u5bf9\u8bdd' : isTyping ? '\u663e\u793a\u5168\u6587' : '\u4e0b\u4e00\u6b65'
  const visibleActions = useMemo(() => {
    if (!currentTimeSlot) return []
    return config.dailyActions.filter((action) => {
      if (!action.availableTimeSlotIds || action.availableTimeSlotIds.length === 0) return true
      return action.availableTimeSlotIds.includes(currentTimeSlot.id)
    })
  }, [config.dailyActions, currentTimeSlot])
  const setAiEnabled = (enabled: boolean) => {
    setConfig((prev) => ({ ...prev, ai: { ...prev.ai, enabled } }))
  }
  const restoreDefaultAiConfig = () => {
    setConfig((prev) => ({ ...prev, ai: { ...DEFAULT_CONFIG.ai } }))
  }

  const aiLogPanel = aiLogOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm" onClick={() => setAiLogOpen(false)}>
      <section
        className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950 text-slate-100 shadow-2xl shadow-cyan-950/30"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">AI Log</p>
            <h2 className="mt-1 text-lg font-semibold">AI context inspector</h2>
          </div>
          <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white" onClick={() => setAiLogOpen(false)} type="button">
            Close
          </button>
        </div>
        <div className="grid max-h-[calc(85vh-80px)] gap-4 overflow-auto p-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-cyan-400/20 bg-slate-900/80 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Next request</p>
            <p className="mt-1 text-sm text-slate-400">This is the next AI payload the game is preparing to send.</p>
            <pre className="mt-3 max-h-[58vh] overflow-auto rounded-xl bg-slate-950/80 p-4 text-xs leading-6 text-slate-200">
              {JSON.stringify(nextAiRequestPreview || { message: 'No pending AI request right now.' }, null, 2)}
            </pre>
          </section>
          <section className="rounded-2xl border border-emerald-400/20 bg-slate-900/80 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Last request</p>
            <p className="mt-1 text-sm text-slate-400">This is the most recent AI payload that was actually sent.</p>
            <pre className="mt-3 max-h-[58vh] overflow-auto rounded-xl bg-slate-950/80 p-4 text-xs leading-6 text-slate-200">
              {JSON.stringify(lastAiRequestPreview || { message: 'No AI request has been sent yet.' }, null, 2)}
            </pre>
          </section>
        </div>
      </section>
    </div>
  ) : null

  const settingsPanel = settingsOpen ? (
    <section className="mb-4 rounded-2xl border border-cyan-200/60 bg-white/88 p-4 shadow-lg shadow-cyan-100/40 backdrop-blur">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-700">Game Settings</p>
          <h2 className="text-lg font-semibold text-slate-900">试玩设置</h2>
        </div>
        <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={() => setSettingsOpen(false)} type="button">
          收起设置
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-700">AI Mode</p>
            <h3 className="mt-1 text-base font-semibold text-slate-900">{aiModeEnabled ? 'AI 模式已开启' : 'AI 模式已关闭'}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {aiModeEnabled ? '行动后会请求模型续写剧情并结算互动结果。' : '行动会回退到预设脚本，不会发送 AI 请求。'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                aiModeEnabled ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
              onClick={() => setAiEnabled(true)}
              type="button"
            >
              开启 AI 模式
            </button>
            <button
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                aiModeEnabled ? 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50' : 'bg-slate-900 text-white shadow-md shadow-slate-200'
              }`}
              onClick={() => setAiEnabled(false)}
              type="button"
            >
              关闭 AI 模式
            </button>
            <button
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              onClick={restoreDefaultAiConfig}
              type="button"
            >
              恢复默认 AI 配置
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          <span className="font-medium">API format</span>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={config.ai.apiMode}
            onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, apiMode: e.target.value as typeof prev.ai.apiMode } }))}
          >
            <option value="chat-completions">Chat Completions</option>
            <option value="responses">Responses</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          <span className="font-medium">Base URL</span>
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={config.ai.apiBaseUrl}
            onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, apiBaseUrl: e.target.value } }))}
            placeholder="https://your-api.example.com/v1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          <span className="font-medium">Model name</span>
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={config.ai.model}
            onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, model: e.target.value } }))}
            placeholder="gpt-5.4"
          />
        </label>


        <label className="flex flex-col gap-1 text-sm text-slate-700">
          <span className="font-medium">Reasoning effort</span>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={config.ai.reasoningEffort}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                ai: { ...prev.ai, reasoningEffort: e.target.value as typeof prev.ai.reasoningEffort },
              }))
            }
          >
            <option value="default">Model default</option>
            <option value="none">Off / no reasoning</option>
            <option value="minimal">Minimal</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="xhigh">Extra high</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          <span className="font-medium">Max AI turns</span>
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            type="number"
            min={1}
            max={8}
            value={config.ai.maxLines}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                ai: { ...prev.ai, maxLines: Math.max(1, Math.min(8, Math.round(Number(e.target.value) || 1))) },
              }))
            }
          />
        </label>

        <label className="md:col-span-2 flex flex-col gap-1 text-sm text-slate-700">
          <span className="font-medium">API Key</span>
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={config.ai.apiKey}
            onChange={(e) => setConfig((prev) => ({ ...prev, ai: { ...prev.ai, apiKey: e.target.value } }))}
            placeholder="sk-..."
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-slate-500">这些值会保存在当前浏览器中。启用 AI 模式后，会使用这里配置的模型参数继续生成剧情。</p>
    </section>
  ) : null

  useEffect(() => {
    if (!autoPlayEnabled || isTyping) return

    if (dialogue) {
      if (canShowChoices || canShowAiSuggestions) return
      const timer = window.setTimeout(() => {
        handleDialogueNext()
      }, AUTO_PLAY_DELAY)
      return () => window.clearTimeout(timer)
    }

    if (!inPrologue) return

    const timer = window.setTimeout(() => {
      handleAdvancePrologue()
    }, AUTO_PLAY_DELAY)

    return () => window.clearTimeout(timer)
  }, [autoPlayEnabled, canShowAiSuggestions, canShowChoices, dialogue, handleAdvancePrologue, handleDialogueNext, inPrologue, isTyping])

  const handleDialoguePanelClick = () => {
    if (isTyping) {
      finishTyping()
      return
    }

    if (dialogue) {
      if (!canShowChoices) handleDialogueNext()
      return
    }

    if (inPrologue) handleAdvancePrologue()
  }

  const actionPanel = (
    <div className="absolute bottom-4 right-4 z-20 w-[min(360px,calc(100%-2rem))] rounded-2xl border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(6,16,34,0.9),rgba(2,10,24,0.92))] p-2.5 shadow-[0_18px_36px_rgba(2,6,23,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur md:bottom-5 md:right-5 md:w-[340px]">
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />

      <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/90">行动安排</p>
          <p className="text-[11px] text-slate-400">{aiModeEnabled ? `AI 模式 - ${config.ai.apiMode === 'responses' ? 'Responses' : 'Chat Completions'}` : '静态剧情模式'}</p>
        </div>
        {!inPrologue && (
          <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {currentTimeSlot ? currentTimeSlot.label : '今日结束'}
          </div>
        )}
      </div>

      {inPrologue ? (
        <button
          className="w-full rounded-xl border border-cyan-300/25 bg-cyan-500/85 px-3 py-2 text-sm font-medium text-white shadow-[0_8px_18px_rgba(6,182,212,0.22)] transition hover:bg-cyan-400 disabled:opacity-40"
          disabled={isDialogueOpen || isGeneratingNarrative}
          onClick={handleAdvancePrologue}
        >
          继续序章
        </button>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleActions.map((action) => (
            <button
              key={action.id}
              className="group rounded-xl border border-slate-700/80 bg-[linear-gradient(180deg,rgba(18,32,58,0.86),rgba(10,20,39,0.9))] p-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:-translate-y-0.5 hover:border-cyan-400/70 hover:bg-[linear-gradient(180deg,rgba(20,40,72,0.92),rgba(12,24,46,0.95))] disabled:opacity-40"
              disabled={game.energy < action.cost || isDialogueOpen || isGeneratingNarrative || !currentTimeSlot}
              onClick={() => handleDoAction(action)}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-cyan-50 transition group-hover:text-white">{action.name}</p>
                <span className="rounded-full border border-cyan-400/20 bg-slate-950/70 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                  {action.cost}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-4.5 text-slate-300">{action.description}</p>
            </button>
          ))}

          {visibleActions.length === 0 && currentTimeSlot ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-3 py-3 text-xs text-slate-400 sm:col-span-2">
              {'\u8fd9\u4e2a\u65f6\u6bb5\u6ca1\u6709\u53ef\u6267\u884c\u7684\u9884\u8bbe\u884c\u52a8\uff0c\u53ef\u4ee5\u8ba9\u5979\u81ea\u5df1\u5ea6\u8fc7\u8fd9\u6bb5\u65f6\u95f4\u3002'}
            </div>
          ) : null}
          <button
            className="rounded-xl border border-amber-400/20 bg-[linear-gradient(180deg,#f59e0b,#d97706)] px-3 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(217,119,6,0.28)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-40 sm:col-span-2"
            disabled={isDialogueOpen || isGeneratingNarrative || !currentTimeSlot}
            onClick={handleDoNothing}
          >
            什么都不做
          </button>
        </div>
      )}
    </div>
  )

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-3 py-4 md:px-6 md:py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-300/40 bg-white/60 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Play Window</p>
          <h1 className="text-xl font-semibold text-slate-800">{config.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link className="rounded-lg bg-slate-900 px-3 py-1.5 text-white" to="/editor">
            打开编辑器
          </Link>
          <a className="rounded-lg bg-slate-700 px-3 py-1.5 text-white" href="/editor" rel="noreferrer" target="_blank">
            新窗口编辑
          </a>
          <button className="rounded-lg bg-slate-700 px-3 py-1.5 text-white" onClick={() => setAiLogOpen(true)} type="button">
            AI log
          </button>
          <button className="rounded-lg bg-cyan-700 px-3 py-1.5 text-white" onClick={() => setSettingsOpen((prev) => !prev)} type="button">
            {settingsOpen ? '收起设置' : '游戏设置'}
          </button>
          <button className="rounded-lg bg-amber-700 px-3 py-1.5 text-white" onClick={handleRestart}>
            重开试玩
          </button>
          <button className="rounded-lg bg-slate-200 px-3 py-1.5 text-slate-800" onClick={resetConfig}>
            还原模板
          </button>
        </div>
      </header>

      {settingsPanel}
      {aiLogPanel}

      <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <article className="overflow-hidden rounded-2xl border border-slate-900/30 bg-slate-950 shadow-2xl shadow-slate-900/35">
          <div className="relative aspect-[16/10] w-full border-b border-slate-700/60 bg-slate-900">
            {currentScene?.backgroundUrl ? (
              <img alt="scene background" className="h-full w-full object-cover" src={currentScene.backgroundUrl} />
            ) : (
              <PlaceholderVisual label="BACKGROUND" />
            )}

            <div className="pointer-events-none absolute inset-x-[8%] bottom-0 top-[18%] flex items-end justify-center">
              <div className="h-full max-h-[95%] w-[58%]">
                {currentScene?.characterUrl ? (
                  <img alt="character" className="h-full w-full object-contain object-bottom" src={currentScene.characterUrl} />
                ) : (
                  <PlaceholderVisual label="CHARACTER" />
                )}
              </div>
            </div>

            <div className="absolute left-4 top-4 rounded-md bg-black/45 px-2 py-1 text-xs tracking-[0.2em] text-amber-100/90">
              SCENE: {currentScene?.name || '未命名场景'}
            </div>

            {!inPrologue ? (
              <div className="pointer-events-none absolute right-4 top-4 z-20 flex gap-2 md:right-5 md:top-5">
                {config.timeSlots.map((slot, index) => {
                  const isPast = index < game.timeSlotIndex
                  const isCurrent = index === game.timeSlotIndex && remainingTimeSlots > 0
                  const isFuture = index > game.timeSlotIndex
                  return (
                    <div
                      key={slot.id}
                      className={`min-w-16 rounded-2xl border px-3 py-2 text-center shadow-lg backdrop-blur ${
                        isCurrent
                          ? 'border-cyan-300/70 bg-cyan-400/25 text-cyan-50'
                          : isPast
                            ? 'border-slate-700/80 bg-slate-950/70 text-slate-500'
                            : isFuture
                              ? 'border-slate-500/50 bg-slate-900/70 text-slate-200'
                              : 'border-slate-700/80 bg-slate-950/70 text-slate-500'
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-[0.24em]">Time</p>
                      <p className="mt-1 text-lg font-semibold">{slot.label}</p>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {!isDialogueOpen && actionPanel}
          </div>

          <div className="bg-slate-950/95 p-4 text-slate-100">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Dialogue</p>
                {dialogue && <p className="mt-1 text-[11px] text-cyan-300/85">{dialogue.packet.source}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 p-1">
                  {TYPING_SPEED_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      className={`rounded-full px-2 py-1 transition ${typingSpeedId === option.id ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        setTypingSpeedId(option.id)
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  className={`rounded-full border px-2.5 py-1 transition ${autoPlayEnabled ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800'}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setAutoPlayEnabled((prev) => !prev)
                  }}
                  type="button"
                >
                  自动播放 {autoPlayEnabled ? '开' : '关'}
                </button>
              </div>
            </div>

            <button
              className="mt-2 block min-h-20 w-full rounded-xl text-left text-sm leading-7 text-slate-100 transition hover:bg-slate-900/50 focus:outline-none"
              onClick={handleDialoguePanelClick}
              type="button"
            >
              <span>{displayedText}</span>
              {isTyping && <span className="ml-0.5 inline-block h-[1em] w-[0.55em] animate-pulse rounded-sm bg-cyan-300/80 align-[-0.1em]" aria-hidden="true" />}
            </button>

            <div className="mt-3 flex flex-wrap gap-2">
              {dialogue ? (
                isGeneratingNarrative ? (
                  <p className="text-xs text-cyan-200">AI is generating the next line...</p>
                ) : canShowChoices && !isTyping ? (
                  dialogue.packet.choices.map((choice) => (
                    <button
                      key={choice.id}
                      className="rounded-lg border border-cyan-400/60 bg-slate-800 px-3 py-1.5 text-xs text-cyan-100 hover:bg-slate-700"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleDialogueChoice(choice)
                      }}
                      type="button"
                    >
                      {choice.label}
                    </button>
                  ))
                ) : canShowAiSuggestions && !isTyping ? (
                  <>
                    {(dialogue.packet.aiSuggestions || []).map((choice) => (
                      <button
                        key={choice}
                        className="rounded-lg border border-cyan-400/60 bg-slate-800 px-3 py-1.5 text-xs text-cyan-100 hover:bg-slate-700"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleAiIntent(choice)
                        }}
                        type="button"
                      >
                        {choice}
                      </button>
                    ))}
                    <form
                      key={customIntentFormKey}
                      className="flex min-w-[260px] flex-1 gap-2"
                      onClick={(event) => event.stopPropagation()}
                      onSubmit={(event) => {
                        event.preventDefault()
                        const formData = new FormData(event.currentTarget)
                        const value = String(formData.get('customIntent') || '').trim()
                        if (!value) return
                        void handleAiIntent(value)
                        event.currentTarget.reset()
                      }}
                    >
                      <input
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400"
                        defaultValue=""
                        name="customIntent"
                        placeholder={'\u8f93\u5165\u4f60\u60f3\u505a\u7684\u4e8b...'}
                        type="text"
                      />
                      <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white" type="submit">
                        {'\u53d1\u9001'}
                      </button>
                    </form>
                  </>
                ) : (
                  <button
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isGeneratingNarrative}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (isTyping) {
                        finishTyping()
                        return
                      }
                      handleDialogueNext()
                    }}
                    type="button"
                  >
                    {dialogueButtonLabel}
                  </button>
                )
              ) : isGeneratingNarrative ? (
                <p className="text-xs text-cyan-200">AI is generating a fresh story beat...</p>
              ) : aiError ? (
                <p className="text-xs text-amber-200">AI request failed, static narrative restored: {aiError}</p>
              ) : (
                <p className="text-xs text-slate-400">{config.subtitle}</p>
              )}
            </div>

          </div>
        </article>

        <aside className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/95 p-4 text-slate-100 shadow-2xl shadow-slate-900/30">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-slate-800/90 p-2">
              <p className="text-xs text-slate-400">DAY</p>
              <p className="font-semibold">{game.day}</p>
            </div>
            <div className="rounded-lg bg-slate-800/90 p-2">
              <p className="text-xs text-slate-400">行动力</p>
              <p className="font-semibold">
                {remainingTimeSlots}/{maxEnergy}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/90 p-2">
              <p className="text-xs text-slate-400">事件</p>
              <p className="font-semibold">{unlockedCount}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/60 p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-cyan-200">属性状态</p>
            <div className="space-y-2">
              {config.stats.map((stat) => {
                const current = game.stats[stat.id] ?? 0
                const ratio = ((current - stat.min) / Math.max(1, stat.max - stat.min)) * 100
                return (
                  <div key={stat.id}>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                      <span>{stat.name}</span>
                      <span>{current}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-slate-800">
                      <div className="h-full bg-cyan-400" style={{ width: `${clamp(ratio, 0, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>


          <div className="rounded-xl border border-slate-700/60 p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-cyan-200">日志</p>
            <div className="max-h-44 space-y-1 overflow-y-auto text-xs text-slate-300">
              {game.log
                .slice()
                .reverse()
                .slice(0, 20)
                .map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}
