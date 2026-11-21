'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dices, Leaf, Minus, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { List } from '@/components/ui/list'
import { DishRow } from '@/components/dishes/dish-card'
import { useT } from '@/components/i18n-provider'
import { addOrders } from '@/lib/actions/meals'
import { smartPick } from '@/lib/actions/recommend'
import { tagStats } from '@/lib/dish-categories'
import type { Dish } from '@/lib/db/schema'

type RDish = Pick<Dish, 'id' | 'name' | 'description' | 'imagePath' | 'tags'>

const ANY = '__any__'
const MODE_KEY = 'gancook.random.mode'

type Mode = 'random' | 'smart'
type SmartInfo = {
  reasons: Record<string, string>
  summary: string
  seasonLabel: string
  source: 'llm' | 'rules'
  llmFailed: boolean
}

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'smart' ? 'smart' : 'random'
  } catch {
    return 'random'
  }
}

/** 加权不放回抽样：最近吃过的菜权重降到 1/4，换换口味 */
function weightedSample<T extends { id: string }>(
  pool: T[],
  n: number,
  weight: (x: T) => number,
): T[] {
  const left = [...pool]
  const out: T[] = []
  while (out.length < n && left.length > 0) {
    const total = left.reduce((s, x) => s + weight(x), 0)
    let r = Math.random() * total
    let i = 0
    for (; i < left.length - 1; i++) {
      r -= weight(left[i])
      if (r <= 0) break
    }
    out.push(left.splice(i, 1)[0])
  }
  return out
}

