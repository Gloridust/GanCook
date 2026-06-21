'use client'

import { createContext, useCallback, useContext } from 'react'
import { format, defaultLocale, type Locale } from '@/lib/i18n/config'
import type { Messages } from '@/lib/i18n/dictionaries'

type TFn = (key: string, vars?: Record<string, string | number>) => string

const I18nContext = createContext<{ locale: Locale; t: TFn }>({
  locale: defaultLocale,
  t: (k) => k,
})

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale
  messages: Messages
  children: React.ReactNode
}) {
  const t = useCallback<TFn>(
    (key, vars) => format(messages[key] ?? key, vars),
    [messages],
  )
  return (
    <I18nContext.Provider value={{ locale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT(): TFn {
  return useContext(I18nContext).t
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale
}
