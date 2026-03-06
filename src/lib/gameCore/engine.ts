import type { Effect, EventCondition, GameConfig, GameState, Narrative, NarrativeChoice, StoryEvent } from './types'

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`
}

export function buildInitialStats(config: GameConfig): Record<string, number> {
  return config.stats.reduce<Record<string, number>>((acc, stat) => {
    acc[stat.id] = clamp(stat.defaultValue, stat.min, stat.max)
    return acc
  }, {})
}

export function createInitialGameState(config: GameConfig): GameState {
  return {
    day: 1,
    energy: config.maxEnergy,
    prologueIndex: 0,
    stats: buildInitialStats(config),
    unlockedEventIds: [],
    dailyTriggeredEventIds: [],
    currentSceneId: config.defaultSceneId || config.scenes[0]?.id || '',
    currentMessage: config.prologue[0] ?? '游戏开始。',
    log: ['游戏开始。完成序章后将进入每日循环。'],
  }
}

export function applyEffects(stats: Record<string, number>, config: GameConfig, effects: Effect[]) {
  const next = { ...stats }
  effects.forEach((effect) => {
    const stat = config.stats.find((item) => item.id === effect.statId)
    if (!stat) return
    const current = next[effect.statId] ?? stat.defaultValue
    next[effect.statId] = clamp(current + effect.delta, stat.min, stat.max)
  })
  return next
}

export function evalCondition(current: number, condition: EventCondition) {
  if (condition.operator === '>=') return current >= condition.value
  if (condition.operator === '<=') return current <= condition.value
  if (condition.operator === '>') return current > condition.value
  if (condition.operator === '<') return current < condition.value
  return current === condition.value
}

export function evalChoiceCondition(stats: Record<string, number>, choice: NarrativeChoice) {
  return evalCondition(stats[choice.statId] ?? 0, {
    statId: choice.statId,
    operator: choice.operator,
    value: choice.value,
  })
}

export function normalizeNarrative(raw: Narrative | undefined): Narrative {
  return {
    lines: Array.isArray(raw?.lines) ? raw.lines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0) : [],
    choices: Array.isArray(raw?.choices)
      ? raw.choices.map((choice) => ({
          id: choice.id || nextId('choice'),
          label: choice.label || '继续对话',
          statId: choice.statId || '',
          operator: choice.operator || '>=',
          value: Number(choice.value) || 0,
          successLines: Array.isArray(choice.successLines) ? choice.successLines.filter((line) => typeof line === 'string') : [],
          failLines: Array.isArray(choice.failLines) ? choice.failLines.filter((line) => typeof line === 'string') : [],
          successEffects: Array.isArray(choice.successEffects) ? choice.successEffects : [],
          failEffects: Array.isArray(choice.failEffects) ? choice.failEffects : [],
        }))
      : [],
  }
}

export function resolveTriggeredEvents(draft: GameState, config: GameConfig) {
  let stats = draft.stats
  const log = [...draft.log]
  const unlocked = [...draft.unlockedEventIds]
  const dailyTriggered = [...draft.dailyTriggeredEventIds]
  let currentSceneId = draft.currentSceneId
  let currentMessage = draft.currentMessage
  const triggeredEvents: StoryEvent[] = []

  config.events.forEach((event) => {
    const alreadyUnlocked = unlocked.includes(event.id)
    const triggeredToday = dailyTriggered.includes(event.id)
    if ((!event.repeatable && alreadyUnlocked) || (event.repeatable && triggeredToday)) return

    const matched = event.conditions.every((condition) => {
      const current = stats[condition.statId] ?? 0
      return evalCondition(current, condition)
    })

    if (!matched) return

    stats = applyEffects(stats, config, event.effects)
    log.push(`触发事件: ${event.title} - ${event.description}`)
    currentMessage = event.description
    if (event.sceneId) currentSceneId = event.sceneId
    dailyTriggered.push(event.id)
    if (!event.repeatable) unlocked.push(event.id)
    triggeredEvents.push(event)
  })

  return {
    state: {
      ...draft,
      stats,
      log,
      currentSceneId,
      currentMessage,
      unlockedEventIds: unlocked,
      dailyTriggeredEventIds: dailyTriggered,
    },
    triggeredEvents,
  }
}

export function runEventCheck(draft: GameState, config: GameConfig): GameState {
  return resolveTriggeredEvents(draft, config).state
}

export function reconcileGameState(prev: GameState, config: GameConfig): GameState {
  const nextStats = buildInitialStats(config)
  config.stats.forEach((stat) => {
    const current = prev.stats[stat.id] ?? stat.defaultValue
    nextStats[stat.id] = clamp(current, stat.min, stat.max)
  })

  const sceneExists = config.scenes.some((scene) => scene.id === prev.currentSceneId)

  return {
    ...prev,
    energy: clamp(prev.energy, 0, config.maxEnergy),
    prologueIndex: Math.min(prev.prologueIndex, config.prologue.length),
    stats: nextStats,
    currentSceneId: sceneExists ? prev.currentSceneId : config.defaultSceneId || config.scenes[0]?.id || '',
    unlockedEventIds: prev.unlockedEventIds.filter((id) => config.events.some((event) => event.id === id)),
    dailyTriggeredEventIds: prev.dailyTriggeredEventIds.filter((id) => config.events.some((event) => event.id === id)),
  }
}
