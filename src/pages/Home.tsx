import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useGameConfig } from '@/hooks/useGameConfig'
import {
  applyEffects,
  clamp,
  createInitialGameState,
  evalChoiceCondition,
  reconcileGameState,
  resolveTriggeredEvents,
  type DailyAction,
  type GameState,
  type NarrativeChoice,
  type StoryEvent,
} from '@/lib/gameCore'

type DialoguePacket = {
  source: string
  sceneId?: string
  lines: string[]
  choices: NarrativeChoice[]
}

type DialogueState = {
  packet: DialoguePacket
  lineIndex: number
  pending: DialoguePacket[]
}

function PlaceholderVisual({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(232,220,196,0.25),transparent_40%),linear-gradient(130deg,#5f5146_0%,#2f2f36_45%,#1f2126_100%)] text-xs tracking-[0.3em] text-amber-100/75">
      {label}
    </div>
  )
}

function packetFromAction(action: DailyAction): DialoguePacket {
  const lines = action.narrative?.lines?.length ? action.narrative.lines : [action.flavor]
  return {
    source: `日常: ${action.name}`,
    sceneId: action.sceneId,
    lines,
    choices: action.narrative?.choices || [],
  }
}

function packetFromEvent(event: StoryEvent): DialoguePacket {
  const lines = event.narrative?.lines?.length ? event.narrative.lines : [event.description]
  return {
    source: `事件: ${event.title}`,
    sceneId: event.sceneId,
    lines,
    choices: event.narrative?.choices || [],
  }
}

