'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Check, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/components/i18n-provider'
import { setOrderQuantity } from '@/lib/actions/meals'
import { DishThumb } from '@/components/dishes/dish-thumb'
import { DishRow } from '@/components/dishes/dish-card'
import { DishDetails } from '@/components/dishes/dish-details'
import {
  DishFilterBar,
  NoMatch,
  useDishFilter,
} from '@/components/dishes/dish-filter'
import {
  ViewModeToggle,
  defaultViewMode,
  useViewMode,
} from '@/components/dishes/view-mode'
import { RandomPick } from '@/components/meals/random-pick'
import { List } from '@/components/ui/list'
import { Button } from '@/components/ui/button'
import type { Dish } from '@/lib/db/schema'

type PickDish = Pick<
  Dish,
  'id' | 'name' | 'description' | 'instructions' | 'imagePath' | 'tags'
>

const MAX_QTY = 99

function Stepper({
  qty,
  onChange,
  compact,
}: {
  qty: number
  onChange: (n: number) => void
  compact?: boolean
}) {
  const t = useT()
  const size = compact ? 'h-7 w-7' : 'h-8 w-8'
  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        aria-label={t('picker.add')}
        className={cn(
          size,
          'flex shrink-0 items-center justify-center rounded-full border border-accent/40 text-accent active:bg-tint',
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
    )
  }
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full bg-tint p-0.5">
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        aria-label={t('picker.minus')}
        className={cn(size, 'flex items-center justify-center rounded-full text-accent active:bg-black/5')}
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <span className="min-w-[1.25rem] text-center text-sm font-semibold tabular-nums text-accent">
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(MAX_QTY, qty + 1))}
        aria-label={t('picker.plus')}
        className={cn(
          size,
          'flex items-center justify-center rounded-full bg-accent-strong text-white',
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  )
}

