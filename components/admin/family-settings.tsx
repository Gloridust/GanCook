'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/components/i18n-provider'
import { updateFamilySettings } from '@/lib/actions/admin'

export function FamilySettings({
  familyName: initName,
  registrationOpen: initOpen,
  joinCode: initCode,
}: {
  familyName: string
  registrationOpen: boolean
  joinCode: string
}) {
  const [familyName, setFamilyName] = useState(initName)
  const [registrationOpen, setRegistrationOpen] = useState(initOpen)
  const [joinCode, setJoinCode] = useState(initCode)
  const [msg, setMsg] = useState('')
  const [pending, startTransition] = useTransition()
  const t = useT()

  const save = () => {
    setMsg('')
    startTransition(async () => {
      const res = await updateFamilySettings({
        familyName,
        registrationOpen,
        joinCode,
      })
      setMsg(res.ok ? t('common.saved') : res.error)
    })
  }

  return (
    <div className="mf-raised space-y-4 p-4">
      <div>
        <Label>{t('setup.familyName')}</Label>
        <Input
          value={familyName}
          maxLength={20}
          onChange={(e) => setFamilyName(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="relative text-[15px] text-ink">{t('admin.allowReg')}</p>
          <p className="relative text-xs text-secondary">
            {t('admin.allowRegDesc')}
          </p>
        </div>
        <Switch checked={registrationOpen} onChange={setRegistrationOpen} />
      </div>

      <div>
        <Label>{t('admin.joinCode')}</Label>
        <Input
          value={joinCode}
          placeholder={t('admin.joinCodePh')}
          onChange={(e) => setJoinCode(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button loading={pending} onClick={save}>
          {t('admin.saveSettings')}
        </Button>
        {msg && <span className="text-sm text-accent">{msg}</span>}
      </div>
    </div>
  )
}
