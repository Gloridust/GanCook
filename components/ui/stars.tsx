'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Stars({
  value,
  onChange,
  size = 20,
}: {
  value: number
  onChange?: (v: number) => void
  size?: number
}) {
  const interactive = !!onChange
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(n)}
          className={cn(interactive && 'mf-pressable', !interactive && 'cursor-default')}
        >
          <Star
            style={{ width: size, height: size }}
            className={cn(
              n <= value ? 'fill-[#f0b429] text-[#f0b429]' : 'fill-none text-secondary/40',
            )}
          />
        </button>
      ))}
    </div>
  )
}
