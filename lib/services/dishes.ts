import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes, orders, type Dish, type User } from '@/lib/db/schema'
import { deleteImage, saveImage } from '@/lib/images'
import { safeFetchResource } from '@/lib/recipe/fetch'
import type { ServiceResult } from './meals'

/** 开放 API 用的菜品读写（与网页表单同样的长度限制） */
export type DishFields = {
  name?: unknown
  description?: unknown
  instructions?: unknown
  tags?: unknown
  imageUrl?: unknown
}

type Normalized = {
  name?: string
  description?: string | null
  instructions?: string | null
  tags?: string[]
}

export function normalizeDishFields(
  raw: DishFields,
  partial: boolean,
): ServiceResult<Normalized> {
  const out: Normalized = {}
  if (raw.name !== undefined || !partial) {
    const name = String(raw.name ?? '').trim()
    if (!name) return { ok: false, code: 'dishNameRequired' }
    if (name.length > 30) return { ok: false, code: 'dishNameTooLong' }
    out.name = name
  }
  if (raw.description !== undefined)
    out.description = String(raw.description ?? '').trim().slice(0, 200) || null
  if (raw.instructions !== undefined) {
    const v = Array.isArray(raw.instructions)
      ? raw.instructions.map((s, i) => `${i + 1}. ${String(s).trim()}`).join('\n')
      : String(raw.instructions ?? '')
    out.instructions = v.trim().slice(0, 50_000) || null
  }
  if (raw.tags !== undefined) {
    const list = Array.isArray(raw.tags)
      ? raw.tags.map(String)
      : String(raw.tags ?? '').split(/[,，\s]+/)
    out.tags = [...new Set(list.map((t) => t.trim().slice(0, 20)).filter(Boolean))].slice(0, 6)
  }
  return { ok: true, value: out }
}

async function imageFromUrl(url: unknown): Promise<ServiceResult<string | null>> {
  if (url === undefined || url === null || url === '') return { ok: true, value: null }
  try {
    const res = await safeFetchResource(String(url), 'image')
    return { ok: true, value: await saveImage(res.body, 'dishes') }
  } catch {
    return { ok: false, code: 'imageFetch' }
  }
}

export async function createDishFor(user: User, raw: DishFields): Promise<ServiceResult<Dish>> {
  const n = normalizeDishFields(raw, false)
  if (!n.ok) return n
  const img = await imageFromUrl(raw.imageUrl)
  if (!img.ok) return img
  try {
    const row = db
      .insert(dishes)
      .values({
        name: n.value.name!,
        description: n.value.description ?? null,
        instructions: n.value.instructions ?? null,
        tags: n.value.tags ?? [],
        imagePath: img.value,
        createdBy: user.id,
      })
      .returning()
      .get()
    return { ok: true, value: row }
  } catch {
    await deleteImage(img.value)
    return { ok: false, code: 'saveFailed' }
  }
}

function canEdit(user: User, dish: Dish): boolean {
  return user.isAdmin || dish.createdBy === user.id
}

export async function updateDishFor(
  user: User,
  id: string,
  raw: DishFields & { status?: unknown },
): Promise<ServiceResult<Dish>> {
  const dish = db.select().from(dishes).where(eq(dishes.id, id)).get()
  if (!dish) return { ok: false, code: 'dishNotFound' }
  const n = normalizeDishFields(raw, true)
  if (!n.ok) return n
  const patch: Partial<Dish> = { ...n.value }
  // 上架 / 下架和网页端一样人人可改；改内容需是创建者或管理员
  if (raw.status !== undefined) {
    if (raw.status !== 'active' && raw.status !== 'archived')
      return { ok: false, code: 'statusInvalid' }
    patch.status = raw.status
  }
  // 「GET 回来改几个字段再整个 PATCH 回去」时，imageUrl 会是原样的相对地址：视为不变
  const changesImage =
    raw.imageUrl !== undefined && !isCurrentImage(raw.imageUrl, dish.imagePath)
  const changesContent = (Object.keys(n.value) as (keyof typeof n.value)[]).some(
    (k) => JSON.stringify(n.value[k] ?? null) !== JSON.stringify(dish[k] ?? null),
  )
  if ((changesContent || changesImage) && !canEdit(user, dish))
    return { ok: false, code: 'onlyOwnerDishEdit' }

  const img = changesImage ? await imageFromUrl(raw.imageUrl) : null
  if (img && !img.ok) return img
  if (img) patch.imagePath = img.value
  // 没有任何可改的字段（如 {} 或只有未知字段）：原样返回
  if (Object.keys(patch).length === 0) return { ok: true, value: dish }

  let row: Dish
  try {
    row = db.update(dishes).set(patch).where(eq(dishes.id, id)).returning().get()
  } catch {
    if (img?.value) await deleteImage(img.value)
    return { ok: false, code: 'saveFailed' }
  }
  if (img && dish.imagePath && dish.imagePath !== img.value) await deleteImage(dish.imagePath)
  return { ok: true, value: row }
}

function isCurrentImage(url: unknown, imagePath: string | null): boolean {
  if (url === null || url === '') return imagePath === null
  return typeof url === 'string' && imagePath !== null && url === `/api/uploads/${imagePath}`
}

/** 删除：点过的菜只下架（保留历史），没点过的真删 */
export async function deleteDishFor(
  user: User,
  id: string,
): Promise<ServiceResult<{ archived: boolean }>> {
  const dish = db.select().from(dishes).where(eq(dishes.id, id)).get()
  if (!dish) return { ok: false, code: 'dishNotFound' }
  if (!canEdit(user, dish)) return { ok: false, code: 'onlyOwnerDishDel' }
  const used = db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.dishId, id))
    .limit(1)
    .get()
  if (used) {
    db.update(dishes).set({ status: 'archived' }).where(eq(dishes.id, id)).run()
    return { ok: true, value: { archived: true } }
  }
  db.delete(dishes).where(eq(dishes.id, id)).run()
  await deleteImage(dish.imagePath)
  return { ok: true, value: { archived: false } }
}
