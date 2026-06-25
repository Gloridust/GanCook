'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

/**
 * 分段选择器（Pill Picker）
 * 外层 trough 凹槽 + 内层滑动的白色浮起 bump（layoutId 实现位置滑动而非淡入）
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  layoutId = 'segmented-bump',
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
  layoutId?: string
}) {
  return (
    <div className={cn('mf-trough flex p-1', className)}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors',
              active ? 'text-accent' : 'text-secondary',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="mf-bump absolute inset-0 rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
