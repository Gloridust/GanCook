import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { notifyChannels, type NotifyChannel } from '@/lib/db/schema'
import { getMealDetail } from '@/lib/meals'
import { getSettings } from '@/lib/settings'
import { fmtTime, nowSec } from '@/lib/time'
import type { NotifyEvent } from './events'
import {
  buildMessage,
  buildRequest,
  responseError,
  type NotifyContext,
  type NotifyDish,
} from './format'
import { getNotifyConfig } from './settings'

const SEND_TIMEOUT_MS = 10_000

function mealLink(baseUrl: string, mealId: string): string | null {
  if (!baseUrl) return null
  try {
    return new URL(`/meals/${mealId}`, baseUrl).toString()
  } catch {
    return null
  }
}

/** 组装一顿饭的推送上下文（含按菜聚合的点菜情况） */
export function mealContext(mealId: string): NotifyContext | null {
  const detail = getMealDetail(mealId)
  if (!detail) return null
  const { meal, cook, orders } = detail
  const tz = getSettings().timezone
  const cfg = getNotifyConfig()
  const byDish = new Map<string, NotifyDish>()
  for (const o of orders) {
    let d = byDish.get(o.dishId)
    if (!d) {
      d = { name: o.dishName, total: 0, people: [] }
      byDish.set(o.dishId, d)
    }
    d.total += o.quantity
    d.people.push(o.quantity > 1 ? `${o.userName}×${o.quantity}` : o.userName)
  }
  return {
    locale: cfg.locale,
    familyName: getSettings().familyName,
    meal: {
      id: meal.id,
      title: meal.title,
      mealType: meal.mealType,
      date: meal.date,
      diningTime: fmtTime(meal.diningTime, tz),
      deadline: fmtTime(meal.orderDeadline, tz),
      minutesLeft: Math.max(0, Math.round((meal.orderDeadline - nowSec()) / 60)),
    },
    dishes: [...byDish.values()].sort((a, b) => b.total - a.total),
    cookName: cook?.name ?? null,
    link: mealLink(cfg.baseUrl, meal.id),
  }
}

/** 发到一个渠道；成功返回 null，失败返回原因 */
export async function sendToChannel(
  channel: Pick<NotifyChannel, 'type' | 'url'>,
  event: NotifyEvent | 'test',
  ctx: NotifyContext,
): Promise<string | null> {
  const msg = buildMessage(event, ctx)
  const req = buildRequest(channel.type, channel.url, msg, event, ctx)
  try {
    const res = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: req.body,
      redirect: 'error',
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    const text = (await res.text()).slice(0, 2000)
    if (!res.ok) return `HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`
    return responseError(channel.type, text)
  } catch (error) {
    return (error as Error).name === 'TimeoutError'
      ? 'timeout'
      : (error as Error).message || 'network error'
  }
}

/** 把一个饭局事件推送到所有订阅了它的渠道（失败只记日志，不影响主流程） */
export async function notifyMeal(event: NotifyEvent, mealId: string): Promise<void> {
  const channels = db
    .select()
    .from(notifyChannels)
    .where(eq(notifyChannels.enabled, true))
    .all()
    .filter((c) => c.events.includes(event))
  if (channels.length === 0) return
  const ctx = mealContext(mealId)
  if (!ctx) return
  // 点菜结束但没人点：不打扰（自动饭局没人用时会很吵）
  if (event === 'cooking' && ctx.dishes.length === 0) return
  await Promise.all(
    channels.map(async (c) => {
      const err = await sendToChannel(c, event, ctx)
      if (err) console.warn(`[notify] ${c.name} (${c.type}) ${event} 失败：${err}`)
    }),
  )
}

/** 不阻塞调用方的推送 */
export function notifyMealInBackground(event: NotifyEvent, mealId: string): void {
  void notifyMeal(event, mealId).catch((e) =>
    console.error('[notify] dispatch failed', e),
  )
}
