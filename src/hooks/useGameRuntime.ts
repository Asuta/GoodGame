import { useEffect, useMemo, useRef, useState } from 'react'

import {
  applyEffects,
  createInitialGameState,
  evalChoiceCondition,
  getMaxEnergyForConfig,
  reconcileGameState,
  resolveTriggeredEvents,
  type DailyAction,
  type GameConfig,
  type GameState,
  type NarrativeChoice,
  type StoryEvent,
} from '@/lib/gameCore'
import {
  buildActionStoryTurnPreview,
  buildDailyDiaryPreview,
  buildFreeTimeStoryPreview,
  buildInteractionEvaluationPreview,
  canUseAiStory,
  evaluateActionInteraction,
  generateDailyDiary,
  generateFreeTimeStory,
  generateActionStoryTurn,
  type AiRequestPreview,
} from '@/lib/aiStory'

type AiDialogueSession = {
  action: DailyAction
  state: GameState
  generatedLines: string[]
  playerIntents: string[]
  displayTimeSlotIndex: number
}

type DialoguePacket = {
  source: string
  sceneId?: string
  lines: string[]
  choices: NarrativeChoice[]
  aiSession?: AiDialogueSession
  aiSuggestions?: string[]
  displayTimeSlotIndex?: number
}

type DialogueState = {
  packet: DialoguePacket
  lineIndex: number
  pending: DialoguePacket[]
}

const AI_REQUEST_TIMEOUT_MS = 20000

