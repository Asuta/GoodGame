import { useEffect, useMemo, useRef, useState } from 'react'

import {
  applyEffects,
  createInitialGameState,
  evalChoiceCondition,
  reconcileGameState,
  resolveTriggeredEvents,
  type DailyAction,
  type GameConfig,
  type GameState,
  type NarrativeChoice,
  type StoryEvent,
} from '@/lib/gameCore'
import { canUseAiStory, generateActionStoryLines } from '@/lib/aiStory'

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

function packetFromAction(action: DailyAction, linesOverride?: string[]): DialoguePacket {
  const lines = linesOverride?.length ? linesOverride : action.narrative?.lines?.length ? action.narrative.lines : [action.flavor]
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

export function useGameRuntime(config: GameConfig) {
  const [game, setGame] = useState<GameState>(() => createInitialGameState(config))
  const [dialogue, setDialogue] = useState<DialogueState | null>(null)
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const aiAbortRef = useRef<AbortController | null>(null)
  const aiRequestIdRef = useRef(0)

  useEffect(() => {
    setGame((prev) => reconcileGameState(prev, config))
  }, [config])

  useEffect(() => {
    return () => {
      aiRequestIdRef.current += 1
      aiAbortRef.current?.abort()
    }
  }, [])

  const currentScene = useMemo(() => {
    return config.scenes.find((scene) => scene.id === game.currentSceneId) || config.scenes[0]
  }, [config.scenes, game.currentSceneId])

  const inPrologue = game.prologueIndex < config.prologue.length
  const isDialogueOpen = dialogue !== null
  const unlockedCount = game.unlockedEventIds.length
  const currentDialogueLine = dialogue ? dialogue.packet.lines[dialogue.lineIndex] : game.currentMessage
  const canShowChoices = dialogue ? dialogue.lineIndex >= dialogue.packet.lines.length - 1 && dialogue.packet.choices.length > 0 : false

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

  const handleDoAction = async (action: DailyAction) => {
    if (inPrologue || isDialogueOpen || isGeneratingNarrative || game.energy < action.cost) return

    const stats = applyEffects(game.stats, config, action.effects)
    const drafted = {
      ...game,
      energy: game.energy - action.cost,
      stats,
      currentMessage: action.flavor,
      currentSceneId: action.sceneId || game.currentSceneId,
      log: [...game.log, `Day ${game.day}: ${action.name}. ${action.flavor}`],
    }

    const resolved = resolveTriggeredEvents(drafted, config)
    const fallbackPackets = [packetFromAction(action), ...resolved.triggeredEvents.map(packetFromEvent)]

    if (!canUseAiStory(config)) {
      setAiError(null)
      setGame(resolved.state)
      openPackets(fallbackPackets)
      return
    }

    const requestId = aiRequestIdRef.current + 1
    aiRequestIdRef.current = requestId
    aiAbortRef.current?.abort()
    const controller = new AbortController()
    aiAbortRef.current = controller

    setAiError(null)
    setIsGeneratingNarrative(true)
    setGame({
      ...resolved.state,
      currentMessage: 'AI is drafting the next scene...',
    })

    try {
      const aiLines = await generateActionStoryLines({
        action,
        config,
        state: resolved.state,
        triggeredEvents: resolved.triggeredEvents,
        signal: controller.signal,
      })

      if (controller.signal.aborted || aiRequestIdRef.current !== requestId) return

      setGame((prev) => ({
        ...prev,
        log: [...prev.log, `AI scene: ${action.name}`],
      }))
      openPackets([packetFromAction(action, aiLines), ...resolved.triggeredEvents.map(packetFromEvent)])
    } catch (error) {
      if (controller.signal.aborted || aiRequestIdRef.current !== requestId) return

      const message = error instanceof Error ? error.message : 'AI narrative request failed.'
      setAiError(message)
      setGame({
        ...resolved.state,
        log: [...resolved.state.log, `AI fallback: ${message}`],
      })
      openPackets(fallbackPackets)
    } finally {
      if (aiRequestIdRef.current === requestId) {
        aiAbortRef.current = null
        setIsGeneratingNarrative(false)
      }
    }
  }

  const handleEndDay = () => {
    if (inPrologue || isDialogueOpen || isGeneratingNarrative) return

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
    aiRequestIdRef.current += 1
    aiAbortRef.current?.abort()
    aiAbortRef.current = null
    setIsGeneratingNarrative(false)
    setAiError(null)
    setDialogue(null)
    setGame(createInitialGameState(config))
  }

  return {
    game,
    currentScene,
    currentDialogueLine,
    canShowChoices,
    dialogue,
    inPrologue,
    isDialogueOpen,
    isGeneratingNarrative,
    aiError,
    unlockedCount,
    handleAdvancePrologue,
    handleDialogueChoice,
    handleDialogueNext,
    handleDoAction,
    handleEndDay,
    handleRestart,
  }
}
