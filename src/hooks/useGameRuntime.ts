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
import { canUseAiStory, evaluateActionInteraction, generateActionStoryTurn } from '@/lib/aiStory'

type AiDialogueSession = {
  action: DailyAction
  state: GameState
  generatedLines: string[]
  playerIntents: string[]
  maxLines: number
}

type DialoguePacket = {
  source: string
  sceneId?: string
  lines: string[]
  choices: NarrativeChoice[]
  aiSession?: AiDialogueSession
  aiSuggestions?: string[]
}

type DialogueState = {
  packet: DialoguePacket
  lineIndex: number
  pending: DialoguePacket[]
}

const AI_REQUEST_TIMEOUT_MS = 20000

function packetFromAction(
  action: DailyAction,
  linesOverride?: string[],
  aiSession?: AiDialogueSession,
  aiSuggestions?: string[],
): DialoguePacket {
  const lines = linesOverride?.length ? linesOverride : action.narrative?.lines?.length ? action.narrative.lines : [action.flavor]
  return {
    source: `日常: ${action.name}`,
    sceneId: action.sceneId,
    lines,
    choices: aiSession ? [] : action.narrative?.choices || [],
    aiSession,
    aiSuggestions,
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
  const currentDialogueLine = isGeneratingNarrative ? game.currentMessage : dialogue ? dialogue.packet.lines[dialogue.lineIndex] : game.currentMessage
  const canShowChoices = dialogue ? dialogue.lineIndex >= dialogue.packet.lines.length - 1 && dialogue.packet.choices.length > 0 : false
  const canShowAiSuggestions =
    dialogue ? dialogue.lineIndex >= dialogue.packet.lines.length - 1 && (dialogue.packet.aiSuggestions?.length || 0) > 0 : false

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

  const closeDialogue = () => {
    setDialogue(null)
    setGame((prev) => ({ ...prev, currentMessage: '' }))
  }

  const jumpToPacket = (packet: DialoguePacket, pending: DialoguePacket[]) => {
    setDialogue({ packet, lineIndex: 0, pending })
    setGame((prev) => ({
      ...prev,
      currentMessage: packet.lines[0] || prev.currentMessage,
      currentSceneId: packet.sceneId || prev.currentSceneId,
    }))
  }

  const finishDialogue = (pending: DialoguePacket[]) => {
    if (pending.length > 0) {
      const [nextPacket, ...rest] = pending
      jumpToPacket(nextPacket, rest)
      return
    }

    closeDialogue()
  }

  const startAiRequest = () => {
    const requestId = aiRequestIdRef.current + 1
    aiRequestIdRef.current = requestId
    aiAbortRef.current?.abort()
    const controller = new AbortController()
    let timedOut = false
    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, AI_REQUEST_TIMEOUT_MS)
    aiAbortRef.current = controller
    setAiError(null)
    setIsGeneratingNarrative(true)
    return { controller, requestId, timeoutId, wasTimedOut: () => timedOut }
  }

  const finishAiRequest = (requestId: number, timeoutId: number) => {
    window.clearTimeout(timeoutId)
    if (aiRequestIdRef.current === requestId) {
      aiAbortRef.current = null
      setIsGeneratingNarrative(false)
    }
  }

  const requestAiTurn = async (session: AiDialogueSession, playerIntent?: string) => {
    const { controller, requestId, timeoutId, wasTimedOut } = startAiRequest()

    try {
      const turn = await generateActionStoryTurn({
        action: session.action,
        config,
        state: session.state,
        triggeredEvents: [],
        previousLines: session.generatedLines,
        playerIntent,
        signal: controller.signal,
      })

      if (controller.signal.aborted || aiRequestIdRef.current !== requestId) return null
      return turn
    } catch (error) {
      if (controller.signal.aborted && !wasTimedOut()) return null
      if (aiRequestIdRef.current !== requestId) return null
      const message = wasTimedOut() ? 'AI response timed out. Switched back to fallback flow.' : error instanceof Error ? error.message : 'AI narrative request failed.'
      setAiError(message)
      setGame((prev) => ({
        ...prev,
        log: [...prev.log, `AI fallback: ${message}`],
      }))
      return null
    } finally {
      finishAiRequest(requestId, timeoutId)
    }
  }

  const requestAiEvaluation = async (session: AiDialogueSession) => {
    const { controller, requestId, timeoutId, wasTimedOut } = startAiRequest()

    try {
      const evaluation = await evaluateActionInteraction({
        action: session.action,
        config,
        state: {
          ...session.state,
          log: game.log,
          currentMessage: game.currentMessage,
        },
        generatedLines: session.generatedLines,
        playerIntents: session.playerIntents,
        signal: controller.signal,
      })

      if (controller.signal.aborted || aiRequestIdRef.current !== requestId) return null
      return evaluation
    } catch (error) {
      if (controller.signal.aborted && !wasTimedOut()) return null
      if (aiRequestIdRef.current !== requestId) return null
      const message = wasTimedOut() ? 'AI evaluation timed out. No stat changes were applied.' : error instanceof Error ? error.message : 'AI interaction evaluation failed.'
      setAiError(message)
      setGame((prev) => ({
        ...prev,
        log: [...prev.log, `AI evaluation fallback: ${message}`],
      }))
      return null
    } finally {
      finishAiRequest(requestId, timeoutId)
    }
  }

  const finalizeAiDialogue = async (session: AiDialogueSession, pending: DialoguePacket[]) => {
    setGame((prev) => ({ ...prev, currentMessage: 'AI is evaluating the interaction...' }))
    const evaluation = await requestAiEvaluation(session)
    const effects = evaluation?.effects || []
    const statNames = new Map(config.stats.map((stat) => [stat.id, stat.name]))
    const effectSummary = effects.length
      ? effects.map((effect) => `${statNames.get(effect.statId) || effect.statId} ${effect.delta > 0 ? '+' : ''}${effect.delta}`).join('，')
      : '无明显变化'
    const summary = evaluation?.summary?.trim()

    const draft = {
      ...game,
      stats: applyEffects(game.stats, config, effects),
      log: [
        ...game.log,
        summary ? `AI结算: ${effectSummary}。${summary}` : `AI结算: ${effectSummary}`,
      ],
    }

    const resolved = resolveTriggeredEvents(draft, config)
    setGame(resolved.state)

    if (resolved.triggeredEvents.length > 0) {
      openPackets([...resolved.triggeredEvents.map(packetFromEvent), ...pending])
      return
    }

    finishDialogue(pending)
  }

  const handleDialogueNext = async () => {
    if (!dialogue || isGeneratingNarrative) return

    const canAdvanceLine = dialogue.lineIndex < dialogue.packet.lines.length - 1
    if (canAdvanceLine) {
      const nextIndex = dialogue.lineIndex + 1
      setDialogue((prev) => (prev ? { ...prev, lineIndex: nextIndex } : prev))
      setGame((prev) => ({ ...prev, currentMessage: dialogue.packet.lines[nextIndex] || prev.currentMessage }))
      return
    }

    if (dialogue.packet.choices.length > 0 || (dialogue.packet.aiSuggestions?.length || 0) > 0) return

    if (dialogue.packet.aiSession) {
      await finalizeAiDialogue(dialogue.packet.aiSession, dialogue.pending)
      return
    }

    finishDialogue(dialogue.pending)
  }

  const cancelAiNarrative = () => {
    aiRequestIdRef.current += 1
    aiAbortRef.current?.abort()
    aiAbortRef.current = null
    setIsGeneratingNarrative(false)
    setAiError('AI generation canceled. You can continue playing.')

    if (!dialogue?.packet.aiSession) return

    setGame((prev) => ({
      ...prev,
      log: [...prev.log, 'AI generation canceled by player.'],
    }))
    finishDialogue(dialogue.pending)
  }

  const handleAiIntent = async (intent: string) => {
    if (!dialogue || !dialogue.packet.aiSession || isGeneratingNarrative) return

    const session = dialogue.packet.aiSession
    if (session.generatedLines.length >= session.maxLines) {
      await finalizeAiDialogue(session, dialogue.pending)
      return
    }

    setGame((prev) => ({
      ...prev,
      currentMessage: 'AI is drafting the next line...',
      log: [...prev.log, `玩家决定: ${intent}`],
    }))

    const turn = await requestAiTurn(session, intent)
    if (!turn) {
      finishDialogue(dialogue.pending)
      return
    }

    const nextSession: AiDialogueSession = {
      ...session,
      generatedLines: [...session.generatedLines, turn.line],
      playerIntents: [...session.playerIntents, intent],
    }

    const nextSuggestions = nextSession.generatedLines.length >= nextSession.maxLines ? [] : turn.choices
    jumpToPacket(packetFromAction(session.action, [turn.line], nextSession, nextSuggestions), dialogue.pending)
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

    const baseDraft = {
      ...game,
      energy: game.energy - action.cost,
      currentMessage: action.flavor,
      currentSceneId: action.sceneId || game.currentSceneId,
      log: [...game.log, `Day ${game.day}: ${action.name}. ${action.flavor}`],
    }

    const scriptedDraft = {
      ...baseDraft,
      stats: applyEffects(baseDraft.stats, config, action.effects),
    }
    const scriptedResolved = resolveTriggeredEvents(scriptedDraft, config)
    const fallbackPackets = [packetFromAction(action), ...scriptedResolved.triggeredEvents.map(packetFromEvent)]

    if (!canUseAiStory(config)) {
      setAiError(null)
      setGame(scriptedResolved.state)
      openPackets(fallbackPackets)
      return
    }

    setGame({
      ...baseDraft,
      currentMessage: 'AI is drafting the next line...',
    })

    const baseSession: AiDialogueSession = {
      action,
      state: baseDraft,
      generatedLines: [],
      playerIntents: [],
      maxLines: Math.max(1, config.ai.maxLines),
    }

    const turn = await requestAiTurn(baseSession)
    if (!turn) {
      setGame(scriptedResolved.state)
      openPackets(fallbackPackets)
      return
    }

    setGame({
      ...baseDraft,
      log: [...baseDraft.log, `AI scene: ${action.name}`],
      currentMessage: turn.line,
    })

    const session: AiDialogueSession = {
      ...baseSession,
      generatedLines: [turn.line],
    }

    const suggestions = session.generatedLines.length >= session.maxLines ? [] : turn.choices
    openPackets([packetFromAction(action, [turn.line], session, suggestions)])
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
    canShowAiSuggestions,
    dialogue,
    inPrologue,
    isDialogueOpen,
    isGeneratingNarrative,
    aiError,
    unlockedCount,
    handleAdvancePrologue,
    handleAiIntent,
    cancelAiNarrative,
    handleDialogueChoice,
    handleDialogueNext,
    handleDoAction,
    handleEndDay,
    handleRestart,
  }
}
