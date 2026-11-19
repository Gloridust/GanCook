import { revalidatePath } from 'next/cache'
import { fail, ok, readJson, withApi } from '@/lib/api/http'
import { pantryOut } from '@/lib/api/serialize'
import { normalizePantryInput } from '@/lib/pantry'
import {
  deletePantryItem,
  getPantryItem,
  updatePantryItem,
} from '@/lib/services/pantry'

export const dynamic = 'force-dynamic'

type P = { id: string }

/** 部分更新：未传的字段保持不变 */
export const PATCH = withApi<P>(async (req, _user, { id }) => {
  const existing = getPantryItem(id)
  if (!existing) return fail('notFound')
  const body = await readJson(req)
  if (!body) return fail('badJson')
  const input = normalizePantryInput({ ...existing, ...body })
  if (!input.ok) return fail(input.error)
  const row = updatePantryItem(id, input.value)
  revalidatePath('/pantry')
  return row ? ok(pantryOut(row)) : fail('notFound')
})

export const DELETE = withApi<P>((_req, _user, { id }) => {
  if (!deletePantryItem(id)) return fail('notFound')
  revalidatePath('/pantry')
  return ok({ deleted: true })
})
