'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import { issueToken, listTokens, revokeToken } from '@/lib/api/tokens'

const MAX_TOKENS = 10

/** 新建令牌：明文只返回这一次 */
export async function createApiToken(
  name: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  if (listTokens(me.id).length >= MAX_TOKENS)
    return { ok: false, error: t('api.err.tooMany', { n: MAX_TOKENS }) }
  const { token } = issueToken(me.id, String(name ?? ''))
  revalidatePath('/me/api')
  return { ok: true, token }
}

export async function deleteApiToken(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  revokeToken(me.id, id)
  revalidatePath('/me/api')
  return { ok: true }
}
