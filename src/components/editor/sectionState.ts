import type { Dispatch, SetStateAction } from 'react'

export type SectionState = Record<string, boolean>
export type SectionStateSetter = Dispatch<SetStateAction<SectionState>>

export function isSectionOpen(state: SectionState, key: string, defaultOpen = false) {
  return state[key] ?? defaultOpen
}

export function toggleSectionState(setter: SectionStateSetter, key: string, defaultOpen = false) {
  setter((prev) => ({
    ...prev,
    [key]: !(prev[key] ?? defaultOpen),
  }))
}
