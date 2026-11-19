import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/client'
import { dishes } from '@/lib/db/schema'
import { fail, ok, readJson, withApi } from '@/lib/api/http'
import { dishOut } from '@/lib/api/serialize'
import { deleteDishFor, updateDishFor } from '@/lib/services/dishes'

export const dynamic = 'force-dynamic'

type P = { id: string }

export const GET = withApi<P>((_req, _user, { id }) => {
  const dish = db.select().from(dishes).where(eq(dishes.id, id)).get()
  return dish ? ok(dishOut(dish)) : fail('dishNotFound')
})

/** 部分更新：name / description / instructions / tags / imageUrl / status */
export const PATCH = withApi<P>(async (req, user, { id }) => {
  const body = await readJson(req)
  if (!body) return fail('badJson')
  const res = await updateDishFor(user, id, body)
  if (!res.ok) return fail(res.code)
  revalidatePath('/dishes')
  return ok(dishOut(res.value))
})

/** 删除（点过的菜只下架，保留历史） */
export const DELETE = withApi<P>(async (_req, user, { id }) => {
  const res = await deleteDishFor(user, id)
  if (!res.ok) return fail(res.code)
  revalidatePath('/dishes')
  return ok(res.value)
})
