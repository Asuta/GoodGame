export type ApiMode = 'completions' | 'responses'

export type DiceCheck = {
  expr: string
  dc?: number
  skill?: string
}

export type StoryOption = {
  id: string
  text: string
  check?: DiceCheck
}

export type PatchTarget = 'pc' | 'npc' | 'world'
export type PatchOp = 'set' | 'add' | 'remove' | 'inc'

export type PatchProposal = {
  id: string
  target: PatchTarget
  targetId?: string
  op: PatchOp
  path: string
  value?: unknown
  reason?: string
}

export type ModelReply = {
  narration: string
  options: StoryOption[]
  proposedPatches: PatchProposal[]
}

export type AppSettings = {
  id: 'singleton'
  apiMode: ApiMode
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxOutputTokens: number
  systemPrompt: string
  updatedAt: string
}

export type WorldData = {
  id: string
  name: string
  content: string
  updatedAt: string
}

export type PlayerData = {
  id: string
  name: string
  attributes: string
  skills: string
  status: string
  equipment: string
  items: string
  updatedAt: string
}

export type NpcData = {
  id: string
  name: string
  affinity: number
  history: string
  attributes: string
  skills: string
  status: string
  items: string
  updatedAt: string
}

export type CaseData = {
  id: string
  title: string
  content: string
  enabled: boolean
  priority: number
  updatedAt: string
}

export type SessionData = {
  id: string
  name: string
  worldId: string
  playerId: string
  activeNpcIds: string[]
  activeCaseIds: string[]
  recentTurns: number
  updatedAt: string
}

export type RollResult = {
  expression: string
  rolls: number[]
  modifier: number
  total: number
  dc?: number
  success?: boolean
}

export type TurnData = {
  id: string
  sessionId: string
  index: number
  createdAt: string
  selectedOptionText?: string
  roll?: RollResult
  narration: string
  options: StoryOption[]
  proposedPatches: PatchProposal[]
  appliedPatchIds: string[]
  rawResponse: string
}

export type ExportBundle = {
  schemaVersion: number
  exportedAt: string
  data: {
    settings: AppSettings[]
    worlds: WorldData[]
    players: PlayerData[]
    npcs: NpcData[]
    cases: CaseData[]
    sessions: SessionData[]
    turns: TurnData[]
  }
}
