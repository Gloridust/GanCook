'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { meals } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { getMeal } from '@/lib/meals'
import { getT } from '@/lib/i18n/server'
import { notifyMealInBackground } from '@/lib/notify/dispatch'
import {
  addOrdersFor,
  createMealFor,
  setOrderQuantityFor,
  type CreateMealInput,
} from '@/lib/services/meals'

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string }

export async function createMeal(input: CreateMealInput): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const res = createMealFor(me, input)
  if (!res.ok) return { ok: false, error: t(`err.${res.code}`) }
  revalidatePath('/meals')
  revalidatePath('/home')
  return { ok: true, id: res.value.id }
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
  if (status === 'cooking' && meal.status === 'ordering')
    notifyMealInBackground('cooking', id)
  revalidatePath(`/meals/${id}`)
  revalidatePath('/meals')
  revalidatePath('/home')
  return { ok: true }
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
  const res = setOrderQuantityFor(me, mealId, dishId, quantity)
  if (!res.ok) return { ok: false, error: t(`err.${res.code}`) }
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
  const res = addOrdersFor(me, mealId, dishIds)
  if (!res.ok) return { ok: false, error: t(`err.${res.code}`) }
  revalidateMeal(mealId)
  return { ok: true }
}
