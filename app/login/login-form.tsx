'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { Segmented } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import { PinPad } from '@/components/auth/pin-pad'
import { LanguageSwitch } from '@/components/language-switch'
import { useT } from '@/components/i18n-provider'
import { login, register } from '@/lib/actions/auth'

type Mode = 'login' | 'register'

export function LoginForm({
  familyName,
  registrationOpen,
  hasJoinCode,
}: {
  familyName: string
  registrationOpen: boolean
  hasJoinCode: boolean
}) {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const t = useT()

  const submit = (finalPin: string) => {
    setError('')
    if (!name.trim()) {
      setError(t('login.errName'))
      setPin('')
      return
    }
    startTransition(async () => {
      const res =
        mode === 'login'
          ? await login({ name, pin: finalPin })
          : await register({ name, pin: finalPin, joinCode })
      // 成功会重定向；走到这里说明有错误
      if (res && !res.ok) {
        setError(res.error)
        setPin('')
      }
    })
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center">
      <div className="mf-raised mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl">
        <Image
          src="/logo.jpg"
          alt="干饭厨子"
          width={80}
          height={80}
          className="relative h-full w-full object-cover"
          priority
        />
      </div>
      <h1 className="tracking-title text-xl font-bold text-ink">
        {t('login.title', { family: familyName })}
      </h1>
      <p className="mt-1 mb-6 text-sm text-secondary">
        {mode === 'login' ? t('login.subLogin') : t('login.subRegister')}
      </p>

      {registrationOpen && (
        <Segmented<Mode>
          className="mb-6 w-full max-w-[240px]"
          value={mode}
          onChange={(m) => {
            setMode(m)
            setPin('')
            setError('')
          }}
          options={[
            { value: 'login', label: t('login.login') },
            { value: 'register', label: t('login.register') },
          ]}
        />
      )}

      <div className="mb-6 w-full space-y-3">
        <Input
          placeholder={t('login.nickname')}
          value={name}
          maxLength={12}
          onChange={(e) => setName(e.target.value)}
        />
        {mode === 'register' && hasJoinCode && (
          <Input
            placeholder={t('login.joinCode')}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
        )}
      </div>

      <PinPad
        value={pin}
        onChange={setPin}
        onComplete={submit}
        error={!!error}
      />

      <div className="mt-5 h-5 text-sm text-danger">
        {pending ? <span className="text-secondary">{t('common.wait')}</span> : error}
      </div>

      <LanguageSwitch className="mt-8 w-[180px]" />
    </div>
  )
}
