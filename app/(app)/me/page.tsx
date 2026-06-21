import Link from 'next/link'
import { Settings, LogOut } from 'lucide-react'
import { requireUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { logout } from '@/lib/actions/auth'
import { PageHeader } from '@/components/page-header'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChangePassword } from '@/components/me/change-password'
import { LanguageSwitch } from '@/components/language-switch'
import { getT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function MePage() {
  const user = await requireUser()
  const s = getSettings()
  const t = await getT()

  return (
    <>
      <PageHeader title={t('me.title')} />

      <div className="mf-raised mb-5 flex items-center gap-4 p-5">
        <Avatar
          name={user.name}
          src={user.avatarPath ? `/api/uploads/${user.avatarPath}` : null}
          size={56}
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-ink">{user.name}</span>
            {user.isAdmin && <Badge tone="accent">{t('me.admin')}</Badge>}
          </div>
          <p className="text-sm text-secondary">{s.familyName}</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* 语言切换 */}
        <div className="mf-raised flex items-center justify-between p-4">
          <span className="relative text-[15px] text-ink">
            {t('me.language')}
          </span>
          <LanguageSwitch className="relative w-[150px]" />
        </div>

        <ChangePassword />

        {user.isAdmin && (
          <Link
            href="/admin"
            className="mf-raised mf-pressable flex w-full items-center gap-3 p-4"
          >
            <Settings className="relative h-5 w-5 text-accent" />
            <span className="relative text-[15px] text-ink">
              {t('me.familyAdmin')}
            </span>
          </Link>
        )}

        <form action={logout}>
          <Button type="submit" variant="trough" className="w-full" size="lg">
            <LogOut className="h-5 w-5" />
            {t('me.logout')}
          </Button>
        </form>
      </div>
    </>
  )
}
