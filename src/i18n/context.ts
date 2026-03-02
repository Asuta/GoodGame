import { createContext } from 'react'

import type { Locale } from '@/i18n/messages'

type TranslateVars = Record<string, string | number>

export type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: TranslateVars) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)
