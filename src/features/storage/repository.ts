import { getDb } from '@/features/storage/db'
import { makeId, nowIso } from '@/lib/random'
import type {
  AppSettings,
  CaseData,
  ExportBundle,
  NpcData,
  PlayerData,
  SessionData,
  TurnData,
  WorldData,
} from '@/types/game'

const DEFAULT_WORLD_ID = 'world_default'
const DEFAULT_PLAYER_ID = 'player_default'
const DEFAULT_SESSION_ID = 'session_default'

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'singleton',
  apiMode: 'responses',
  baseUrl: 'https://api.openai.com',
  apiKey: '',
  model: 'gpt-4.1-mini',
  temperature: 0.8,
  maxOutputTokens: 700,
  systemPrompt: 'You are a concise, engaging dungeon master for a solo campaign.',
  updatedAt: nowIso(),
}

export const DEFAULT_WORLD: WorldData = {
  id: DEFAULT_WORLD_ID,
  name: 'Default World',
  content: 'A frontier city sits between ancient ruins and untamed forests.',
  updatedAt: nowIso(),
}

export const DEFAULT_PLAYER: PlayerData = {
  id: DEFAULT_PLAYER_ID,
  name: 'Adventurer',
  attributes: 'STR 10, DEX 10, CON 10, INT 10, WIS 10, CHA 10',
  skills: 'Perception +2, Stealth +1, Persuasion +1',
  status: 'Healthy',
  equipment: 'Traveler clothes, short blade, lantern',
  items: 'Rope x1, ration x2',
  updatedAt: nowIso(),
}

export const DEFAULT_SESSION: SessionData = {
  id: DEFAULT_SESSION_ID,
  name: 'Demo Session',
  worldId: DEFAULT_WORLD_ID,
  playerId: DEFAULT_PLAYER_ID,
  activeNpcIds: [],
  activeCaseIds: [],
  recentTurns: 8,
  updatedAt: nowIso(),
}

export async function ensureDefaults(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['settings', 'worlds', 'players', 'sessions'], 'readwrite')

  const currentSettings = await tx.objectStore('settings').get('singleton')
  if (!currentSettings) {
    await tx.objectStore('settings').put(DEFAULT_SETTINGS)
  }

  const currentWorld = await tx.objectStore('worlds').get(DEFAULT_WORLD_ID)
  if (!currentWorld) {
    await tx.objectStore('worlds').put(DEFAULT_WORLD)
  }

  const currentPlayer = await tx.objectStore('players').get(DEFAULT_PLAYER_ID)
  if (!currentPlayer) {
    await tx.objectStore('players').put(DEFAULT_PLAYER)
  }

  const currentSession = await tx.objectStore('sessions').get(DEFAULT_SESSION_ID)
  if (!currentSession) {
    await tx.objectStore('sessions').put(DEFAULT_SESSION)
  }

  await tx.done
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb()
  const settings = await db.get('settings', 'singleton')
  return settings ?? DEFAULT_SETTINGS
}

export async function saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const db = await getDb()
  const next = { ...(await getSettings()), ...partial, id: 'singleton' as const, updatedAt: nowIso() }
  await db.put('settings', next)
  return next
}

export async function getWorld(id: string): Promise<WorldData | undefined> {
  const db = await getDb()
  return db.get('worlds', id)
}

export async function upsertWorld(world: WorldData): Promise<void> {
  const db = await getDb()
  await db.put('worlds', { ...world, updatedAt: nowIso() })
}

export async function getPlayer(id: string): Promise<PlayerData | undefined> {
  const db = await getDb()
  return db.get('players', id)
}

export async function upsertPlayer(player: PlayerData): Promise<void> {
  const db = await getDb()
  await db.put('players', { ...player, updatedAt: nowIso() })
}

