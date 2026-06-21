'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { ChevronLeft } from 'lucide-react'
import { Segmented } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { PinPad } from '@/components/auth/pin-pad'
import { LanguageSwitch } from '@/components/language-switch'
import { useT } from '@/components/i18n-provider'
import { login, register } from '@/lib/actions/auth'

type Mode = 'login' | 'register'
type Member = { id: string; name: string; avatarPath: string | null }

export function LoginForm({
  familyName,
  registrationOpen,
  hasJoinCode,
  members,
}: {
  familyName: string
  registrationOpen: boolean
  hasJoinCode: boolean
  members: Member[]
}) {
  const t = useT()
  const [mode, setMode] = useState<Mode>('login')
  const [selected, setSelected] = useState<Member | null>(null)
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const reset = () => {
    setPin('')
    setError('')
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setSelected(null)
    setName('')
    reset()
  }

  const submit = (finalPin: string) => {
    setError('')
    startTransition(async () => {
      const res =
        mode === 'login'
          ? await login({ name: selected!.name, pin: finalPin })
          : await register({ name, pin: finalPin, joinCode })
      if (res && !res.ok) {
        setError(res.error)
        setPin('')
      }
    })
  }

  const subtitle =
    mode === 'register'
      ? t('login.subRegister')
      : selected
        ? t('login.enterPin')
        : t('login.subLogin')

  return (
    <div className="flex w-full max-w-sm flex-col items-center">
      <div className="mb-4 h-20 w-20 overflow-hidden rounded-3xl">
        <Image
          src="/logo.webp"
          alt="干饭厨子"
          width={80}
          height={80}
          className="h-full w-full object-cover"
          priority
        />
      </div>
      <h1 className="tracking-title text-xl font-bold text-ink">
        {t('login.title', { family: familyName })}
      </h1>
      <p className="mt-1 mb-6 text-sm text-secondary">{subtitle}</p>

      {registrationOpen && !selected && (
        <Segmented<Mode>
          className="mb-6 w-full max-w-[240px]"
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'login', label: t('login.login') },
            { value: 'register', label: t('login.register') },
          ]}
        />
      )}

      {/* 登录：先选人，再输密码 */}
      {mode === 'login' &&
        (!selected ? (
          <div className="grid w-full grid-cols-3 gap-3">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelected(m)
                  reset()
                }}
                className="mf-raised mf-pressable flex flex-col items-center gap-2 p-3"
              >
                <Avatar
                  name={m.name}
                  src={m.avatarPath ? `/api/uploads/${m.avatarPath}` : null}
                  size={52}
                />
                <span className="relative max-w-full truncate text-sm font-medium text-ink">
                  {m.name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setSelected(null)
                reset()
              }}
              className="mb-4 inline-flex items-center gap-1 text-sm text-secondary"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('login.switchUser')}
            </button>
            <div className="mb-5 flex flex-col items-center gap-2">
              <Avatar
                name={selected.name}
                src={
                  selected.avatarPath
                    ? `/api/uploads/${selected.avatarPath}`
                    : null
                }
                size={64}
              />
              <span className="font-semibold text-ink">{selected.name}</span>
            </div>
            <PinPad
              value={pin}
              onChange={setPin}
              onComplete={submit}
              error={!!error}
            />
          </>
        ))}

      {/* 注册：输入新昵称 + 密码 */}
      {mode === 'register' && (
        <>
          <div className="mb-6 w-full space-y-3">
            <Input
              placeholder={t('login.nickname')}
              value={name}
              maxLength={12}
              onChange={(e) => setName(e.target.value)}
            />
            {hasJoinCode && (
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
            onComplete={(v) => {
              if (!name.trim()) {
                setError(t('login.errName'))
                setPin('')
                return
              }
              submit(v)
            }}
            error={!!error}
          />
        </>
      )}

      <div className="mt-5 h-5 text-sm text-danger">
        {pending ? (
          <span className="text-secondary">{t('common.wait')}</span>
        ) : (
          error
        )}
      </div>

      <LanguageSwitch className="mt-8 w-[180px]" />
    </div>
  )
}
