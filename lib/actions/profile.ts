'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { getCurrentUser, getUserByName } from '@/lib/auth/user'
import { createSession } from '@/lib/auth/session'
import { saveImage, deleteImage, fileToBuffer } from '@/lib/images'
import { getT } from '@/lib/i18n/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

/** 修改个人资料：昵称 + 头像 */
export async function updateProfile(form: FormData): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }

  const name = String(form.get('name') ?? '').trim()
  if (!name) return { ok: false, error: t('err.nameRequired') }
  if (name.length > 12) return { ok: false, error: t('err.nameTooLong') }
  const existing = getUserByName(name)
  if (existing && existing.id !== me.id)
    return { ok: false, error: t('err.nameTaken') }

  let avatarPath = me.avatarPath
  const file = form.get('avatar')
  if (file instanceof File && file.size > 0) {
    try {
      const newPath = await saveImage(await fileToBuffer(file), 'avatars')
      await deleteImage(me.avatarPath)
      avatarPath = newPath
    } catch (e) {
      return {
        ok: false,
        error:
          (e as Error).message === 'IMAGE_TOO_LARGE'
            ? t('err.imageTooLarge')
            : t('err.imageOnly'),
      }
    }
  }

  db.update(users).set({ name, avatarPath }).where(eq(users.id, me.id)).run()

  // 昵称在会话 token 里，更新后重新签发，保持一致
  await createSession({ userId: me.id, name, isAdmin: me.isAdmin })

  revalidatePath('/me')
  revalidatePath('/home')
  revalidatePath('/wall')
  return { ok: true }
}
