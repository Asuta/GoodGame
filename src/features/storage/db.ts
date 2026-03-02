import { openDB } from 'idb'

import type {
  AppSettings,
  CaseData,
  NpcData,
  PlayerData,
  SessionData,
  TurnData,
  WorldData,
} from '@/types/game'

export type GameDbSchema = {
  settings: {
    key: string
    value: AppSettings
  }
  worlds: {
    key: string
    value: WorldData
  }
  players: {
    key: string
    value: PlayerData
  }
  npcs: {
    key: string
    value: NpcData
    indexes: { 'by-updated-at': string }
  }
  cases: {
    key: string
    value: CaseData
    indexes: { 'by-enabled': number; 'by-priority': number }
  }
  sessions: {
    key: string
    value: SessionData
    indexes: { 'by-updated-at': string }
  }
  turns: {
    key: string
    value: TurnData
    indexes: { 'by-session': string; 'by-created-at': string }
  }
}

export const DB_NAME = 'goodgame_db'
export const DB_VERSION = 1

export async function getDb() {
  return openDB<GameDbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('worlds')) {
        db.createObjectStore('worlds', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('players')) {
        db.createObjectStore('players', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('npcs')) {
        const store = db.createObjectStore('npcs', { keyPath: 'id' })
        store.createIndex('by-updated-at', 'updatedAt')
      }

      if (!db.objectStoreNames.contains('cases')) {
        const store = db.createObjectStore('cases', { keyPath: 'id' })
        store.createIndex('by-enabled', 'enabled')
        store.createIndex('by-priority', 'priority')
      }

      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'id' })
        store.createIndex('by-updated-at', 'updatedAt')
      }

      if (!db.objectStoreNames.contains('turns')) {
        const store = db.createObjectStore('turns', { keyPath: 'id' })
        store.createIndex('by-session', 'sessionId')
        store.createIndex('by-created-at', 'createdAt')
      }
    },
  })
}
