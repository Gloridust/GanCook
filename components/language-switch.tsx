'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Segmented } from '@/components/ui/segmented'
import { useLocale } from '@/components/i18n-provider'
import { setLocale } from '@/lib/actions/locale'
import type { Locale } from '@/lib/i18n/config'

export function LanguageSwitch({ className }: { className?: string }) {
  const locale = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const change = (l: Locale) =>
    startTransition(async () => {
      await setLocale(l)
      router.refresh()
    })

  return (
    <Segmented<Locale>
      className={className}
      value={locale}
      onChange={change}
      layoutId="lang-switch"
      options={[
        { value: 'zh', label: '中文' },
        { value: 'en', label: 'EN' },
      ]}
    />
  )
}
