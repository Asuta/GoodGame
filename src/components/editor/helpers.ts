import type { Dispatch, SetStateAction } from 'react'

import { normalizeGameConfig, type GameConfig } from '@/lib/gameCore'

export type ConfigSetter = Dispatch<SetStateAction<GameConfig>>

export type EditorTabProps = {
  config: GameConfig
  setConfig: ConfigSetter
}

export function textToLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function linesToText(lines: string[] | undefined) {
  return (lines || []).join('\n')
}

export function updateConfigText(value: string, setConfig: ConfigSetter, setError: (value: string) => void) {
  setError('')
  try {
    const parsed = normalizeGameConfig(JSON.parse(value) as GameConfig)
    if (!parsed.title || !Array.isArray(parsed.stats) || !Array.isArray(parsed.dailyActions) || !Array.isArray(parsed.events)) {
      throw new Error('invalid')
    }
    setConfig(parsed)
  } catch {
    setError('JSON 结构无效，请检查后重试。')
  }
}
