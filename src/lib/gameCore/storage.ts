import { DEFAULT_CONFIG } from './defaultConfig'
import { normalizeNarrative } from './engine'
import type { GameConfig } from './types'

export const CONFIG_STORAGE_KEY = 'daily-raising-editor-config-v2'

export function cloneConfig(config: GameConfig): GameConfig {
  return JSON.parse(JSON.stringify(config)) as GameConfig
}

export function loadConfig(): GameConfig {
  const saved = localStorage.getItem(CONFIG_STORAGE_KEY)
  if (!saved) return cloneConfig(DEFAULT_CONFIG)

  try {
    const parsed = JSON.parse(saved) as Partial<GameConfig>
    const baseConfig = cloneConfig(DEFAULT_CONFIG)
    const merged: GameConfig = {
      ...baseConfig,
      ...parsed,
      prologue: Array.isArray(parsed.prologue) ? parsed.prologue.filter((line): line is string => typeof line === 'string') : baseConfig.prologue,
      scenes: Array.isArray(parsed.scenes) && parsed.scenes.length > 0 ? parsed.scenes : baseConfig.scenes,
      stats: Array.isArray(parsed.stats) && parsed.stats.length > 0 ? parsed.stats : baseConfig.stats,
      dailyActions: Array.isArray(parsed.dailyActions)
        ? parsed.dailyActions.map((action) => ({ ...action, narrative: normalizeNarrative(action.narrative) }))
        : baseConfig.dailyActions,
      events: Array.isArray(parsed.events)
        ? parsed.events.map((event) => ({ ...event, narrative: normalizeNarrative(event.narrative) }))
        : baseConfig.events,
      maxEnergy: typeof parsed.maxEnergy === 'number' ? Math.max(1, parsed.maxEnergy) : baseConfig.maxEnergy,
      defaultSceneId:
        typeof parsed.defaultSceneId === 'string' && parsed.defaultSceneId.length > 0
          ? parsed.defaultSceneId
          : parsed.scenes?.[0]?.id || baseConfig.defaultSceneId,
    }
    return merged
  } catch {
    return cloneConfig(DEFAULT_CONFIG)
  }
}

export function saveConfig(config: GameConfig) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
}
