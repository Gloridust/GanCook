import { revalidatePath } from 'next/cache'
import { fail, ok, readJson, withApi } from '@/lib/api/http'
import { mealOut } from '@/lib/api/serialize'
import { listActiveMeals, listHistoryMeals } from '@/lib/meals'
import { createMealFor, type CreateMealInput } from '@/lib/services/meals'

export const dynamic = 'force-dynamic'

/** 饭局列表：?status=active（点菜中/做饭中，默认）| history（已完成/已取消）&limit=20 */
export const GET = withApi((req) => {
  const url = new URL(req.url)
  if (url.searchParams.get('status') === 'history') {
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 20))
    const { items, hasMore } = listHistoryMeals({ limit, includeEmpty: false })
    return Response.json(
      { data: items.map(mealOut), hasMore },
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
