import { Pencil } from 'lucide-react'
import { requireUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { getT } from '@/lib/i18n/server'
import { PageHeader } from '@/components/page-header'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { EditProfile } from '@/components/me/edit-profile'
import { SettingsList } from '@/components/me/settings-list'

export const dynamic = 'force-dynamic'

export default async function MePage() {
  const user = await requireUser()
  const s = getSettings()
  const t = await getT()

  return (
    <>
      <PageHeader title={t('me.title')} />

      {/* 资料头：绿色调 hero，点按编辑 */}
      <EditProfile name={user.name} avatarPath={user.avatarPath}>
        <button className="mf-tonal mf-pressable mb-6 flex w-full items-center gap-4 p-5">
          <Avatar
            name={user.name}
            src={user.avatarPath ? `/api/uploads/${user.avatarPath}` : null}
            size={60}
          />
          <div className="relative flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-title text-ink">
                {user.name}
              </span>
              {user.isAdmin && <Badge tone="accent">{t('me.admin')}</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-secondary">{s.familyName}</p>
          </div>
          <span className="mf-chip relative">
            <Pencil className="h-[18px] w-[18px]" />
          </span>
        </button>
      </EditProfile>

      <SettingsList isAdmin={user.isAdmin} />
    </>
  )
}