function summarizeDiaryFromDay(state: GameState, config: GameConfig) {
  const recentMoments = state.currentDayLog.slice(-4)
  const statSummary = config.stats
    .map((stat) => ({ name: stat.name, value: state.stats[stat.id] ?? stat.defaultValue }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 2)
    .map((stat) => `${stat.name}${stat.value}`)
    .join('，')

  const eventText = recentMoments.length > 0 ? recentMoments.join('；') : '今天好像没有发生什么特别大的事。'
  return `今天是第${state.day}天。${eventText} 她把这些片段悄悄记了下来，心里反复想着自己是不是已经比昨天更敢相信你一点。现在最明显的情绪大概是${statSummary || '复杂难明'}，她也提醒自己，明天要再小心一点，但也想试着向前走一小步。`
}

function packetFromAction(
  action: DailyAction,
  linesOverride?: string[],
  aiSession?: AiDialogueSession,
  aiSuggestions?: string[],
  displayTimeSlotIndex?: number,
): DialoguePacket {
  const lines = linesOverride?.length ? linesOverride : action.narrative?.lines?.length ? action.narrative.lines : [action.flavor]
  return {
    source: `日常: ${action.name}`,
    sceneId: action.sceneId,
    lines,
    choices: aiSession ? [] : action.narrative?.choices || [],
    aiSession,
    aiSuggestions,
    displayTimeSlotIndex: aiSession?.displayTimeSlotIndex ?? displayTimeSlotIndex,
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

function createFreeTimeAction(config: GameConfig, state: GameState): DailyAction {
  const currentTimeSlot = state.timeSlotIndex >= config.timeSlots.length ? null : config.timeSlots[state.timeSlotIndex] || null
  const slotLabel = currentTimeSlot?.label || '这个时间'

  return {
    id: `idle-${state.day}-${state.timeSlotIndex}`,
    name: '什么都不做',
    description: '你没有安排任何行动，她会自己度过这段时间。',
    cost: 1,
    flavor: `${slotLabel}里，你没有特别安排，她安静地按自己的想法度过了这段时间。`,
    sceneId: state.currentSceneId,
    availableTimeSlotIds: currentTimeSlot ? [currentTimeSlot.id] : undefined,
    effects: [],
    narrative: {
      lines: [`${slotLabel}里，你没有特别安排，她安静地按自己的想法度过了这段时间。`],
      choices: [],
    },
  }
}

export function useGameRuntime(config: GameConfig) {
  const [game, setGame] = useState<GameState>(() => createInitialGameState(config))
  const [dialogue, setDialogue] = useState<DialogueState | null>(null)
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [lastAiRequestPreview, setLastAiRequestPreview] = useState<AiRequestPreview | null>(null)
  const [displayTimeSlotIndexOverride, setDisplayTimeSlotIndexOverride] = useState<number | null>(null)
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
  const maxEnergy = useMemo(() => getMaxEnergyForConfig(config), [config])
  const displayTimeSlotIndex = displayTimeSlotIndexOverride ?? dialogue?.packet.displayTimeSlotIndex ?? game.timeSlotIndex
  const remainingTimeSlots = Math.max(0, maxEnergy - displayTimeSlotIndex)
  const currentTimeSlot = displayTimeSlotIndex >= maxEnergy ? null : config.timeSlots[displayTimeSlotIndex] || null

  const inPrologue = game.prologueIndex < config.prologue.length
  const isDialogueOpen = dialogue !== null
  const unlockedCount = game.unlockedEventIds.length
  const currentDialogueLine = isGeneratingNarrative ? game.currentMessage : dialogue ? dialogue.packet.lines[dialogue.lineIndex] : game.currentMessage
  const canShowChoices = dialogue ? dialogue.lineIndex >= dialogue.packet.lines.length - 1 && dialogue.packet.choices.length > 0 : false
  const canShowAiSuggestions =
    dialogue ? dialogue.lineIndex >= dialogue.packet.lines.length - 1 && (dialogue.packet.aiSuggestions?.length || 0) > 0 : false

  const nextAiRequestPreview = useMemo(() => {
    const session = dialogue?.packet.aiSession
    if (!session) return null

    return buildActionStoryTurnPreview({
      action: session.action,
      config,
      state: session.state,
      triggeredEvents: [],
      previousLines: session.generatedLines,
      playerIntent: '__WAITING_FOR_PLAYER_INTENT__',
    })
  }, [config, dialogue])

  const openPackets = (packets: DialoguePacket[]) => {
    if (!packets.length) return
    const [first, ...rest] = packets
    setDisplayTimeSlotIndexOverride(first.displayTimeSlotIndex ?? null)
    setDialogue({ packet: first, lineIndex: 0, pending: rest })
    setGame((prev) => ({
      ...prev,
      currentMessage: first.lines[0] || prev.currentMessage,
      currentSceneId: first.sceneId || prev.currentSceneId,
    }))
  }

  const closeDialogue = () => {
    setDisplayTimeSlotIndexOverride(null)
    setDialogue(null)
    setGame((prev) => ({ ...prev, currentMessage: '' }))
  }

  const jumpToPacket = (packet: DialoguePacket, pending: DialoguePacket[]) => {
    setDisplayTimeSlotIndexOverride(packet.displayTimeSlotIndex ?? null)
    setDialogue({ packet, lineIndex: 0, pending })
    setGame((prev) => ({
      ...prev,
      currentMessage: packet.lines[0] || prev.currentMessage,
      currentSceneId: packet.sceneId || prev.currentSceneId,
    }))
  }

  const buildDiaryFallback = (state: GameState) => ({ content: summarizeDiaryFromDay(state, config) })

  const requestDailyDiary = async (state: GameState) => {
    if (!state.currentDayLog.length) return buildDiaryFallback(state)
    if (!canUseAiStory(config)) return buildDiaryFallback(state)

    const preview = buildDailyDiaryPreview({ config, state })
    setLastAiRequestPreview(preview)
    const { controller, requestId, timeoutId, wasTimedOut } = startAiRequest()

    try {
      const diary = await generateDailyDiary({
        config,
        state,
        signal: controller.signal,
      })

      if (controller.signal.aborted || aiRequestIdRef.current !== requestId) return null
      return diary
    } catch (error) {
      if (controller.signal.aborted && !wasTimedOut()) return null
      if (aiRequestIdRef.current !== requestId) return null
      const message = wasTimedOut() ? 'AI diary timed out. Switched back to fallback diary.' : error instanceof Error ? error.message : 'AI diary generation failed.'
      setAiError(message)
      setGame((prev) => ({
        ...prev,
        log: [...prev.log, `AI diary fallback: ${message}`],
      }))
      return buildDiaryFallback(state)
    } finally {
      finishAiRequest(requestId, timeoutId)
    }
  }

  const finishDialogue = async (pending: DialoguePacket[], latestGame: GameState = game) => {
    if (pending.length > 0) {
      const [nextPacket, ...rest] = pending
      jumpToPacket(nextPacket, rest)
      return
    }

    const shouldAdvanceDay = latestGame.timeSlotIndex >= maxEnergy
    if (shouldAdvanceDay) {
      const diaryEntry = await requestDailyDiary(latestGame)
      if (!diaryEntry) return
      const drafted = {
        ...latestGame,
        day: latestGame.day + 1,
        energy: maxEnergy,
        timeSlotIndex: 0,
        currentMessage: `第 ${latestGame.day} 天结束。新的一天开始了。`,
        dailyTriggeredEventIds: [],
        log: [...latestGame.log, `第 ${latestGame.day} 天结束。`],
        currentDayLog: [],
        diaryEntries: [...latestGame.diaryEntries, { day: latestGame.day, content: diaryEntry.content }],
      }
      const resolved = resolveTriggeredEvents(drafted, config)
      setDisplayTimeSlotIndexOverride(null)
      setDialogue(null)
      setGame(resolved.state)
      openPackets(resolved.triggeredEvents.map(packetFromEvent))
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
    const preview = buildActionStoryTurnPreview({
      action: session.action,
      config,
      state: session.state,
      triggeredEvents: [],
      previousLines: session.generatedLines,
      playerIntent,
    })
    setLastAiRequestPreview(preview)
    const { controller, requestId, timeoutId, wasTimedOut } = startAiRequest()

    try {
      const turn = await generateActionStoryTurn({
        action: session.action,
        config,
        state: session.state,
        triggeredEvents: [],
        previousLines: session.generatedLines,
        playerIntent,
        onLineUpdate: (line) => {
          if (!line || controller.signal.aborted || aiRequestIdRef.current !== requestId) return
          setGame((prev) => (prev.currentMessage === line ? prev : { ...prev, currentMessage: line }))
        },
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
    const preview = buildInteractionEvaluationPreview({
      action: session.action,
      config,
      state: {
        ...session.state,
        log: game.log,
        currentMessage: game.currentMessage,
      },
      generatedLines: session.generatedLines,
      playerIntents: session.playerIntents,
    })
    setLastAiRequestPreview(preview)
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

  const requestAiFreeTimeLine = async (state: GameState) => {
    const preview = buildFreeTimeStoryPreview({
      config,
      state,
    })
    setLastAiRequestPreview(preview)
    const { controller, requestId, timeoutId, wasTimedOut } = startAiRequest()

    try {
      const line = await generateFreeTimeStory({
        config,
        state,
        onLineUpdate: (nextLine) => {
          if (!nextLine || controller.signal.aborted || aiRequestIdRef.current !== requestId) return
          setGame((prev) => (prev.currentMessage === nextLine ? prev : { ...prev, currentMessage: nextLine }))
        },
        signal: controller.signal,
      })

      if (controller.signal.aborted || aiRequestIdRef.current !== requestId) return null
      return line
    } catch (error) {
      if (controller.signal.aborted && !wasTimedOut()) return null
      if (aiRequestIdRef.current !== requestId) return null
      const message = wasTimedOut() ? 'AI free-time narration timed out. Switched back to fallback flow.' : error instanceof Error ? error.message : 'AI free-time narration failed.'
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
      currentDayLog: [...game.currentDayLog, summary ? `AI结算: ${effectSummary}。${summary}` : `AI结算: ${effectSummary}`],
    }

    const resolved = resolveTriggeredEvents(draft, config)
    setGame(resolved.state)

    if (resolved.triggeredEvents.length > 0) {
      openPackets([...resolved.triggeredEvents.map(packetFromEvent), ...pending])
      return
    }

    await finishDialogue(pending, resolved.state)
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
      return
    }

    void finishDialogue(dialogue.pending)
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
    void finishDialogue(dialogue.pending)
  }

  const handleAiIntent = async (intent: string) => {
    if (!dialogue || !dialogue.packet.aiSession || isGeneratingNarrative) return

    const session = dialogue.packet.aiSession

    setGame((prev) => ({
      ...prev,
      currentMessage: 'AI is drafting the next line...',
      log: [...prev.log, `玩家决定: ${intent}`],
      currentDayLog: [...prev.currentDayLog, `玩家决定: ${intent}`],
    }))

    const turn = await requestAiTurn(session, intent)
    if (!turn) {
      void finishDialogue(dialogue.pending)
      return
    }

    const nextSession: AiDialogueSession = {
      ...session,
      generatedLines: [...session.generatedLines, turn.line],
      playerIntents: [...session.playerIntents, intent],
    }

    setGame((prev) => ({
      ...prev,
      currentMessage: turn.line,
      log: [...prev.log, `AI剧情: ${turn.line}`],
      currentDayLog: [...prev.currentDayLog, `AI剧情: ${turn.line}`],
    }))

    jumpToPacket(packetFromAction(session.action, [turn.line], nextSession, turn.choices), dialogue.pending)
  }

  const handleEndAiDialogue = async () => {
    if (!dialogue || !dialogue.packet.aiSession || isGeneratingNarrative) return
    if (dialogue.lineIndex < dialogue.packet.lines.length - 1) return
    await finalizeAiDialogue(dialogue.packet.aiSession, dialogue.pending)
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
        currentDayLog: [...prev.currentDayLog, `对话分支: ${choice.label} (${passed ? '成功' : '失败'})`],
      }
    })

    jumpToPacket(
      {
        source: '分支结果',
        lines,
        choices: [],
        displayTimeSlotIndex: dialogue.packet.displayTimeSlotIndex,
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
    if (inPrologue || isDialogueOpen || isGeneratingNarrative || game.energy < action.cost || game.timeSlotIndex >= maxEnergy) return

    setDisplayTimeSlotIndexOverride(game.timeSlotIndex)
    const nextTimeSlotIndex = Math.min(maxEnergy, game.timeSlotIndex + Math.max(1, action.cost))
    const baseDraft = {
      ...game,
      energy: Math.max(0, maxEnergy - nextTimeSlotIndex),
      timeSlotIndex: nextTimeSlotIndex,
      currentMessage: action.flavor,
      currentSceneId: action.sceneId || game.currentSceneId,
      log: [...game.log, `Day ${game.day}: ${action.name}. ${action.flavor}`],
      currentDayLog: [...game.currentDayLog, `行动: ${action.name}。${action.flavor}`],
    }

    const scriptedDraft = {
      ...baseDraft,
      stats: applyEffects(baseDraft.stats, config, action.effects),
    }
    const scriptedResolved = resolveTriggeredEvents(scriptedDraft, config)
    const fallbackPackets = [packetFromAction(action, undefined, undefined, undefined, game.timeSlotIndex), ...scriptedResolved.triggeredEvents.map(packetFromEvent)]

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
      displayTimeSlotIndex: game.timeSlotIndex,
    }

    const turn = await requestAiTurn(baseSession)
    if (!turn) {
      setGame(scriptedResolved.state)
      openPackets(fallbackPackets)
      return
    }

    setGame({
      ...baseDraft,
      log: [...baseDraft.log, `AI scene: ${action.name}`, `AI剧情: ${turn.line}`],
      currentDayLog: [...baseDraft.currentDayLog, `AI剧情: ${turn.line}`],
      currentMessage: turn.line,
    })

    const session: AiDialogueSession = {
      ...baseSession,
      generatedLines: [turn.line],
    }

    openPackets([packetFromAction(action, [turn.line], session, turn.choices)])
  }

  const handleDoNothing = async () => {
    if (inPrologue || isDialogueOpen || isGeneratingNarrative || game.timeSlotIndex >= maxEnergy) return

    setDisplayTimeSlotIndexOverride(game.timeSlotIndex)
    const idleAction = createFreeTimeAction(config, game)
    const nextTimeSlotIndex = Math.min(maxEnergy, game.timeSlotIndex + 1)
    const baseDraft = {
      ...game,
      energy: Math.max(0, maxEnergy - nextTimeSlotIndex),
      timeSlotIndex: nextTimeSlotIndex,
      currentMessage: idleAction.flavor,
      currentSceneId: idleAction.sceneId || game.currentSceneId,
      log: [...game.log, `Day ${game.day}: ${idleAction.name}. ${idleAction.flavor}`],
      currentDayLog: [...game.currentDayLog, `空档: ${idleAction.flavor}`],
    }

    const resolved = resolveTriggeredEvents(baseDraft, config)
    const fallbackPackets = [packetFromAction(idleAction, undefined, undefined, undefined, game.timeSlotIndex), ...resolved.triggeredEvents.map(packetFromEvent)]

    if (!canUseAiStory(config)) {
      setAiError(null)
      setGame(resolved.state)
      openPackets(fallbackPackets)
      return
    }

    setGame({
      ...baseDraft,
      currentMessage: 'AI is drafting the next line...',
    })

    const line = await requestAiFreeTimeLine(baseDraft)
    if (!line) {
      setGame(resolved.state)
      openPackets(fallbackPackets)
      return
    }

    setGame({
      ...resolved.state,
      currentMessage: line,
      log: [...resolved.state.log, `AI free time: ${idleAction.name}`, `AI剧情: ${line}`],
      currentDayLog: [...resolved.state.currentDayLog, `AI剧情: ${line}`],
    })

    const session: AiDialogueSession = {
      action: idleAction,
      state: baseDraft,
      generatedLines: [line],
      playerIntents: [],
      displayTimeSlotIndex: game.timeSlotIndex,
    }

    openPackets([
      {
        source: `空档: ${config.timeSlots[game.timeSlotIndex]?.label || '当前时段'}`,
        sceneId: idleAction.sceneId,
        lines: [line],
        choices: [],
        aiSession: session,
        aiSuggestions: [],
        displayTimeSlotIndex: game.timeSlotIndex,
      },
      ...resolved.triggeredEvents.map(packetFromEvent),
    ])
  }

  const handleRestart = () => {
    aiRequestIdRef.current += 1
    aiAbortRef.current?.abort()
    aiAbortRef.current = null
    setIsGeneratingNarrative(false)
    setDisplayTimeSlotIndexOverride(null)
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
    displayTimeSlotIndex,
    inPrologue,
    isDialogueOpen,
    isGeneratingNarrative,
    aiError,
    nextAiRequestPreview,
    lastAiRequestPreview,
    diaryEntries: game.diaryEntries,
    unlockedCount,
    currentTimeSlot,
    remainingTimeSlots,
    maxEnergy,
    handleAdvancePrologue,
    handleAiIntent,
    handleEndAiDialogue,
    cancelAiNarrative,
    handleDialogueChoice,
    handleDialogueNext,
    handleDoAction,
    handleDoNothing,
    handleRestart,
  }
}
