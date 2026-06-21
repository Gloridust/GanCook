'use client'

import { Delete } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

/** 6 位数字密码键盘（牛奶布艺）。受控：value + onChange。满 6 位触发 onComplete。 */
export function PinPad({
  value,
  onChange,
  onComplete,
  length = 6,
  error,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  length?: number
  error?: boolean
}) {
  const press = (k: string) => {
    if (k === 'del') {
      onChange(value.slice(0, -1))
      return
    }
    if (k === '' || value.length >= length) return
    const next = value + k
    onChange(next)
    if (next.length === length) onComplete?.(next)
  }

  return (
    <div className="flex flex-col items-center gap-7">
      {/* 圆点显示 */}
      <motion.div
        className="flex gap-3.5"
        animate={error ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
      >
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-3.5 w-3.5 rounded-full transition-colors',
              i < value.length
                ? error
                  ? 'bg-danger'
                  : 'bg-accent'
                : 'mf-inset',
            )}
          />
        ))}
      </motion.div>

      {/* 键盘：每个键为圆角正方形（aspect-square 保证宽高相等） */}
      <div className="grid w-full max-w-[268px] grid-cols-3 gap-3">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              className={cn(
                'flex aspect-square w-full items-center justify-center rounded-3xl text-2xl font-medium text-ink',
                k === 'del'
                  ? 'mf-pressable text-secondary'
                  : 'mf-raised mf-pressable',
              )}
            >
              {k === 'del' ? <Delete className="h-6 w-6" /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
