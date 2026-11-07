'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes, meals, orders } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { getMeal } from '@/lib/meals'
import { localDateTimeToSec, nowSec } from '@/lib/time'
import { getT } from '@/lib/i18n/server'

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string }

const reDate = /^\d{4}-\d{2}-\d{2}$/
const reTime = /^\d{2}:\d{2}$/

export async function createMeal(input: {
  mealType: 'breakfast' | 'lunch' | 'dinner'
  date: string
  diningTime: string
  deadline: string
  title?: string
}): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }

  if (!reDate.test(input.date)) return { ok: false, error: t('err.dateFmt') }
  if (!reTime.test(input.diningTime) || !reTime.test(input.deadline))
    return { ok: false, error: t('err.timeFmt') }

  const tz = getSettings().timezone
  const diningSec = localDateTimeToSec(input.date, input.diningTime, tz)
  const deadlineSec = localDateTimeToSec(input.date, input.deadline, tz)

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
      createdBy: me.id,
    })
    .returning()
    .get()
  revalidatePath('/meals')
  revalidatePath('/home')
  return { ok: true, id: row.id }
}

export async function deleteMeal(id: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const meal = getMeal(id)
  if (!meal) return { ok: true }
  if (meal.createdBy !== me.id && !me.isAdmin)
    return { ok: false, error: t('err.onlyCreatorMeal') }
  db.delete(meals).where(eq(meals.id, id)).run()
  revalidatePath('/meals')
  revalidatePath('/home')
  return { ok: true }
}

/** 认领/取消「我来做这顿」（可接管他人） */
export async function toggleCook(id: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const meal = getMeal(id)
  if (!meal) return { ok: false, error: t('err.mealNotFound') }
  const next = meal.cookId === me.id ? null : me.id
  db.update(meals).set({ cookId: next }).where(eq(meals.id, id)).run()
  revalidatePath(`/meals/${id}`)
  revalidatePath('/meals')
  revalidatePath('/home')
  return { ok: true }
}

export async function setMealStatus(
  id: string,
  status: 'ordering' | 'cooking' | 'done' | 'cancelled',
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const meal = getMeal(id)
  if (!meal) return { ok: false, error: t('err.mealNotFound') }
  const allowed = me.isAdmin || meal.createdBy === me.id || meal.cookId === me.id
  if (!allowed) return { ok: false, error: t('err.cookOrAdmin') }
  db.update(meals).set({ status }).where(eq(meals.id, id)).run()
  revalidatePath(`/meals/${id}`)
  revalidatePath('/meals')
  revalidatePath('/home')
  return { ok: true }
}

const MAX_QTY = 99

function orderingGuard(mealId: string): 'notFound' | 'closed' | null {
  const meal = getMeal(mealId)
  if (!meal) return 'notFound'
  if (meal.status !== 'ordering' || nowSec() >= meal.orderDeadline) return 'closed'
  return null
}

function revalidateMeal(mealId: string) {
  revalidatePath(`/meals/${mealId}`)
  revalidatePath('/meals')
  revalidatePath('/home')
}

/**
 * 设置我在某饭局对某道菜的份数（0 = 取消）。仅在点菜开放且未截止时。
 * 份数支持「包子 ×5」这类早餐场景。
 */
export async function setOrderQuantity(
  mealId: string,
  dishId: string,
  quantity: number,
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const guard = orderingGuard(mealId)
  if (guard === 'notFound') return { ok: false, error: t('err.mealNotFound') }
  if (guard === 'closed') return { ok: false, error: t('err.orderClosed') }

  const qty = Math.max(0, Math.min(MAX_QTY, Math.floor(Number(quantity) || 0)))
  const mine = and(
    eq(orders.mealId, mealId),
    eq(orders.dishId, dishId),
    eq(orders.userId, me.id),
  )

  if (qty === 0) {
    db.delete(orders).where(mine).run()
  } else {
    const dish = db
      .select({ id: dishes.id })
      .from(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.status, 'active')))
      .get()
    if (!dish) return { ok: false, error: t('err.dishNotFound') }
    db.insert(orders)
      .values({ mealId, dishId, userId: me.id, quantity: qty })
      .onConflictDoUpdate({
        target: [orders.mealId, orders.dishId, orders.userId],
        set: { quantity: qty },
      })
      .run()
  }
  revalidateMeal(mealId)
  return { ok: true }
}

/** 一次点上多道菜（「随便来点」一键全点）。已点过的保持原份数。 */
export async function addOrders(
  mealId: string,
  dishIds: string[],
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const guard = orderingGuard(mealId)
  if (guard === 'notFound') return { ok: false, error: t('err.mealNotFound') }
  if (guard === 'closed') return { ok: false, error: t('err.orderClosed') }

  const ids = [...new Set(dishIds)].slice(0, 20)
  if (ids.length === 0) return { ok: true }
  const valid = db
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(inArray(dishes.id, ids), eq(dishes.status, 'active')))
    .all()
  db.transaction((tx) => {
    for (const d of valid) {
      tx.insert(orders)
        .values({ mealId, dishId: d.id, userId: me.id, quantity: 1 })
        .onConflictDoNothing()
        .run()
    }
  })
  revalidateMeal(mealId)
  return { ok: true }
}
