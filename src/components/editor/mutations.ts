import { nextId, type DailyAction, type Effect, type EventCondition, type GameConfig, type Narrative, type NarrativeChoice, type Operator, type StoryEvent } from '@/lib/gameCore'

function updateById<T extends { id: string }>(items: T[], id: string, updater: (item: T) => T) {
  return items.map((item) => (item.id === id ? updater(item) : item))
}

function updateByIndex<T>(items: T[], index: number, updater: (item: T) => T) {
  return items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item))
}

function removeByIndex<T>(items: T[], index: number) {
  return items.filter((_, itemIndex) => itemIndex !== index)
}

function ensureNarrative(narrative: Narrative | undefined): Narrative {
  return {
    lines: narrative?.lines || [],
    choices: narrative?.choices || [],
  }
}

function getDefaultStatId(config: GameConfig) {
  return config.stats[0]?.id || ''
}

function createDefaultChoice(config: GameConfig, label: string, successLine: string, failLine: string): NarrativeChoice {
  return {
    id: nextId('choice'),
    label,
    statId: getDefaultStatId(config),
    operator: '>=',
    value: 50,
    successLines: [successLine],
    failLines: [failLine],
    successEffects: [],
    failEffects: [],
  }
}

export function updateDailyAction(config: GameConfig, actionId: string, updater: (action: DailyAction) => DailyAction): GameConfig {
  return {
    ...config,
    dailyActions: updateById(config.dailyActions, actionId, updater),
  }
}

export function removeDailyAction(config: GameConfig, actionId: string): GameConfig {
  return {
    ...config,
    dailyActions: config.dailyActions.filter((action) => action.id !== actionId),
  }
}

export function toggleActionTimeSlot(config: GameConfig, actionId: string, slotId: string, checked: boolean): GameConfig {
  const allTimeSlotIds = config.timeSlots.map((slot) => slot.id)
  return updateDailyAction(config, actionId, (action) => {
    const nextIds = new Set(action.availableTimeSlotIds?.length ? action.availableTimeSlotIds : allTimeSlotIds)
    if (checked) nextIds.add(slotId)
    else nextIds.delete(slotId)
    return { ...action, availableTimeSlotIds: Array.from(nextIds) }
  })
}

export function selectAllActionTimeSlots(config: GameConfig, actionId: string): GameConfig {
  return updateDailyAction(config, actionId, (action) => ({
    ...action,
    availableTimeSlotIds: config.timeSlots.map((slot) => slot.id),
  }))
}

export function updateActionChoice(
  config: GameConfig,
  actionId: string,
  choiceIndex: number,
  updater: (choice: NarrativeChoice) => NarrativeChoice,
): GameConfig {
  return updateDailyAction(config, actionId, (action) => {
    const narrative = ensureNarrative(action.narrative)
    return {
      ...action,
      narrative: {
        ...narrative,
        choices: updateByIndex(narrative.choices, choiceIndex, updater),
      },
    }
  })
}

export function removeActionChoice(config: GameConfig, actionId: string, choiceIndex: number): GameConfig {
  return updateDailyAction(config, actionId, (action) => {
    const narrative = ensureNarrative(action.narrative)
    return {
      ...action,
      narrative: {
        ...narrative,
        choices: removeByIndex(narrative.choices, choiceIndex),
      },
    }
  })
}

export function addActionChoice(config: GameConfig, actionId: string): GameConfig {
  return updateDailyAction(config, actionId, (action) => {
    const narrative = ensureNarrative(action.narrative)
    return {
      ...action,
      narrative: {
        ...narrative,
        choices: [...narrative.choices, createDefaultChoice(config, '对她说点什么', '她看起来放松了一些。', '她没有回应。')],
      },
    }
  })
}

export function updateActionEffect(
  config: GameConfig,
  actionId: string,
  effectIndex: number,
  updater: (effect: Effect) => Effect,
): GameConfig {
  return updateDailyAction(config, actionId, (action) => ({
    ...action,
    effects: updateByIndex(action.effects, effectIndex, updater),
  }))
}

export function removeActionEffect(config: GameConfig, actionId: string, effectIndex: number): GameConfig {
  return updateDailyAction(config, actionId, (action) => ({
    ...action,
    effects: removeByIndex(action.effects, effectIndex),
  }))
}

export function addActionEffect(config: GameConfig, actionId: string): GameConfig {
  return updateDailyAction(config, actionId, (action) => ({
    ...action,
    effects: [...action.effects, { statId: getDefaultStatId(config), delta: 1 }],
  }))
}

