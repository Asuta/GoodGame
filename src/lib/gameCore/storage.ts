import { DEFAULT_CONFIG } from './defaultConfig'
import { normalizeNarrative } from './engine'
import type { AiConfig, AiReasoningEffort, GameConfig } from './types'

export const CONFIG_STORAGE_KEY = 'daily-raising-editor-config-v2'


const AI_REASONING_EFFORTS: AiReasoningEffort[] = ['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh']

export function cloneConfig(config: GameConfig): GameConfig {
  return JSON.parse(JSON.stringify(config)) as GameConfig
}

function normalizeAiConfig(raw: Partial<AiConfig> | undefined, base: AiConfig): AiConfig {
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : base.enabled,
    apiMode: raw?.apiMode === 'chat-completions' ? 'chat-completions' : raw?.apiMode === 'responses' ? 'responses' : base.apiMode,
    apiBaseUrl: typeof raw?.apiBaseUrl === 'string' ? raw.apiBaseUrl : base.apiBaseUrl,
    apiKey: typeof raw?.apiKey === 'string' ? raw.apiKey : base.apiKey,
    model: typeof raw?.model === 'string' ? raw.model : base.model,
    reasoningEffort: AI_REASONING_EFFORTS.includes(raw?.reasoningEffort as AiReasoningEffort)
      ? (raw?.reasoningEffort as AiReasoningEffort)
      : base.reasoningEffort,
    temperature: typeof raw?.temperature === 'number' ? raw.temperature : base.temperature,
    maxLines: typeof raw?.maxLines === 'number' ? Math.max(1, Math.min(8, Math.round(raw.maxLines))) : base.maxLines,
    recentLogLimit:
      typeof raw?.recentLogLimit === 'number' ? Math.max(4, Math.min(24, Math.round(raw.recentLogLimit))) : base.recentLogLimit,
    characterName: typeof raw?.characterName === 'string' ? raw.characterName : base.characterName,
    characterProfile: typeof raw?.characterProfile === 'string' ? raw.characterProfile : base.characterProfile,
    worldSetting: typeof raw?.worldSetting === 'string' ? raw.worldSetting : base.worldSetting,
    promptNotes: typeof raw?.promptNotes === 'string' ? raw.promptNotes : base.promptNotes,
  }
}

export function normalizeGameConfig(parsed: Partial<GameConfig> | undefined): GameConfig {
  const baseConfig = cloneConfig(DEFAULT_CONFIG)

  return {
    ...baseConfig,
    ...parsed,
    prologue: Array.isArray(parsed?.prologue)
      ? parsed.prologue.filter((line): line is string => typeof line === 'string')
      : baseConfig.prologue,
    scenes: Array.isArray(parsed?.scenes) && parsed.scenes.length > 0 ? parsed.scenes : baseConfig.scenes,
    stats: Array.isArray(parsed?.stats) && parsed.stats.length > 0 ? parsed.stats : baseConfig.stats,
    dailyActions: Array.isArray(parsed?.dailyActions)
      ? parsed.dailyActions.map((action) => ({ ...action, narrative: normalizeNarrative(action.narrative) }))
      : baseConfig.dailyActions,
    events: Array.isArray(parsed?.events)
      ? parsed.events.map((event) => ({ ...event, narrative: normalizeNarrative(event.narrative) }))
      : baseConfig.events,
    maxEnergy: typeof parsed?.maxEnergy === 'number' ? Math.max(1, parsed.maxEnergy) : baseConfig.maxEnergy,
    defaultSceneId:
      typeof parsed?.defaultSceneId === 'string' && parsed.defaultSceneId.length > 0
        ? parsed.defaultSceneId
        : parsed?.scenes?.[0]?.id || baseConfig.defaultSceneId,
    ai: normalizeAiConfig(parsed?.ai, baseConfig.ai),
  }
}

export function loadConfig(): GameConfig {
  const saved = localStorage.getItem(CONFIG_STORAGE_KEY)
  if (!saved) return cloneConfig(DEFAULT_CONFIG)

  try {
    return normalizeGameConfig(JSON.parse(saved) as Partial<GameConfig>)
  } catch {
    return cloneConfig(DEFAULT_CONFIG)
  }
}

export function saveConfig(config: GameConfig) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
}