export default function Home() {
  const { config, resetConfig } = useGameConfig()
  const [game, setGame] = useState<GameState>(() => createInitialGameState(config))
  const [dialogue, setDialogue] = useState<DialogueState | null>(null)

  useEffect(() => {
    setGame((prev) => reconcileGameState(prev, config))
  }, [config])

  const inPrologue = game.prologueIndex < config.prologue.length
  const isDialogueOpen = dialogue !== null

  const currentScene = useMemo(() => {
    return config.scenes.find((scene) => scene.id === game.currentSceneId) || config.scenes[0]
  }, [config.scenes, game.currentSceneId])

  const unlockedCount = game.unlockedEventIds.length

  const openPackets = (packets: DialoguePacket[]) => {
    if (!packets.length) return
    const [first, ...rest] = packets
    setDialogue({ packet: first, lineIndex: 0, pending: rest })
    setGame((prev) => ({
      ...prev,
      currentMessage: first.lines[0] || prev.currentMessage,
      currentSceneId: first.sceneId || prev.currentSceneId,
    }))
  }

  const closeDialogue = () => setDialogue(null)

  const jumpToPacket = (packet: DialoguePacket, pending: DialoguePacket[]) => {
    setDialogue({ packet, lineIndex: 0, pending })
    setGame((prev) => ({
      ...prev,
      currentMessage: packet.lines[0] || prev.currentMessage,
      currentSceneId: packet.sceneId || prev.currentSceneId,
    }))
  }

  const handleDialogueNext = () => {
    if (!dialogue) return

    const canAdvanceLine = dialogue.lineIndex < dialogue.packet.lines.length - 1
    if (canAdvanceLine) {
      const nextIndex = dialogue.lineIndex + 1
      setDialogue((prev) => (prev ? { ...prev, lineIndex: nextIndex } : prev))
      setGame((prev) => ({ ...prev, currentMessage: dialogue.packet.lines[nextIndex] || prev.currentMessage }))
      return
    }

    if (dialogue.packet.choices.length > 0) return

    if (dialogue.pending.length > 0) {
      const [nextPacket, ...rest] = dialogue.pending
      jumpToPacket(nextPacket, rest)
      return
    }

    closeDialogue()
  }

  const handleDialogueChoice = (choice: NarrativeChoice) => {
    if (!dialogue) return

    const passed = evalChoiceCondition(game.stats, choice)
    const lines = (passed ? choice.successLines : choice.failLines).length
      ? passed
        ? choice.successLines
        : choice.failLines
      : [passed ? '她给出了正面的回应。' : '她没有立刻回应。']

    setGame((prev) => {
      const effects = passed ? choice.successEffects : choice.failEffects
      const stats = applyEffects(prev.stats, config, effects)
      const text = lines[0] || prev.currentMessage
      return {
        ...prev,
        stats,
        currentMessage: text,
        log: [...prev.log, `对话分支: ${choice.label} (${passed ? '成功' : '失败'})`],
      }
    })

    jumpToPacket(
      {
        source: '分支结果',
        lines,
        choices: [],
      },
      dialogue.pending,
    )
  }

  const handleAdvancePrologue = () => {
    if (isDialogueOpen) return

    setGame((prev) => {
      if (prev.prologueIndex >= config.prologue.length) return prev
      const text = config.prologue[prev.prologueIndex]
      const next = {
        ...prev,
        prologueIndex: prev.prologueIndex + 1,
        currentMessage: text,
        log: [...prev.log, `序章: ${text}`],
      }

      if (next.prologueIndex >= config.prologue.length) {
        next.currentMessage = '序章结束。你可以安排今天的行动。'
        next.log.push('序章结束，进入日常循环。')
      }

      return next
    })
  }

  const handleDoAction = (action: DailyAction) => {
    if (inPrologue || isDialogueOpen) return

    if (game.energy < action.cost) return

    const stats = applyEffects(game.stats, config, action.effects)
    const drafted = {
      ...game,
      energy: game.energy - action.cost,
      stats,
      currentMessage: action.flavor,
      currentSceneId: action.sceneId || game.currentSceneId,
      log: [...game.log, `Day ${game.day}: ${action.name}。${action.flavor}`],
    }

    const resolved = resolveTriggeredEvents(drafted, config)
    setGame(resolved.state)
    openPackets([packetFromAction(action), ...resolved.triggeredEvents.map(packetFromEvent)])
  }

  const handleEndDay = () => {
    if (inPrologue || isDialogueOpen) return

    const drafted = {
      ...game,
      day: game.day + 1,
      energy: config.maxEnergy,
      currentMessage: `第 ${game.day} 天结束。新的一天开始了。`,
      dailyTriggeredEventIds: [],
      log: [...game.log, `第 ${game.day} 天结束。`],
    }

    const resolved = resolveTriggeredEvents(drafted, config)
    setGame(resolved.state)
    openPackets(resolved.triggeredEvents.map(packetFromEvent))
  }

  const handleRestart = () => {
    setDialogue(null)
    setGame(createInitialGameState(config))
  }

  const currentDialogueLine = dialogue ? dialogue.packet.lines[dialogue.lineIndex] : game.currentMessage
  const canShowChoices = dialogue ? dialogue.lineIndex >= dialogue.packet.lines.length - 1 && dialogue.packet.choices.length > 0 : false

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
          <button className="rounded-lg bg-amber-700 px-3 py-1.5 text-white" onClick={handleRestart}>
            重开试玩
          </button>
          <button className="rounded-lg bg-slate-200 px-3 py-1.5 text-slate-800" onClick={resetConfig}>
            还原模板
          </button>
        </div>
      </header>

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
          </div>

          <div className="bg-slate-950/95 p-4 text-slate-100">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Dialogue</p>
            {dialogue && <p className="mt-1 text-[11px] text-cyan-300/85">{dialogue.packet.source}</p>}
            <p className="mt-2 min-h-20 text-sm leading-7 text-slate-100">{currentDialogueLine || '...'}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {dialogue ? (
                canShowChoices ? (
                  dialogue.packet.choices.map((choice) => (
                    <button
                      key={choice.id}
                      className="rounded-lg border border-cyan-400/60 bg-slate-800 px-3 py-1.5 text-xs text-cyan-100 hover:bg-slate-700"
                      onClick={() => handleDialogueChoice(choice)}
                    >
                      {choice.label}
                    </button>
                  ))
                ) : (
                  <button className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold" onClick={handleDialogueNext}>
                    下一步
                  </button>
                )
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
                {game.energy}/{config.maxEnergy}
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
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-cyan-200">行动</p>

            {inPrologue ? (
              <button className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium disabled:opacity-40" disabled={isDialogueOpen} onClick={handleAdvancePrologue}>
                继续序章
              </button>
            ) : (
              <div className="space-y-2">
                {config.dailyActions.map((action) => (
                  <button
                    key={action.id}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/70 p-2 text-left transition hover:border-cyan-400 disabled:opacity-40"
                    disabled={game.energy < action.cost || isDialogueOpen}
                    onClick={() => handleDoAction(action)}
                  >
                    <p className="text-sm font-semibold text-cyan-50">
                      {action.name} · {action.cost}
                    </p>
                    <p className="text-xs text-slate-300">{action.description}</p>
                  </button>
                ))}

                <button className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium disabled:opacity-40" disabled={isDialogueOpen} onClick={handleEndDay}>
                  结束今天
                </button>
              </div>
            )}
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
