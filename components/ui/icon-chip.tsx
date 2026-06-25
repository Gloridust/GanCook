import * as React from 'react'
import { cn } from '@/lib/utils'

type Tone = 'accent' | 'warn' | 'danger' | 'neutral'

const TONE: Record<Tone, string> = {
  accent: '',
  warn: '[background:rgba(224,161,58,0.16)] text-[#b3791f]',
  danger: 'bg-[rgb(217,83,79,0.14)] text-danger',
  neutral: 'bg-trough text-secondary',
}

/** 前导图标色块（青菜绿调，列表行/卡片用） */
export function IconChip({
  children,
  tone = 'accent',
  className,
}: {
  children: React.ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn('mf-chip [&_svg]:h-[18px] [&_svg]:w-[18px]', TONE[tone], className)}
    >
      {children}
    </span>
  )
}
