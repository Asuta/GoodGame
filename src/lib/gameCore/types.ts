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

export type AiApiMode = 'chat-completions' | 'responses'

export type AiReasoningEffort = 'default' | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export type AiConfig = {
  enabled: boolean
  apiMode: AiApiMode
  apiBaseUrl: string
  apiKey: string
  model: string
  reasoningEffort: AiReasoningEffort
  temperature: number
  maxLines: number
  recentLogLimit: number
  characterName: string
  characterProfile: string
  worldSetting: string
  promptNotes: string
}

export type TimeSlotDef = {
  id: string
  label: string
}

export type DailyAction = {
  id: string
  name: string
  description: string
  cost: number
  flavor: string
  sceneId?: string
  availableTimeSlotIds?: string[]
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
  timeSlots: TimeSlotDef[]
  defaultSceneId: string
  scenes: SceneDef[]
  stats: StatDef[]
  dailyActions: DailyAction[]
  events: StoryEvent[]
  ai: AiConfig
}

export type GameState = {
  day: number
  energy: number
  timeSlotIndex: number
  prologueIndex: number
  stats: Record<string, number>
  unlockedEventIds: string[]
  dailyTriggeredEventIds: string[]
  currentSceneId: string
  currentMessage: string
  log: string[]
}
