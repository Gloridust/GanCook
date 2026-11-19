'use server'

import { getCurrentUser } from '@/lib/auth/user'
import { getMeal } from '@/lib/meals'
import { getLocale, getT } from '@/lib/i18n/server'
import { smartRecommend, type SmartResult } from '@/lib/recommend/service'

/** 点菜页「智能」配一桌 */
export async function smartPick(
  mealId: string,
  plan: Record<string, number>,
  excludeIds: string[],
): Promise<({ ok: true } & SmartResult) | { ok: false; error: string }> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const meal = getMeal(mealId)
  if (!meal) return { ok: false, error: t('err.mealNotFound') }
  const safePlan: Record<string, number> = {}
  for (const [k, v] of Object.entries(plan ?? {}).slice(0, 20))
    safePlan[String(k).slice(0, 40)] = Number(v) || 0
  const res = await smartRecommend({
    meal,
    plan: safePlan,
    excludeIds: Array.isArray(excludeIds) ? excludeIds.slice(0, 500).map(String) : [],
    locale: await getLocale(),
  })
  return { ok: true, ...res }
}
