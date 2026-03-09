import { DEFAULT_CONFIG } from './defaultConfig'
import { getMaxEnergyForConfig, normalizeNarrative } from './engine'
import type { AiConfig, AiReasoningEffort, GameConfig, TimeSlotDef } from './types'

export const CONFIG_STORAGE_KEY = 'daily-raising-editor-config-v2'

const AI_REASONING_EFFORTS: AiReasoningEffort[] = ['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh']
const RETIRED_AI_BASE_URLS = new Set(['https://right.codes/codex/v1'])
const RETIRED_AI_KEYS = new Set(['sk-eed610aca8c0429f8ced854b27035676'])

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

function normalizeTimeSlots(raw: TimeSlotDef[] | undefined, base: TimeSlotDef[]) {
  const normalized = Array.isArray(raw)
    ? raw
        .map((slot, index) => {
          const id = typeof slot?.id === 'string' && slot.id.trim() ? slot.id.trim() : `slot-${index + 1}`
          const baseSlot = base.find((item) => item.id === id)
          const rawLabel = typeof slot?.label === 'string' ? slot.label.trim() : ''
          const looksBroken = rawLabel.length > 0 && /^\?+$/.test(rawLabel)
          return {
            id,
            label: rawLabel && !looksBroken ? rawLabel : baseSlot?.label || `??${index + 1}`,
          }
        })
        .filter((slot, index, list) => list.findIndex((item) => item.id === slot.id) === index)
    : []

  return normalized.length > 0 ? normalized : base
}

export function normalizeGameConfig(parsed: Partial<GameConfig> | undefined): GameConfig {
  const baseConfig = cloneConfig(DEFAULT_CONFIG)
  const timeSlots = normalizeTimeSlots(parsed?.timeSlots, baseConfig.timeSlots)

  const config = {
    ...baseConfig,
    ...parsed,
    prologue: Array.isArray(parsed?.prologue)
      ? parsed.prologue.filter((line): line is string => typeof line === 'string')
      : baseConfig.prologue,
    scenes: Array.isArray(parsed?.scenes) && parsed.scenes.length > 0 ? parsed.scenes : baseConfig.scenes,
    stats: Array.isArray(parsed?.stats) && parsed.stats.length > 0 ? parsed.stats : baseConfig.stats,
    timeSlots,
    dailyActions: Array.isArray(parsed?.dailyActions)
      ? parsed.dailyActions.map((action) => {
          const baseAction = baseConfig.dailyActions.find((item) => item.id === action.id)
          return {
            ...action,
            availableTimeSlotIds: Array.isArray(action.availableTimeSlotIds)
              ? action.availableTimeSlotIds.filter((slotId): slotId is string => timeSlots.some((slot) => slot.id === slotId))
              : baseAction?.availableTimeSlotIds,
            narrative: normalizeNarrative(action.narrative),
          }
        })
      : baseConfig.dailyActions,
    events: Array.isArray(parsed?.events)
      ? parsed.events.map((event) => ({ ...event, narrative: normalizeNarrative(event.narrative) }))
      : baseConfig.events,
    defaultSceneId:
      typeof parsed?.defaultSceneId === 'string' && parsed.defaultSceneId.length > 0
        ? parsed.defaultSceneId
        : parsed?.scenes?.[0]?.id || baseConfig.defaultSceneId,
    ai: normalizeAiConfig(parsed?.ai, baseConfig.ai),
  } satisfies GameConfig

  return {
    ...config,
    maxEnergy: getMaxEnergyForConfig(config),
  }
}

export function loadConfig(): GameConfig {
  const saved = localStorage.getItem(CONFIG_STORAGE_KEY)
  if (!saved) return cloneConfig(DEFAULT_CONFIG)

  try {
    const parsed = JSON.parse(saved) as Partial<GameConfig>
    const parsedApiBaseUrl = typeof parsed.ai?.apiBaseUrl === 'string' ? parsed.ai.apiBaseUrl.trim().replace(/\/+$/, '') : ''
    const parsedApiKey = typeof parsed.ai?.apiKey === 'string' ? parsed.ai.apiKey.trim() : ''
    const usesRetiredConnection = RETIRED_AI_BASE_URLS.has(parsedApiBaseUrl) || RETIRED_AI_KEYS.has(parsedApiKey)

    if (usesRetiredConnection) {
      parsed.ai = {
        ...DEFAULT_CONFIG.ai,
        ...parsed.ai,
        apiBaseUrl: DEFAULT_CONFIG.ai.apiBaseUrl,
        apiKey: DEFAULT_CONFIG.ai.apiKey,
        model: DEFAULT_CONFIG.ai.model,
      }
    }

    return normalizeGameConfig(parsed)
  } catch {
    return cloneConfig(DEFAULT_CONFIG)
  }
}

export function saveConfig(config: GameConfig) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
}