export function OrderPicker({
  mealId,
  dishes,
  initialQty,
  recentDishIds,
  mealType,
}: {
  mealId: string
  mealType: 'breakfast' | 'lunch' | 'dinner'
  dishes: PickDish[]
  /** 我已点的：dishId → 份数 */
  initialQty: Record<string, number>
  /** 最近几天吃过的菜（「随便来点」时少推荐） */
  recentDishIds: string[]
}) {
  const router = useRouter()
  const t = useT()
  const [qty, setQty] = useState<Record<string, number>>(initialQty)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()
  const [detail, setDetail] = useState<PickDish | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(0)

  // 服务端数据更新（一键全点 / 刷新）后同步；仍有请求在途时不覆盖，避免回跳
  useEffect(() => {
    if (inFlight.current === 0) setQty(initialQty)
  }, [initialQty])
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    },
    [],
  )

  const pickedIds = useMemo(
    () => new Set(Object.keys(qty).filter((id) => qty[id] > 0)),
    [qty],
  )
  const { query, setQuery, tag, setTag, tags, filtered } = useDishFilter(dishes, {
    pickedIds,
  })
  const [mode, setMode] = useViewMode('gancook.picker.view', defaultViewMode(dishes))

  // 连点「+」时不要每下都整页刷新：停手 700ms 后再刷新「大家点了什么」
  const scheduleRefresh = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => router.refresh(), 700)
  }

  const change = (dishId: string, next: number) => {
    const prev = qty[dishId] ?? 0
    if (prev === next) return
    setQty((cur) => ({ ...cur, [dishId]: next }))
    setError('')
    inFlight.current++
    startTransition(async () => {
      const res = await setOrderQuantity(mealId, dishId, next).finally(() => {
        inFlight.current--
      })
      if (!res.ok) {
        setQty((cur) => ({ ...cur, [dishId]: prev }))
        setError(res.error)
        router.refresh()
      } else {
        scheduleRefresh()
      }
    })
  }

  if (dishes.length === 0) {
    return (
      <p className="mf-inset rounded-2xl p-4 text-center text-sm text-secondary">
        {t('picker.empty')}
      </p>
    )
  }

  const hasInfo = (d: PickDish) => Boolean(d.instructions || d.description)

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 mb-3 bg-base/92 px-4 pb-3 pt-2 backdrop-blur-md">
        <DishFilterBar
          query={query}
          onQuery={setQuery}
          tag={tag}
          onTag={setTag}
          tags={tags}
          total={dishes.length}
          pickedCount={pickedIds.size}
          trailing={
            <>
              <RandomPick
                mealId={mealId}
                dishes={dishes}
                pickedIds={pickedIds}
                recentDishIds={recentDishIds}
                mealType={mealType}
              />
              <ViewModeToggle mode={mode} onChange={setMode} />
            </>
          }
        />
      </div>

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {filtered.length === 0 ? (
        <NoMatch
          onReset={() => {
            setQuery('')
            setTag(null)
          }}
        />
      ) : mode === 'list' ? (
        <List>
          {filtered.map((d) => {
            const n = qty[d.id] ?? 0
            return (
              <DishRow
                key={d.id}
                dish={d}
                onClick={() => change(d.id, n > 0 ? 0 : 1)}
                trailing={
                  <span className="flex items-center gap-1.5">
                    {hasInfo(d) && (
                      <button
                        type="button"
                        onClick={() => setDetail(d)}
                        aria-label={t('picker.howTo')}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-secondary/70 active:bg-black/5"
                      >
                        <BookOpen className="h-[17px] w-[17px]" />
                      </button>
                    )}
                    <Stepper qty={n} onChange={(v) => change(d.id, v)} />
                  </span>
                }
              />
            )
          })}
        </List>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {filtered.map((d) => {
            const n = qty[d.id] ?? 0
            return (
              <div
                key={d.id}
                className={cn(
                  'mf-raised relative overflow-hidden p-0',
                  n > 0 && 'ring-2 ring-accent ring-offset-2 ring-offset-base',
                )}
              >
                <button
                  type="button"
                  onClick={() => change(d.id, n > 0 ? 0 : 1)}
                  className="mf-pressable block w-full text-left"
                >
                  <DishThumb
                    name={d.name}
                    imagePath={d.imagePath}
                    tags={d.tags}
                    sizes="120px"
                    className="aspect-square w-full"
                    emojiClassName="text-[34px]"
                  />
                  <p className="truncate px-2 py-2 text-xs font-semibold tracking-[-0.01em] text-ink">
                    {d.name}
                  </p>
                </button>
                {hasInfo(d) && (
                  <button
                    type="button"
                    onClick={() => setDetail(d)}
                    aria-label={t('picker.howTo')}
                    className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-surface/85 text-secondary backdrop-blur"
                  >
                    <BookOpen className="h-[15px] w-[15px]" />
                  </button>
                )}
                {n > 0 && (
                  <>
                    <span className="pointer-events-none absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-strong px-1.5 text-xs font-bold text-white">
                      {n > 1 ? `×${n}` : <Check className="h-4 w-4" strokeWidth={3} />}
                    </span>
                    <div className="absolute inset-x-0 top-[calc(100%-4.25rem)] flex justify-center">
                      <span className="rounded-full bg-surface/90 shadow-sm backdrop-blur">
                        <Stepper compact qty={n} onChange={(v) => change(d.id, v)} />
                      </span>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {detail && (
        <DishDetails
          key={detail.id}
          dish={detail}
          open
          onOpenChange={(o) => !o && setDetail(null)}
          footer={
            <Button
              className="w-full"
              variant={(qty[detail.id] ?? 0) > 0 ? 'secondary' : 'primary'}
              onClick={() => {
                change(detail.id, (qty[detail.id] ?? 0) > 0 ? 0 : 1)
                setDetail(null)
              }}
            >
              {(qty[detail.id] ?? 0) > 0 ? t('picker.unpick') : t('picker.pickThis')}
            </Button>
          }
        />
      )}
    </div>
  )
}
