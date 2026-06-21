'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { saveImage, deleteImage, fileToBuffer } from '@/lib/images'
import { getT, type TFn } from '@/lib/i18n/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

function parseTags(raw: FormDataEntryValue | null): string[] {
  if (!raw) return []
  return String(raw)
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function imageError(t: TFn, e: unknown): string {
  return (e as Error).message === 'IMAGE_TOO_LARGE'
    ? t('err.imageTooLarge')
    : t('err.imageOnly')
}

function readName(form: FormData, t: TFn): string | { error: string } {
  const name = String(form.get('name') ?? '').trim()
  if (!name) return { error: t('err.dishNameRequired') }
  if (name.length > 30) return { error: t('err.dishNameTooLong') }
  return name
}

export async function createDish(form: FormData): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }

  const name = readName(form, t)
  if (typeof name !== 'string') return { ok: false, error: name.error }

  const description = String(form.get('description') ?? '').trim().slice(0, 200) || null
  const tags = parseTags(form.get('tags'))

  let imagePath: string | null = null
  const file = form.get('image')
  if (file instanceof File && file.size > 0) {
    try {
      imagePath = await saveImage(await fileToBuffer(file), 'dishes')
    } catch (e) {
      return { ok: false, error: imageError(t, e) }
    }
  }

  db.insert(dishes)
    .values({ name, description, tags, imagePath, createdBy: me.id })
    .run()

  revalidatePath('/dishes')
  return { ok: true }
}

export async function updateDish(
  id: string,
  form: FormData,
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const dish = db.select().from(dishes).where(eq(dishes.id, id)).get()
  if (!dish) return { ok: false, error: t('err.dishNotFound') }
  if (dish.createdBy !== me.id && !me.isAdmin)
    return { ok: false, error: t('err.onlyOwnerDishEdit') }

  const name = readName(form, t)
  if (typeof name !== 'string') return { ok: false, error: name.error }

  const description = String(form.get('description') ?? '').trim().slice(0, 200) || null
  const tags = parseTags(form.get('tags'))

  let imagePath = dish.imagePath
  const file = form.get('image')
  if (file instanceof File && file.size > 0) {
    try {
      const newPath = await saveImage(await fileToBuffer(file), 'dishes')
      await deleteImage(dish.imagePath)
      imagePath = newPath
    } catch (e) {
      return { ok: false, error: imageError(t, e) }
    }
  }

  db.update(dishes)
    .set({ name, description, tags, imagePath })
    .where(eq(dishes.id, id))
    .run()

  revalidatePath('/dishes')
  return { ok: true }
}

export async function setDishStatus(
  id: string,
  status: 'active' | 'archived',
): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  db.update(dishes).set({ status }).where(eq(dishes.id, id)).run()
  revalidatePath('/dishes')
  return { ok: true }
}

export async function deleteDish(id: string): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  const dish = db.select().from(dishes).where(eq(dishes.id, id)).get()
  if (!dish) return { ok: true }
  if (dish.createdBy !== me.id && !me.isAdmin)
    return { ok: false, error: t('err.onlyOwnerDishDel') }
  await deleteImage(dish.imagePath)
  db.delete(dishes).where(eq(dishes.id, id)).run()
  revalidatePath('/dishes')
  return { ok: true }
}
