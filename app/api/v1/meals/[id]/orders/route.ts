import { revalidatePath } from 'next/cache'
import { fail, ok, readJson, withApi } from '@/lib/api/http'
import { addOrdersFor, setOrderQuantityFor } from '@/lib/services/meals'

export const dynamic = 'force-dynamic'

/**
 * 以令牌所属成员的身份点菜：
 * - { dishId, quantity }：设置份数（0 = 取消）
 * - { dishIds: [...] }：一次点上多道（各 1 份，已点的不变）
 */
export const POST = withApi<{ id: string }>(async (req, user, { id }) => {
  const body = await readJson(req)
  if (!body) return fail('badJson')
  const res = Array.isArray(body.dishIds)
    ? addOrdersFor(user, id, body.dishIds.map(String))
    : body.dishId && body.quantity !== undefined
      ? setOrderQuantityFor(user, id, String(body.dishId), Number(body.quantity))
      : ({ ok: false, code: 'badJson' } as const)
  if (!res.ok) return fail(res.code)
  revalidatePath(`/meals/${id}`)
  revalidatePath('/meals')
  revalidatePath('/home')
  return ok(res.value)
})
