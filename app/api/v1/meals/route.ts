import { revalidatePath } from 'next/cache'
import { fail, ok, readJson, withApi } from '@/lib/api/http'
import { mealOut } from '@/lib/api/serialize'
import { listActiveMeals, listHistoryMeals } from '@/lib/meals'
import { createMealFor, type CreateMealInput } from '@/lib/services/meals'

export const dynamic = 'force-dynamic'

/**
 * 饭局列表：?status=active（点菜中/做饭中，默认）| history（已完成/已取消）
 * history 支持 &limit=20 与 &before=<上一页返回的 nextBefore> 翻页
 */
export const GET = withApi((req) => {
  const url = new URL(req.url)
  if (url.searchParams.get('status') === 'history') {
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 20))
    // 游标形如 "<diningTime>:<id>"，直接用上一页返回的 nextBefore
    const beforeRaw = url.searchParams.get('before')
    let before: { diningTime: number; id: string } | undefined
    if (beforeRaw !== null) {
      const m = /^(\d+):([\w-]{1,64})$/.exec(beforeRaw)
      if (!m) return fail('beforeInvalid')
      before = { diningTime: Number(m[1]), id: m[2] }
    }
    const { items, hasMore } = listHistoryMeals({ limit, includeEmpty: false, before })
    return Response.json(
      {
        data: items.map(mealOut),
        hasMore,
        nextBefore: hasMore
          ? `${items[items.length - 1].diningTime}:${items[items.length - 1].id}`
          : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }
  return ok(listActiveMeals().map(mealOut))
})

/** 开一顿饭：{ mealType, date: YYYY-MM-DD, diningTime: HH:MM, deadline: HH:MM, title? } */
export const POST = withApi(async (req, user) => {
  const body = await readJson(req)
  if (!body) return fail('badJson')
  const res = createMealFor(user, {
    mealType: body.mealType as CreateMealInput['mealType'],
    date: String(body.date ?? ''),
    diningTime: String(body.diningTime ?? ''),
    deadline: String(body.deadline ?? ''),
    title: body.title == null ? null : String(body.title),
  })
  if (!res.ok) return fail(res.code)
  revalidatePath('/meals')
  revalidatePath('/home')
  return ok(mealOut(res.value), 201)
})
