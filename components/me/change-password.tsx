'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PinPad } from '@/components/auth/pin-pad'
import { useT } from '@/components/i18n-provider'
import { changePassword } from '@/lib/actions/auth'

/** 受控弹窗：由父级（设置列表的某一行）控制开关 */
export function ChangePassword({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [step, setStep] = useState<'old' | 'new'>('old')
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState(false)
  const [pending, startTransition] = useTransition()
  const t = useT()

  const reset = () => {
    setStep('old')
    setOldPin('')
    setNewPin('')
    setMsg('')
    setError(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent title={t('changepw.title')}>
        <div className="flex flex-col items-center pb-2">
          <p className="mb-6 text-sm text-secondary">
            {step === 'old' ? t('changepw.old') : t('changepw.new')}
          </p>
          {step === 'old' ? (
            <PinPad
              value={oldPin}
              onChange={setOldPin}
              error={error}
              onComplete={() => {
                setError(false)
                setStep('new')
              }}
            />
          ) : (
            <PinPad
              value={newPin}
              onChange={setNewPin}
              error={error}
              onComplete={(v) => {
                setMsg('')
                startTransition(async () => {
                  const res = await changePassword({ oldPin, newPin: v })
                  if (res.ok) {
                    setMsg(t('changepw.updated'))
                    setError(false)
                    setTimeout(() => onOpenChange(false), 800)
                  } else {
                    setError(true)
                    setMsg(res.error)
                    setStep('old')
                    setOldPin('')
                    setNewPin('')
                  }
                })
              }}
            />
          )}
          <div className="mt-4 h-5 text-sm">
            {pending ? (
              <span className="text-secondary">{t('common.submitting')}</span>
            ) : (
              <span className={error ? 'text-danger' : 'text-accent'}>
                {msg}
              </span>
            )}
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="mt-1">
              {t('changepw.cancel')}
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