export function RandomPick({
  mealId,
  dishes,
  pickedIds,
  recentDishIds,
  mealType,
}: {
  mealType: 'breakfast' | 'lunch' | 'dinner'
  mealId: string
  dishes: RDish[]
  pickedIds: Set<string>
  recentDishIds: string[]
}) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const recent = useMemo(() => new Set(recentDishIds), [recentDishIds])
  const topTags = useMemo(() => tagStats(dishes).slice(0, 6).map((x) => x.tag), [dishes])

  const allTags = useMemo(() => new Set(tagStats(dishes).map((x) => x.tag)), [dishes])
  // 默认配方：早餐就「早餐 ×2」；正餐「一荤一素一汤」；库里没这些分类就取最多的前三类；再不行随便 3 道
  const initialPlan = () => {
    const plan: Record<string, number> = {}
    const breakfast = ['早餐', 'Breakfast'].find((x) => allTags.has(x))
    if (mealType === 'breakfast' && breakfast) return { [breakfast]: 2 }
    for (const group of [['荤菜', 'Meat'], ['素菜', 'Veggie'], ['汤', 'Soup']]) {
      const hit = group.find((x) => allTags.has(x))
      if (hit) plan[hit] = 1
    }
    if (Object.keys(plan).length > 0) return plan
    if (topTags.length === 0) return { [ANY]: 3 }
    for (const tag of topTags.slice(0, 3)) plan[tag] = 1
    return plan
  }
  const [plan, setPlan] = useState<Record<string, number>>(initialPlan)
  const [result, setResult] = useState<RDish[]>([])
  const [mode, setModeState] = useState<Mode>('random')
  const [smart, setSmart] = useState<SmartInfo | null>(null)
  // 只跟踪「最新一次」智能请求：切回随机或发起新请求后，旧请求的结果和加载态都作废
  const [thinkingSeq, setThinkingSeq] = useState<number | null>(null)
  const thinking = thinkingSeq !== null
  const requestSeq = useRef(0)
  const thinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const byId = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes])

  const cancelThinking = () => {
    requestSeq.current++
    if (thinkTimer.current) clearTimeout(thinkTimer.current)
    thinkTimer.current = null
    setThinkingSeq(null)
  }
  useEffect(() => () => {
    if (thinkTimer.current) clearTimeout(thinkTimer.current)
  }, [])

  // 智能：交给服务端（时令 + 库存 + 最近吃过；配了 LLM 就让 LLM 挑）。
  // 连点 +/- 时稍等再发，避免每下都调一次 LLM
  const think = (p = plan, delayMs = 0) => {
    if (thinkTimer.current) clearTimeout(thinkTimer.current)
    const seq = ++requestSeq.current
    setError('')
    setThinkingSeq(seq)
    thinkTimer.current = setTimeout(async () => {
      thinkTimer.current = null
      let res: Awaited<ReturnType<typeof smartPick>>
      try {
        res = await smartPick(mealId, p, [...pickedIds])
      } catch {
        res = { ok: false, error: t('random.llmFailed') }
      }
      if (seq !== requestSeq.current) return
      setThinkingSeq(null)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setResult(res.picks.map((x) => byId.get(x.id)).filter((d): d is RDish => !!d))
      setSmart({
        reasons: Object.fromEntries(res.picks.map((x) => [x.id, x.reason])),
        summary: res.summary,
        seasonLabel: res.seasonLabel,
        source: res.source,
        llmFailed: res.llmFailed,
      })
    }, delayMs)
  }

  const run = (p = plan, m = mode, delayMs = 0) =>
    m === 'smart' ? think(p, delayMs) : roll(p)

  const setMode = (m: Mode) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      // 无痕模式等：不记住也没关系
    }
    run(plan, m)
  }

  const roll = (p = plan) => {
    cancelThinking()
    setSmart(null)
    const chosen = new Set<string>()
    const out: RDish[] = []
    const weight = (d: RDish) => (recent.has(d.id) ? 0.25 : 1)
    const entries = Object.entries(p).filter(([, n]) => n > 0)
    // 先抽具体分类，最后抽「不限」
    entries.sort(([a], [b]) => (a === ANY ? 1 : 0) - (b === ANY ? 1 : 0))
    for (const [tag, n] of entries) {
      const pool = dishes.filter(
        (d) =>
          !chosen.has(d.id) &&
          !pickedIds.has(d.id) &&
          (tag === ANY || (d.tags ?? []).includes(tag)),
      )
      for (const d of weightedSample(pool, n, weight)) {
        chosen.add(d.id)
        out.push(d)
      }
    }
    setResult(out)
    setError('')
  }

  const setCount = (tag: string, delta: number) => {
    const next = { ...plan, [tag]: Math.max(0, Math.min(6, (plan[tag] ?? 0) + delta)) }
    setPlan(next)
    run(next, mode, 500)
  }

  const orderAll = () =>
    startTransition(async () => {
      const res = await addOrders(
        mealId,
        result.map((d) => d.id),
      )
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      router.refresh()
    })

  if (dishes.length < 2) return null
  // 配方里的分类排前面，其余常用分类随后，「不限」最后
  const rows = [
    ...new Set([...Object.keys(plan).filter((k) => k !== ANY), ...topTags]),
    ANY,
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) cancelThinking()
        if (v) {
          const m = readMode()
          setModeState(m)
          run(plan, m)
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t('random.title')}
          className="mf-inset flex h-10 shrink-0 items-center gap-1.5 px-3 text-sm font-medium text-accent"
        >
          <Dices className="h-[18px] w-[18px]" />
          <span>{t('random.short')}</span>
        </button>
      </DialogTrigger>
      <DialogContent title={t('random.title')} className="max-h-[90dvh] overflow-y-auto">
        <div className="space-y-4">
          <Segmented
            value={mode}
            onChange={setMode}
            layoutId="random-mode"
            className="-mt-1"
            options={[
              { value: 'random', label: t('random.modeRandom') },
              { value: 'smart', label: t('random.modeSmart') },
            ]}
          />
          <p className="-mt-1 text-sm text-secondary">
            {mode === 'smart' ? t('random.subSmart') : t('random.sub')}
          </p>

          <div className="mf-rail -mx-5 px-5">
            {rows.map((tag) => {
              const n = plan[tag] ?? 0
              return (
                <div
                  key={tag}
                  className={`flex flex-none items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm ${
                    n > 0 ? 'bg-tint text-accent' : 'bg-trough text-secondary'
                  }`}
                >
                  <span className="mr-0.5 font-medium">
                    {tag === ANY ? t('random.any') : tag}
                  </span>
                  <button
                    type="button"
                    aria-label={t('picker.minus')}
                    onClick={() => setCount(tag, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full active:bg-black/5"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-3 text-center font-semibold tabular-nums">{n}</span>
                  <button
                    type="button"
                    aria-label={t('picker.plus')}
                    onClick={() => setCount(tag, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full active:bg-black/5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          {mode === 'smart' && smart && !thinking && result.length > 0 && (
            <div className="mf-tonal space-y-1 rounded-2xl px-4 py-3">
              <p className="relative flex items-center gap-1.5 text-sm font-semibold text-accent">
                {smart.source === 'llm' ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <Leaf className="h-4 w-4" />
                )}
                {smart.seasonLabel}
                <span className="font-normal text-secondary">
                  · {smart.source === 'llm' ? t('random.byLlm') : t('random.byRules')}
                </span>
              </p>
              {smart.summary && (
                <p className="relative text-sm text-ink">{smart.summary}</p>
              )}
              {smart.llmFailed && (
                <p className="relative text-xs text-secondary">{t('random.llmFailed')}</p>
              )}
            </div>
          )}

          {thinking ? (
            <p className="mf-inset flex items-center justify-center gap-2 rounded-2xl p-5 text-sm text-secondary">
              <Sparkles className="h-4 w-4 animate-pulse text-accent" />
              {t('random.thinking')}
            </p>
          ) : result.length === 0 ? (
            <p className="mf-inset rounded-2xl p-5 text-center text-sm text-secondary">
              {t('random.none')}
            </p>
          ) : (
            <List>
              {result.map((d) => (
                <DishRow
                  key={d.id}
                  dish={d}
                  subtitle={
                    mode === 'smart' ? smart?.reasons[d.id] || undefined : undefined
                  }
                />
              ))}
            </List>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={thinking}
              onClick={() => run()}
            >
              <RefreshCw className="h-4 w-4" />
              {t('random.reroll')}
            </Button>
            <Button
              className="flex-1"
              loading={pending}
              disabled={result.length === 0 || thinking}
              onClick={orderAll}
            >
              {t('random.orderAll', { n: result.length })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
