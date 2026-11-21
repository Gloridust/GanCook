'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlarmClock, Minus, Plus, Refrigerator, Search, Snowflake, Warehouse } from 'lucide-react'
import { List } from '@/components/ui/list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useT } from '@/components/i18n-provider'
import { adjustPantryQuantity } from '@/lib/actions/pantry'
import { expiryState, fmtQuantity, PANTRY_LOCATIONS, type PantryLocation } from '@/lib/pantry'
import type { PantryItem } from '@/lib/db/schema'
import { PantryForm } from './pantry-form'

const LOC_ICON = {
  fridge: Refrigerator,
  freezer: Snowflake,
  pantry: Warehouse,
} as const

function ExpiryBadge({ item, today }: { item: PantryItem; today: string }) {
  const t = useT()
  const { state, days } = expiryState(item.expiresOn, today)
  if (state === 'none') return null
  if (state === 'expired') return <Badge tone="danger">{t('pantry.expired')}</Badge>
  if (state === 'soon')
    return (
      <Badge tone="warn">
        {days === 0 ? t('pantry.expiresToday') : t('pantry.expiresIn', { n: days! })}
      </Badge>
    )
  return null
}

export function PantryBoard({ items, today }: { items: PantryItem[]; today: string }) {
  const t = useT()
  const router = useRouter()
  const [editing, setEditing] = useState<PantryItem | null>(null)
  const [adding, setAdding] = useState<PantryLocation | null>(null)
  const [query, setQuery] = useState('')
  // 点 +/- 时先本地显示新数量；请求都回来、服务端数据刷新后以服务端为准
  const [qtyOverride, setQtyOverride] = useState<Record<string, number>>({})
  const inFlight = useRef(0)
  const [, startTransition] = useTransition()
  useEffect(() => {
    if (inFlight.current === 0) setQtyOverride({})
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((i) => `${i.name} ${i.note ?? ''}`.toLowerCase().includes(q)) : items
  }, [items, query])

  // 已用完（数量 0）的不算「快过期」
  const urgent = items.filter((i) => {
    if (i.quantity === 0) return false
    const s = expiryState(i.expiresOn, today).state
    return s === 'soon' || s === 'expired'
  })

  const bump = (item: PantryItem, delta: number) => {
    const cur = qtyOverride[item.id] ?? item.quantity ?? 0
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100)
    setQtyOverride((m) => ({ ...m, [item.id]: next }))
    inFlight.current++
    startTransition(async () => {
      await adjustPantryQuantity(item.id, delta).finally(() => {
        inFlight.current--
      })
      if (inFlight.current === 0) router.refresh()
    })
  }

  const addButton = (
    <Button size="sm" onClick={() => setAdding('fridge')}>
      <Plus className="h-4 w-4" />
      {t('common.add')}
    </Button>
  )

  return (
    <>
      {items.length === 0 ? (
        <EmptyState
          icon={<Refrigerator />}
          title={t('pantry.emptyTitle')}
          description={t('pantry.emptyDesc')}
          action={addButton}
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/60" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('pantry.search')}
                className="pl-10"
              />
            </div>
            {addButton}
          </div>

          {urgent.length > 0 && !query && (
            <div className="mb-5 flex items-start gap-3 rounded-[22px] bg-[#e0a13a]/12 px-4 py-3">
              <AlarmClock className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#b3791f]" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-[#8a5c12]">
                  {t('pantry.urgentTitle', { n: urgent.length })}
                </p>
                <p className="mt-0.5 text-[#8a5c12]/80">
                  {urgent.map((i) => i.name).join(t('common.listSep'))}
                  {' · '}
                  {t('pantry.urgentHint')}
                </p>
              </div>
            </div>
          )}

          {PANTRY_LOCATIONS.map((loc) => {
            const list = filtered.filter((i) => i.location === loc)
            if (list.length === 0) return null
            const Icon = LOC_ICON[loc]
            return (
              <section key={loc} className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                    <Icon className="h-4 w-4 text-accent" />
                    {t(`pantry.loc.${loc}`)}
                    <span className="text-sm font-normal text-secondary">{list.length}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setAdding(loc)}
                    aria-label={t('pantry.add')}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-accent active:bg-tint"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <List>
                  {list.map((item) => {
                    const qty = qtyOverride[item.id] ?? item.quantity
                    const out = qty === 0
                    return (
                      <div key={item.id} className="mf-row">
                        <button
                          type="button"
                          onClick={() =>
                            // 编辑表单以「当前显示的数量」为准，避免刚点过 +/- 又被旧值覆盖
                            setEditing(
                              item.id in qtyOverride
                                ? { ...item, quantity: qtyOverride[item.id] }
                                : item,
                            )
                          }
                          className={`min-w-0 flex-1 text-left ${out ? 'opacity-50' : ''}`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-medium text-ink">
                              {item.name}
                            </span>
                            <ExpiryBadge item={item} today={today} />
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-secondary">
                            {[
                              out
                                ? t('pantry.outOfStock')
                                : fmtQuantity(qty, item.unit) || t('pantry.someLeft'),
                              item.note,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </button>
                        {qty !== null && (
                          <div className="flex shrink-0 items-center gap-1 rounded-full bg-tint p-0.5">
                            <button
                              type="button"
                              aria-label={t('picker.minus')}
                              disabled={qty <= 0}
                              onClick={() => bump(item, -1)}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-accent active:bg-black/5 disabled:opacity-40"
                            >
                              <Minus className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                            <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-accent">
                              {qty}
                            </span>
                            <button
                              type="button"
                              aria-label={t('picker.plus')}
                              onClick={() => bump(item, 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-strong text-white"
                            >
                              <Plus className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </List>
              </section>
            )
          })}

          {filtered.length === 0 && (
            <p className="mf-inset rounded-2xl p-5 text-center text-sm text-secondary">
              {t('pantry.noMatch')}
            </p>
          )}
        </>
      )}

      {(editing || adding) && (
        <PantryForm
          key={editing?.id ?? `new-${adding}`}
          item={editing}
          defaultLocation={adding ?? 'fridge'}
          today={today}
          open
          onOpenChange={(o) => {
            if (!o) {
              setEditing(null)
              setAdding(null)
            }
          }}
        />
      )}
    </>
  )
}
