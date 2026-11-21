'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import { normalizePantryInput } from '@/lib/pantry'
import {
  createPantryItem,
  deletePantryItem,
  getPantryItem,
  updatePantryItem,
} from '@/lib/services/pantry'

export type ActionResult = { ok: true } | { ok: false; error: string }

/** 新增或修改一条库存（id 为空 = 新增） */
export async function savePantryItem(
  id: string | null,
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const input = normalizePantryInput(raw)
  if (!input.ok) return { ok: false, error: t(`pantry.err.${input.error}`) }
  if (id) {
    if (!updatePantryItem(id, input.value)) return { ok: false, error: t('pantry.err.notFound') }
  } else {
    createPantryItem(input.value, me.id)
  }
  revalidatePath('/pantry')
  return { ok: true }
}

/** 快速调整数量（±1），减到 0 不删除，保留「家里常备」的条目 */
export async function adjustPantryQuantity(id: string, delta: number): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const item = getPantryItem(id)
  if (!item) return { ok: false, error: t('pantry.err.notFound') }
  const next = Math.max(0, Math.min(99_999, (item.quantity ?? 0) + (Number(delta) || 0)))
  updatePantryItem(id, { quantity: Math.round(next * 100) / 100 })
  revalidatePath('/pantry')
  return { ok: true }
}

/** 「用完了」：数量归 0 但保留条目（常备的调料、食材下次补货直接 +） */
export async function markPantryUsedUp(id: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  if (!updatePantryItem(id, { quantity: 0 })) return { ok: false, error: t('pantry.err.notFound') }
  revalidatePath('/pantry')
  return { ok: true }
}

export async function removePantryItem(id: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  deletePantryItem(id)
  revalidatePath('/pantry')
  return { ok: true }
}
