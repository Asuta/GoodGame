import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG, cloneConfig, loadConfig, saveConfig, type GameConfig } from '@/lib/gameCore'

export function useGameConfig() {
  const [config, setConfigState] = useState<GameConfig>(() => loadConfig())

  useEffect(() => {
    saveConfig(config)
  }, [config])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CONFIG_STORAGE_KEY) return
      setConfigState(loadConfig())
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setConfig: Dispatch<SetStateAction<GameConfig>> = (updater) => {
    setConfigState((prev) => {
      const next = typeof updater === 'function' ? (updater as (value: GameConfig) => GameConfig)(prev) : updater
      return next
    })
  }

  const resetConfig = () => {
    setConfigState(cloneConfig(DEFAULT_CONFIG))
  }

  return { config, setConfig, resetConfig }
}
