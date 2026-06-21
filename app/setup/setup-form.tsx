'use client'

import { useState, useTransition } from 'react'
import { Sprout } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PinPad } from '@/components/auth/pin-pad'
import { LanguageSwitch } from '@/components/language-switch'
import { useT } from '@/components/i18n-provider'
import { setupAdmin } from '@/lib/actions/auth'

export function SetupForm() {
  const [step, setStep] = useState<'info' | 'pin'>('info')
  const [familyName, setFamilyName] = useState('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const t = useT()

  const next = () => {
    setError('')
    if (!name.trim()) return setError(t('setup.errName'))
    setStep('pin')
  }

  const submit = (finalPin: string) => {
    setError('')
    startTransition(async () => {
      const res = await setupAdmin({ familyName, name, pin: finalPin })
      if (res && !res.ok) {
        setError(res.error)
        setPin('')
      }
    })
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center">
      <div className="mf-raised mb-4 flex h-20 w-20 items-center justify-center rounded-3xl text-accent">
        <Sprout className="relative h-9 w-9" />
      </div>
      <h1 className="tracking-title text-xl font-bold text-ink">
        {t('setup.welcome')}
      </h1>
      <p className="mt-1 mb-7 text-center text-sm text-secondary">
        {step === 'info' ? t('setup.step1') : t('setup.step2')}
      </p>

      {step === 'info' ? (
        <div className="w-full space-y-4">
          <div>
            <Label htmlFor="familyName">{t('setup.familyName')}</Label>
            <Input
              id="familyName"
              placeholder={t('setup.familyNamePh')}
              value={familyName}
              maxLength={20}
              onChange={(e) => setFamilyName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="name">{t('setup.yourName')}</Label>
            <Input
              id="name"
              placeholder={t('setup.yourNamePh')}
              value={name}
              maxLength={12}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button className="mt-2 w-full" size="lg" onClick={next}>
            {t('setup.next')}
          </Button>
          {error && (
            <p className="text-center text-sm text-danger">{error}</p>
          )}
        </div>
      ) : (
        <>
          <PinPad
            value={pin}
            onChange={setPin}
            onComplete={submit}
            error={!!error}
          />
          <button
            type="button"
            className="mt-5 text-sm text-secondary"
            onClick={() => {
              setStep('info')
              setPin('')
              setError('')
            }}
          >
            {t('setup.prev')}
          </button>
          <div className="mt-2 h-5 text-sm text-danger">
            {pending ? (
              <span className="text-secondary">{t('setup.creating')}</span>
            ) : (
              error
            )}
          </div>
        </>
      )}
      <LanguageSwitch className="mt-8 w-[180px]" />
    </div>
  )
}