export function createActionTemplate(config: GameConfig): DailyAction {
  return {
    id: nextId('action'),
    name: '新日常',
    description: '请填写描述',
    cost: 1,
    flavor: '发生了一些变化。',
    sceneId: config.defaultSceneId,
    effects: [{ statId: getDefaultStatId(config), delta: 1 }],
    narrative: {
      lines: ['她看向你，等待你接下来的动作。'],
      choices: [],
    },
    availableTimeSlotIds: config.timeSlots.map((slot) => slot.id),
  }
}

export function updateStoryEvent(config: GameConfig, eventId: string, updater: (event: StoryEvent) => StoryEvent): GameConfig {
  return {
    ...config,
    events: updateById(config.events, eventId, updater),
  }
}

export function removeStoryEvent(config: GameConfig, eventId: string): GameConfig {
  return {
    ...config,
    events: config.events.filter((event) => event.id !== eventId),
  }
}

export function updateEventChoice(
  config: GameConfig,
  eventId: string,
  choiceIndex: number,
  updater: (choice: NarrativeChoice) => NarrativeChoice,
): GameConfig {
  return updateStoryEvent(config, eventId, (event) => {
    const narrative = ensureNarrative(event.narrative)
    return {
      ...event,
      narrative: {
        ...narrative,
        choices: updateByIndex(narrative.choices, choiceIndex, updater),
      },
    }
  })
}

export function removeEventChoice(config: GameConfig, eventId: string, choiceIndex: number): GameConfig {
  return updateStoryEvent(config, eventId, (event) => {
    const narrative = ensureNarrative(event.narrative)
    return {
      ...event,
      narrative: {
        ...narrative,
        choices: removeByIndex(narrative.choices, choiceIndex),
      },
    }
  })
}

export function addEventChoice(config: GameConfig, eventId: string): GameConfig {
  return updateStoryEvent(config, eventId, (event) => {
    const narrative = ensureNarrative(event.narrative)
    return {
      ...event,
      narrative: {
        ...narrative,
        choices: [...narrative.choices, createDefaultChoice(config, '回应她', '她的反应明显变得柔和。', '她沉默了片刻。')],
      },
    }
  })
}

export function updateEventCondition(
  config: GameConfig,
  eventId: string,
  conditionIndex: number,
  updater: (condition: EventCondition) => EventCondition,
): GameConfig {
  return updateStoryEvent(config, eventId, (event) => ({
    ...event,
    conditions: updateByIndex(event.conditions, conditionIndex, updater),
  }))
}

export function removeEventCondition(config: GameConfig, eventId: string, conditionIndex: number): GameConfig {
  return updateStoryEvent(config, eventId, (event) => ({
    ...event,
    conditions: removeByIndex(event.conditions, conditionIndex),
  }))
}

export function addEventCondition(config: GameConfig, eventId: string): GameConfig {
  return updateStoryEvent(config, eventId, (event) => ({
    ...event,
    conditions: [...event.conditions, { statId: getDefaultStatId(config), operator: '>=' as Operator, value: 50 }],
  }))
}

export function updateEventEffect(
  config: GameConfig,
  eventId: string,
  effectIndex: number,
  updater: (effect: Effect) => Effect,
): GameConfig {
  return updateStoryEvent(config, eventId, (event) => ({
    ...event,
    effects: updateByIndex(event.effects, effectIndex, updater),
  }))
}

export function removeEventEffect(config: GameConfig, eventId: string, effectIndex: number): GameConfig {
  return updateStoryEvent(config, eventId, (event) => ({
    ...event,
    effects: removeByIndex(event.effects, effectIndex),
  }))
}

export function addEventEffect(config: GameConfig, eventId: string): GameConfig {
  return updateStoryEvent(config, eventId, (event) => ({
    ...event,
    effects: [...event.effects, { statId: getDefaultStatId(config), delta: 3 }],
  }))
}

export function createEventTemplate(config: GameConfig): StoryEvent {
  return {
    id: nextId('event'),
    title: '新事件',
    description: '请填写事件内容',
    repeatable: false,
    sceneId: config.defaultSceneId,
    conditions: [{ statId: getDefaultStatId(config), operator: '>=' as Operator, value: 45 }],
    effects: [{ statId: getDefaultStatId(config), delta: 5 }],
    narrative: {
      lines: ['一个新的事件发生了。'],
      choices: [],
    },
  }
}
