import 'server-only'
import { getSetting } from '@/lib/settings'
import type { NotifyLocale } from './format'

export const NOTIFY_SETTING_KEYS = {
  baseUrl: 'notify.baseUrl',
  deadlineMinutes: 'notify.deadlineMinutes',
  locale: 'notify.locale',
} as const

export type NotifyConfig = {
  /** 外网访问地址（拼饭局链接用），可空 */
  baseUrl: string
  /** 截止前多少分钟提醒 */
  deadlineMinutes: number
  locale: NotifyLocale
}

export function getNotifyConfig(): NotifyConfig {
  const minutes = Number(getSetting(NOTIFY_SETTING_KEYS.deadlineMinutes))
  return {
    baseUrl: getSetting(NOTIFY_SETTING_KEYS.baseUrl) || '',
    deadlineMinutes:
      Number.isFinite(minutes) && minutes >= 5 && minutes <= 720 ? minutes : 30,
    locale: getSetting(NOTIFY_SETTING_KEYS.locale) === 'en' ? 'en' : 'zh',
  }
}
