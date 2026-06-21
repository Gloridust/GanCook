import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/zh-cn'
import { TIMEZONE } from '@/lib/env'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)
dayjs.locale('zh-cn')

export { dayjs }

export const MEAL_LABELS: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
}

export const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🌅',
  lunch: '🍱',
  dinner: '🍲',
}

/** 当前 unix 秒 */
export function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

/** 把家庭时区下的「某天 + HH:MM」转成 unix 秒 */
export function localDateTimeToSec(
  date: string,
  hhmm: string,
  tz: string = TIMEZONE,
): number {
  return dayjs.tz(`${date} ${hhmm}`, 'YYYY-MM-DD HH:mm', tz).unix()
}

/** 家庭时区下的今天 YYYY-MM-DD */
export function todayLocal(tz: string = TIMEZONE): string {
  return dayjs().tz(tz).format('YYYY-MM-DD')
}

/** 格式化用餐时间用于展示 */
export function fmtTime(sec: number, tz: string = TIMEZONE): string {
  return dayjs.unix(sec).tz(tz).format('HH:mm')
}

export function fmtDate(sec: number, tz: string = TIMEZONE): string {
  return dayjs.unix(sec).tz(tz).format('M月D日')
}

type TFn = (key: string, vars?: Record<string, string | number>) => string

/** 友好日期标签（今天/明天/昨天/M月D日），需传入翻译函数 t */
export function fmtDateLabel(date: string, tz: string, t: TFn): string {
  const d = dayjs.tz(date, 'YYYY-MM-DD', tz)
  const today = dayjs().tz(tz).startOf('day')
  const diff = d.startOf('day').diff(today, 'day')
  if (diff === 0) return t('date.today')
  if (diff === 1) return t('date.tomorrow')
  if (diff === -1) return t('date.yesterday')
  return t('date.md', { m: d.month() + 1, d: d.date() })
}

/** 相对截止时间的友好文案，需传入翻译函数 t */
export function deadlineText(
  deadlineSec: number,
  tz: string,
  t: TFn,
): string {
  const now = nowSec()
  if (now >= deadlineSec) return t('deadline.ended')
  const mins = Math.round((deadlineSec - now) / 60)
  if (mins < 60) return t('deadline.minutes', { n: mins })
  const hours = Math.round(mins / 60)
  if (hours < 24) return t('deadline.hours', { n: hours })
  const d = dayjs.unix(deadlineSec).tz(tz)
  return t('deadline.at', {
    date: t('date.md', { m: d.month() + 1, d: d.date() }),
    time: fmtTime(deadlineSec, tz),
  })
}
