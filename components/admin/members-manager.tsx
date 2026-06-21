'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ShieldOff, UserMinus } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/components/i18n-provider'
import { setMemberAdmin, removeMember } from '@/lib/actions/admin'

type Member = {
  id: string
  name: string
  avatarPath: string | null
  isAdmin: boolean
}

export function MembersManager({
  members,
  meId,
}: {
  members: Member[]
  meId: string
}) {
  const router = useRouter()
  const t = useT()
  const [pending, startTransition] = useTransition()

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn()
      router.refresh()
    })

  return (
    <div className="space-y-2.5">
      {members.map((m) => (
        <div key={m.id} className="mf-raised flex items-center gap-3 p-3">
          <Avatar
            name={m.name}
            src={m.avatarPath ? `/api/uploads/${m.avatarPath}` : null}
            size={40}
          />
          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-ink">{m.name}</span>
              {m.isAdmin && <Badge tone="accent">{t('me.admin')}</Badge>}
              {m.id === meId && (
                <span className="text-xs text-secondary">{t('members.me')}</span>
              )}
            </div>
          </div>
          <div className="relative flex items-center gap-1">
            <button
              disabled={pending}
              title={m.isAdmin ? t('members.unsetAdmin') : t('members.setAdmin')}
              onClick={() => run(() => setMemberAdmin(m.id, !m.isAdmin))}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-secondary disabled:opacity-50"
            >
              {m.isAdmin ? (
                <ShieldOff className="h-4.5 w-4.5" />
              ) : (
                <Shield className="h-4.5 w-4.5" />
              )}
            </button>
            {m.id !== meId && (
              <button
                disabled={pending}
                title={t('members.remove')}
                onClick={() => {
                  if (confirm(t('members.removeConfirm', { name: m.name })))
                    run(() => removeMember(m.id))
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-danger disabled:opacity-50"
              >
                <UserMinus className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
