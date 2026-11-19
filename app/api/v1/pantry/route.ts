import { revalidatePath } from 'next/cache'
import { fail, ok, readJson, withApi } from '@/lib/api/http'
import { pantryOut } from '@/lib/api/serialize'
import { normalizePantryInput } from '@/lib/pantry'
import { createPantryItem, listPantry } from '@/lib/services/pantry'

export const dynamic = 'force-dynamic'

/** 家里库存（快过期的在前） */
export const GET = withApi(() => ok(listPantry().map(pantryOut)))

/** 新增：{ name, quantity?, unit?, location?: fridge|freezer|pantry, expiresOn?: YYYY-MM-DD, note? } */
export const POST = withApi(async (req, user) => {
  const body = await readJson(req)
  if (!body) return fail('badJson')
  const input = normalizePantryInput(body)
  if (!input.ok) return fail(input.error)
  const row = createPantryItem(input.value, user.id)
  revalidatePath('/pantry')
  return ok(pantryOut(row), 201)
})
