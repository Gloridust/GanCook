import { ok, withApi } from '@/lib/api/http'
import { userOut } from '@/lib/api/serialize'
import { getSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

/** 当前令牌对应的成员 + 家庭信息 */
export const GET = withApi((_req, user) => {
  const s = getSettings()
  return ok({ user: userOut(user), family: { name: s.familyName, timezone: s.timezone } })
})
