import { fail, ok, readJson, withApi } from '@/lib/api/http'
import { getMeal, myOrderQuantities } from '@/lib/meals'
import { smartRecommend } from '@/lib/recommend/service'

export const dynamic = 'force-dynamic'

/**
 * 智能配一桌（不会自动下单）：
 * { plan?: { "荤菜": 1, "素菜": 1, "汤": 1, "__any__": 0 }, locale?: "zh" | "en" }
 */
export const POST = withApi<{ id: string }>(async (req, user, { id }) => {
  const meal = getMeal(id)
  if (!meal) return fail('mealNotFound')
  const body = (await readJson(req)) ?? {}
  const plan =
    body.plan && typeof body.plan === 'object' && !Array.isArray(body.plan)
      ? Object.fromEntries(
          Object.entries(body.plan as Record<string, unknown>)
            .slice(0, 20)
            .map(([k, v]) => [k.slice(0, 40), Number(v) || 0]),
        )
      : { __any__: 3 }
  const res = await smartRecommend({
    meal,
    plan,
    // 令牌所属成员已点的菜不再推荐（和网页端一致）
    excludeIds: Object.keys(myOrderQuantities(id, user.id)),
    locale: body.locale === 'en' ? 'en' : 'zh',
  })
  return ok(res)
})
