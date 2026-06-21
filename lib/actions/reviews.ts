'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { reviews } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { getMeal } from '@/lib/meals'
import { getT } from '@/lib/i18n/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(200).optional(),
})

/** 提交/更新餐后评价（每人每饭局一条） */
export async function submitReview(
  mealId: string,
  input: { rating: number; comment?: string },
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const meal = getMeal(mealId)
  if (!meal) return { ok: false, error: t('err.mealNotFound') }
  if (meal.status !== 'done') return { ok: false, error: t('err.eatFirst') }

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t('review.needStar') }

  const existing = db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.mealId, mealId), eq(reviews.userId, me.id)))
    .get()

  if (existing) {
    db.update(reviews)
      .set({ rating: parsed.data.rating, comment: parsed.data.comment || null })
      .where(eq(reviews.id, existing.id))
      .run()
  } else {
    db.insert(reviews)
      .values({
        mealId,
        userId: me.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      })
      .run()
  }
  revalidatePath(`/meals/${mealId}`)
  return { ok: true }
}
