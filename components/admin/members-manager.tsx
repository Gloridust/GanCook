'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ShieldOff, UserMinus } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { List, Row } from '@/components/ui/list'
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
    <List>
      {members.map((m) => (
        <Row
          key={m.id}
          chevron={false}
          leading={
            <Avatar
              name={m.name}
              src={m.avatarPath ? `/api/uploads/${m.avatarPath}` : null}
              size={38}
            />
          }
          title={
            <span className="flex items-center gap-2">
              {m.name}
              {m.isAdmin && <Badge tone="accent">{t('me.admin')}</Badge>}
              {m.id === meId && (
                <span className="text-xs font-normal text-secondary">
                  {t('members.me')}
                </span>
              )}
            </span>
          }
          trailing={
            <span className="flex items-center gap-1">
              <button
                disabled={pending}
                title={
                  m.isAdmin ? t('members.unsetAdmin') : t('members.setAdmin')
                }
                onClick={() => run(() => setMemberAdmin(m.id, !m.isAdmin))}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-secondary disabled:opacity-50"
              >
                {m.isAdmin ? (
                  <ShieldOff className="h-[18px] w-[18px]" />
                ) : (
                  <Shield className="h-[18px] w-[18px]" />
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
                  <UserMinus className="h-[18px] w-[18px]" />
                </button>
              )}
            </span>
          }
        />
      ))}
    </List>
  )
}
