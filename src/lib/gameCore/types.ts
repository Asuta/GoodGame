export type Operator = '>=' | '<=' | '>' | '<' | '='

export type StatDef = {
  id: string
  name: string
  min: number
  max: number
  defaultValue: number
  description: string
}

export type Effect = {
  statId: string
  delta: number
}

export type NarrativeChoice = {
  id: string
  label: string
  statId: string
  operator: Operator
  value: number
  successLines: string[]
  failLines: string[]
  successEffects: Effect[]
  failEffects: Effect[]
}

export type Narrative = {
  lines: string[]
  choices: NarrativeChoice[]
}

export type DailyAction = {
  id: string
  name: string
  description: string
  cost: number
  flavor: string
  sceneId?: string
  effects: Effect[]
  narrative?: Narrative
}

export type EventCondition = {
  statId: string
  operator: Operator
  value: number
}

export type StoryEvent = {
  id: string
  title: string
  description: string
  repeatable: boolean
  sceneId?: string
  conditions: EventCondition[]
  effects: Effect[]
  narrative?: Narrative
}

export type SceneDef = {
  id: string
  name: string
  backgroundUrl: string
  characterUrl: string
  portraitUrl: string
}

export type GameConfig = {
  title: string
  subtitle: string
  prologue: string[]
  maxEnergy: number
  defaultSceneId: string
  scenes: SceneDef[]
  stats: StatDef[]
  dailyActions: DailyAction[]
  events: StoryEvent[]
}

export type GameState = {
  day: number
  energy: number
  prologueIndex: number
  stats: Record<string, number>
  unlockedEventIds: string[]
  dailyTriggeredEventIds: string[]
  currentSceneId: string
  currentMessage: string
  log: string[]
}
