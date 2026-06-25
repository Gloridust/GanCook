'use client'

import { useState, useTransition } from 'react'
import { Languages, KeyRound, Settings, LogOut } from 'lucide-react'
import { List, Row } from '@/components/ui/list'
import { IconChip } from '@/components/ui/icon-chip'
import { LanguageSwitch } from '@/components/language-switch'
import { ChangePassword } from '@/components/me/change-password'
import { useT } from '@/components/i18n-provider'
import { logout } from '@/lib/actions/auth'

export function SettingsList({ isAdmin }: { isAdmin: boolean }) {
  const t = useT()
  const [pwOpen, setPwOpen] = useState(false)
  const [, startTransition] = useTransition()

  return (
    <>
      <List>
        <Row
          leading={
            <IconChip>
              <Languages />
            </IconChip>
          }
          title={t('me.language')}
          trailing={<LanguageSwitch className="w-[136px]" />}
          chevron={false}
        />
        <Row
          leading={
            <IconChip>
              <KeyRound />
            </IconChip>
          }
          title={t('me.changePassword')}
          onClick={() => setPwOpen(true)}
        />
        {isAdmin && (
          <Row
            leading={
              <IconChip>
                <Settings />
              </IconChip>
            }
            title={t('me.familyAdmin')}
            href="/admin"
          />
        )}
        <Row
          leading={
            <IconChip tone="danger">
              <LogOut />
            </IconChip>
          }
          title={<span className="text-danger">{t('me.logout')}</span>}
          onClick={() => startTransition(() => void logout())}
          chevron={false}
        />
      </List>

      <ChangePassword open={pwOpen} onOpenChange={setPwOpen} />
    </>
  )
}
