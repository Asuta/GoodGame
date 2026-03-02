import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'

import { I18nContext, type I18nContextValue } from '@/i18n/context'
import { messages, type Locale } from '@/i18n/messages'

const STORAGE_KEY = 'goodgame.locale'

function resolveInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'zh') {
    return stored
  }
  return 'en'
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) {
    return template
  }

  return Object.entries(vars).reduce((text, [key, value]) => {
    return text.replaceAll(`{${key}}`, String(value))
  }, template)
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocale] = useState<Locale>(resolveInitialLocale)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const value = messages[locale][key] ?? messages.en[key] ?? key
      return interpolate(value, vars)
    },
    [locale],
  )

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
