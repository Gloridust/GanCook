import 'server-only'
import { cookies } from 'next/headers'
import {
  LOCALE_COOKIE,
  defaultLocale,
  isLocale,
  format,
  type Locale,
} from './config'
import { dictionaries } from './dictionaries'

export async function getLocale(): Promise<Locale> {
  const c = await cookies()
  return isLocale(c.get(LOCALE_COOKIE)?.value)
    ? (c.get(LOCALE_COOKIE)!.value as Locale)
    : defaultLocale
}

export function getMessages(locale: Locale) {
  return dictionaries[locale]
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string

/** 服务端翻译函数（服务端组件 / Server Action 中用） */
export async function getT(): Promise<TFn> {
  const locale = await getLocale()
  const msgs = dictionaries[locale]
  return (key, vars) => format(msgs[key] ?? key, vars)
}
