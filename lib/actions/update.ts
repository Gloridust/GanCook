'use server'

import { getCurrentUser } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import {
  checkForUpdate,
  performUpdate,
  type UpdateCheck,
  type UpdateResult,
} from '@/lib/update'

async function ensureAdmin(): Promise<string | null> {
  const me = await getCurrentUser()
  if (!me) {
    const t = await getT()
    return t('err.loginRequired')
  }
  if (!me.isAdmin) {
    const t = await getT()
    return t('err.adminRequired')
  }
  return null
}

export async function checkUpdate(): Promise<UpdateCheck | { ok: false; error: string }> {
  const err = await ensureAdmin()
  if (err) return { ok: false, error: err }
  return checkForUpdate()
}

export async function runUpdate(): Promise<UpdateResult | { ok: false; reason: 'error'; detail: string }> {
  const err = await ensureAdmin()
  if (err) return { ok: false, reason: 'error', detail: err }
  return performUpdate()
}
