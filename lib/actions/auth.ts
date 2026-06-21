'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createSession, clearSession, getSession } from '@/lib/auth/session'
import { getCurrentUser, isSetupNeeded, getUserByName } from '@/lib/auth/user'
import { getSettings, setSetting } from '@/lib/settings'
import { seedDefaultSchedules } from '@/lib/seed'
import { getT } from '@/lib/i18n/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

const isPin = (v: string) => /^\d{6}$/.test(v)

/** 首启：创建管理员 + 家庭名 + 默认规则 */
export async function setupAdmin(input: {
  familyName: string
  name: string
  pin: string
}): Promise<ActionResult> {
  const t = await getT()
  if (!isSetupNeeded()) return { ok: false, error: t('err.alreadySetup') }

  const name = input.name.trim()
  if (!name) return { ok: false, error: t('err.nameRequired') }
  if (name.length > 12) return { ok: false, error: t('err.nameTooLong') }
  if (!isPin(input.pin)) return { ok: false, error: t('err.pin6') }

  const familyName = input.familyName.trim().slice(0, 20) || '我家'
  const passwordHash = await hashPassword(input.pin)
  const user = db
    .insert(users)
    .values({ name, passwordHash, isAdmin: true })
    .returning()
    .get()

  setSetting('familyName', familyName)
  setSetting('registrationOpen', '1')
  seedDefaultSchedules()

  await createSession({ userId: user.id, name: user.name, isAdmin: true })
  redirect('/home')
}

/** 注册新成员 */
export async function register(input: {
  name: string
  pin: string
  joinCode?: string
}): Promise<ActionResult> {
  const t = await getT()
  if (isSetupNeeded()) redirect('/setup')

  const settings = getSettings()
  if (!settings.registrationOpen)
    return { ok: false, error: t('err.regClosed') }
  if (settings.joinCode && settings.joinCode !== (input.joinCode || '').trim())
    return { ok: false, error: t('err.badJoinCode') }

  const name = input.name.trim()
  if (!name) return { ok: false, error: t('err.nameRequired') }
  if (name.length > 12) return { ok: false, error: t('err.nameTooLong') }
  if (!isPin(input.pin)) return { ok: false, error: t('err.pin6') }
  if (getUserByName(name)) return { ok: false, error: t('err.nameTaken') }

  const passwordHash = await hashPassword(input.pin)
  const user = db
    .insert(users)
    .values({ name, passwordHash, isAdmin: false })
    .returning()
    .get()

  await createSession({ userId: user.id, name: user.name, isAdmin: false })
  redirect('/home')
}

/** 登录 */
export async function login(input: {
  name: string
  pin: string
}): Promise<ActionResult> {
  const t = await getT()
  if (isSetupNeeded()) redirect('/setup')

  const user = getUserByName(input.name.trim())
  if (!user) return { ok: false, error: t('err.badCredentials') }
  const valid = await verifyPassword(input.pin, user.passwordHash)
  if (!valid) return { ok: false, error: t('err.badCredentials') }

  await createSession({
    userId: user.id,
    name: user.name,
    isAdmin: user.isAdmin,
  })
  redirect('/home')
}

export async function logout(): Promise<void> {
  await clearSession()
  redirect('/login')
}

/** 修改密码 */
export async function changePassword(input: {
  oldPin: string
  newPin: string
}): Promise<ActionResult> {
  const t = await getT()
  const session = await getSession()
  if (!session) return { ok: false, error: t('err.loginRequired') }
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }

  if (!isPin(input.newPin)) return { ok: false, error: t('err.pin6') }
  const valid = await verifyPassword(input.oldPin, me.passwordHash)
  if (!valid) return { ok: false, error: t('err.oldPinWrong') }

  const passwordHash = await hashPassword(input.newPin)
  db.update(users).set({ passwordHash }).where(eq(users.id, me.id)).run()
  return { ok: true }
}
