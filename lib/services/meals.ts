import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes, meals, orders, type Meal, type User } from '@/lib/db/schema'
import { getSettings } from '@/lib/settings'
import { getMeal } from '@/lib/meals'
import { localDateTimeToSec, nowSec } from '@/lib/time'
import { notifyMealInBackground } from '@/lib/notify/dispatch'
import { isValidDate, isValidTime } from '@/lib/date-input'

/**
 * 饭局 / 点菜的业务逻辑。Server Action 与开放 API 共用；
 * 失败返回错误码（对应 i18n 的 err.<code>），由调用方翻译或转成 API 错误。
 */
export type ServiceResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; code: string }

export const MAX_QTY = 99

export type CreateMealInput = {
  mealType: 'breakfast' | 'lunch' | 'dinner'
  date: string
  diningTime: string
  deadline: string
  title?: string | null
}

export function createMealFor(user: User, input: CreateMealInput): ServiceResult<Meal> {
  if (!['breakfast', 'lunch', 'dinner'].includes(input.mealType))
    return { ok: false, code: 'mealType' }
  if (!isValidDate(String(input.date))) return { ok: false, code: 'dateFmt' }
  if (!isValidTime(String(input.diningTime)) || !isValidTime(String(input.deadline)))
    return { ok: false, code: 'timeFmt' }

  const tz = getSettings().timezone
  const diningSec = localDateTimeToSec(input.date, input.diningTime, tz)
  const deadlineSec = localDateTimeToSec(input.date, input.deadline, tz)
  if (!Number.isFinite(diningSec) || !Number.isFinite(deadlineSec))
    return { ok: false, code: 'dateFmt' }

  const row = db
    .insert(meals)
    .values({
      title: input.title?.trim().slice(0, 30) || null,
      mealType: input.mealType,
      date: input.date,
      diningTime: diningSec,
      orderDeadline: deadlineSec,
      status: 'ordering',
      isAuto: false,
      createdBy: user.id,
    })
    .returning()
    .get()
  notifyMealInBackground('meal_created', row.id)
  return { ok: true, value: row }
}

function orderingGuard(mealId: string): string | null {
  const meal = getMeal(mealId)
  if (!meal) return 'mealNotFound'
  if (meal.status !== 'ordering' || nowSec() >= meal.orderDeadline) return 'orderClosed'
  return null
}

/** 设置某人在某饭局对某道菜的份数（0 = 取消） */
export function setOrderQuantityFor(
  user: User,
  mealId: string,
  dishId: string,
  quantity: number,
): ServiceResult<{ quantity: number }> {
  const guard = orderingGuard(mealId)
  if (guard) return { ok: false, code: guard }

  const qty = Math.max(0, Math.min(MAX_QTY, Math.floor(Number(quantity) || 0)))
  const mine = and(
    eq(orders.mealId, mealId),
    eq(orders.dishId, dishId),
    eq(orders.userId, user.id),
  )
  if (qty === 0) {
    db.delete(orders).where(mine).run()
    return { ok: true, value: { quantity: 0 } }
  }
  const dish = db
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.status, 'active')))
    .get()
  if (!dish) return { ok: false, code: 'dishNotFound' }
  db.insert(orders)
    .values({ mealId, dishId, userId: user.id, quantity: qty })
    .onConflictDoUpdate({
      target: [orders.mealId, orders.dishId, orders.userId],
      set: { quantity: qty },
    })
    .run()
  return { ok: true, value: { quantity: qty } }
}

/** 一次点上多道菜（已点过的保持原份数） */
export function addOrdersFor(
  user: User,
  mealId: string,
  dishIds: string[],
): ServiceResult<{ added: number }> {
  const guard = orderingGuard(mealId)
  if (guard) return { ok: false, code: guard }
  const ids = [...new Set(dishIds)].slice(0, 20)
  if (ids.length === 0) return { ok: true, value: { added: 0 } }
  const valid = db
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(inArray(dishes.id, ids), eq(dishes.status, 'active')))
    .all()
  let added = 0
  db.transaction((tx) => {
    for (const d of valid) {
      added += tx
        .insert(orders)
        .values({ mealId, dishId: d.id, userId: user.id, quantity: 1 })
        .onConflictDoNothing()
        .run().changes
    }
  })
  return { ok: true, value: { added } }
}
