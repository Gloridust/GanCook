'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check, Soup } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/components/i18n-provider'
import { toggleOrder } from '@/lib/actions/meals'
import type { Dish } from '@/lib/db/schema'

export function OrderPicker({
  mealId,
  dishes,
  initialSelected,
}: {
  mealId: string
  dishes: Dish[]
  initialSelected: string[]
}) {
  const router = useRouter()
  const t = useT()
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelected),
  )
  const [, startTransition] = useTransition()
  const [error, setError] = useState('')

  const toggle = (dishId: string) => {
    const next = new Set(selected)
    const wasSelected = next.has(dishId)
    if (wasSelected) next.delete(dishId)
    else next.add(dishId)
    setSelected(next)
    setError('')

    startTransition(async () => {
      const res = await toggleOrder(mealId, dishId)
      if (!res.ok) {
        // 回滚
        setSelected((cur) => {
          const back = new Set(cur)
          if (wasSelected) back.add(dishId)
          else back.delete(dishId)
          return back
        })
        setError(res.error)
      } else {
        router.refresh()
      }
    })
  }

  if (dishes.length === 0) {
    return (
      <p className="rounded-2xl mf-inset p-4 text-center text-sm text-secondary">
        {t('picker.empty')}
      </p>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5">
        {dishes.map((dish) => {
          const on = selected.has(dish.id)
          return (
            <button
              key={dish.id}
              type="button"
              onClick={() => toggle(dish.id)}
              className={cn(
                'mf-raised mf-pressable relative overflow-hidden p-0 transition-shadow',
                on && 'ring-2 ring-accent ring-offset-2 ring-offset-base',
              )}
            >
              <div className="relative aspect-square w-full">
                {dish.imagePath ? (
                  <Image
                    src={`/api/uploads/${dish.imagePath}`}
                    alt={dish.name}
                    fill
                    sizes="120px"
                    className={cn('object-cover transition-transform', on && 'scale-[1.03]')}
                  />
                ) : (
                  <div className="mf-img-empty flex h-full w-full items-center justify-center">
                    <Soup className="h-7 w-7 text-accent/35" strokeWidth={1.5} />
                  </div>
                )}
                {on && (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent-strong text-white shadow-[0_2px_6px_rgba(47,122,72,0.4)]">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}
              </div>
              <p className="relative truncate px-2 py-2 text-xs font-semibold tracking-[-0.01em] text-ink">
                {dish.name}
              </p>
            </button>
          )
        })}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  )
}
