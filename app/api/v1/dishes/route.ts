import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes } from '@/lib/db/schema'
import { fail, ok, readJson, withApi } from '@/lib/api/http'
import { dishOut } from '@/lib/api/serialize'
import { matchDish } from '@/lib/dish-categories'
import { createDishFor } from '@/lib/services/dishes'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

/** 菜品列表：?q=搜索词 &tag=分类 &status=active|archived|all（默认 active） */
export const GET = withApi((req) => {
  const url = new URL(req.url)
  const q = url.searchParams.get('q') ?? ''
  const tag = url.searchParams.get('tag')
  const status = url.searchParams.get('status') ?? 'active'
  const base = db.select().from(dishes)
  const rows = (
    status === 'all'
      ? base
      : base.where(eq(dishes.status, status === 'archived' ? 'archived' : 'active'))
  )
    .orderBy(desc(dishes.createdAt))
    .all()
    .filter((d) => matchDish(d, q) && (!tag || (d.tags ?? []).includes(tag)))
  return ok(rows.map(dishOut))
})

/** 新建菜品：{ name, description?, instructions?(字符串或步骤数组), tags?, imageUrl? } */
export const POST = withApi(async (req, user) => {
  const body = await readJson(req)
  if (!body) return fail('badJson')
  const res = await createDishFor(user, body)
  if (!res.ok) return fail(res.code)
  revalidatePath('/dishes')
  return ok(dishOut(res.value), 201)
})