export async function listNpcs(): Promise<NpcData[]> {
  const db = await getDb()
  const entries = await db.getAll('npcs')
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

export async function upsertNpc(npc: NpcData): Promise<void> {
  const db = await getDb()
  await db.put('npcs', { ...npc, updatedAt: nowIso() })
}

export async function createNpc(): Promise<NpcData> {
  const npc: NpcData = {
    id: makeId('npc'),
    name: 'New NPC',
    affinity: 0,
    history: '',
    attributes: '',
    skills: '',
    status: '',
    items: '',
    updatedAt: nowIso(),
  }
  await upsertNpc(npc)
  return npc
}

export async function listCases(): Promise<CaseData[]> {
  const db = await getDb()
  const entries = await db.getAll('cases')
  return entries.sort((a, b) => a.priority - b.priority)
}

export async function upsertCase(entry: CaseData): Promise<void> {
  const db = await getDb()
  await db.put('cases', { ...entry, updatedAt: nowIso() })
}

export async function createCase(): Promise<CaseData> {
  const entry: CaseData = {
    id: makeId('case'),
    title: 'New reference case',
    content: '',
    enabled: true,
    priority: 100,
    updatedAt: nowIso(),
  }
  await upsertCase(entry)
  return entry
}

export async function getSession(id = DEFAULT_SESSION_ID): Promise<SessionData> {
  const db = await getDb()
  const session = await db.get('sessions', id)
  return session ?? DEFAULT_SESSION
}

export async function saveSession(partial: Partial<SessionData>): Promise<SessionData> {
  const db = await getDb()
  const current = await getSession(partial.id ?? DEFAULT_SESSION_ID)
  const next: SessionData = {
    ...current,
    ...partial,
    id: partial.id ?? current.id,
    updatedAt: nowIso(),
  }
  await db.put('sessions', next)
  return next
}

export async function listTurns(sessionId = DEFAULT_SESSION_ID): Promise<TurnData[]> {
  const db = await getDb()
  const entries = await db.getAllFromIndex('turns', 'by-session', sessionId)
  return entries.sort((a, b) => a.index - b.index)
}

export async function upsertTurn(turn: TurnData): Promise<void> {
  const db = await getDb()
  await db.put('turns', turn)
}

export async function clearTurns(sessionId = DEFAULT_SESSION_ID): Promise<void> {
  const db = await getDb()
  const turns = await listTurns(sessionId)
  const tx = db.transaction('turns', 'readwrite')
  for (const turn of turns) {
    await tx.objectStore('turns').delete(turn.id)
  }
  await tx.done
}

export async function exportData(): Promise<ExportBundle> {
  const db = await getDb()
  const [
    settings,
    worlds,
    players,
    npcs,
    cases,
    sessions,
    turns,
  ] = await Promise.all([
    db.getAll('settings'),
    db.getAll('worlds'),
    db.getAll('players'),
    db.getAll('npcs'),
    db.getAll('cases'),
    db.getAll('sessions'),
    db.getAll('turns'),
  ])

  return {
    schemaVersion: 1,
    exportedAt: nowIso(),
    data: {
      settings,
      worlds,
      players,
      npcs,
      cases,
      sessions,
      turns,
    },
  }
}

function assertArray<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`)
  }
  return value as T[]
}

export async function importData(bundle: ExportBundle, mode: 'replace' | 'merge'): Promise<void> {
  if (bundle.schemaVersion !== 1) {
    throw new Error(`Unsupported schemaVersion: ${bundle.schemaVersion}`)
  }

  const settings = assertArray<AppSettings>(bundle.data.settings, 'settings')
  const worlds = assertArray<WorldData>(bundle.data.worlds, 'worlds')
  const players = assertArray<PlayerData>(bundle.data.players, 'players')
  const npcs = assertArray<NpcData>(bundle.data.npcs, 'npcs')
  const cases = assertArray<CaseData>(bundle.data.cases, 'cases')
  const sessions = assertArray<SessionData>(bundle.data.sessions, 'sessions')
  const turns = assertArray<TurnData>(bundle.data.turns, 'turns')

  const db = await getDb()
  const tx = db.transaction(['settings', 'worlds', 'players', 'npcs', 'cases', 'sessions', 'turns'], 'readwrite')

  if (mode === 'replace') {
    await Promise.all([
      tx.objectStore('settings').clear(),
      tx.objectStore('worlds').clear(),
      tx.objectStore('players').clear(),
      tx.objectStore('npcs').clear(),
      tx.objectStore('cases').clear(),
      tx.objectStore('sessions').clear(),
      tx.objectStore('turns').clear(),
    ])
  }

  for (const item of settings) {
    await tx.objectStore('settings').put(item)
  }
  for (const item of worlds) {
    await tx.objectStore('worlds').put(item)
  }
  for (const item of players) {
    await tx.objectStore('players').put(item)
  }
  for (const item of npcs) {
    await tx.objectStore('npcs').put(item)
  }
  for (const item of cases) {
    await tx.objectStore('cases').put(item)
  }
  for (const item of sessions) {
    await tx.objectStore('sessions').put(item)
  }
  for (const item of turns) {
    await tx.objectStore('turns').put(item)
  }

  await tx.done
  await ensureDefaults()
}
