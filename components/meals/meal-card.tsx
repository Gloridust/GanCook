import Link from 'next/link'
import { Clock, Users, ChefHat, ChevronRight, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MEAL_EMOJI, fmtTime, fmtDateLabel, nowSec } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'
import type { Meal } from '@/lib/db/schema'
import type { MealSummary } from '@/lib/meals'

export const STATUS_META: Record<
  Meal['status'],
  { labelKey: string; tone: 'accent' | 'warn' | 'neutral' | 'danger'; tile: string }
> = {
  ordering: { labelKey: 'status.ordering', tone: 'accent', tile: 'bg-tint' },
  cooking: {
    labelKey: 'status.cooking',
    tone: 'warn',
    tile: '[background:rgba(224,161,58,0.18)]',
  },
  done: { labelKey: 'status.done', tone: 'neutral', tile: 'bg-trough' },
  cancelled: {
    labelKey: 'status.cancelled',
    tone: 'danger',
    tile: 'bg-[rgb(217,83,79,0.12)]',
  },
}

/** 进行中饭局的卡片：突出「我该做什么」——还没点就提示去点 */
export async function MealCard({
  meal,
  cookName,
  summary,
  tz,
}: {
  meal: Meal
  cookName?: string | null
  summary?: MealSummary
  tz: string
}) {
  const t = await getT()
  const status = STATUS_META[meal.status]
  const open = meal.status === 'ordering' && nowSec() < meal.orderDeadline
  const mine = summary?.mine ?? 0
  const dishLine =
    summary && summary.topDishes.length > 0
      ? summary.dishCount > summary.topDishes.length
        ? t('mealcard.dishesMore', {
            names: summary.topDishes.slice(0, 3).join(t('common.listSep')),
            n: summary.dishCount,
          })
        : summary.topDishes.join(t('common.listSep'))
      : null

  return (
    <Link
      href={`/meals/${meal.id}`}
      className="mf-raised mf-pressable block p-3.5"
    >
      <div className="flex items-center gap-3.5">
        <div
          className={cn(
            'flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] text-[26px]',
            status.tile,
          )}
        >
          {MEAL_EMOJI[meal.mealType]}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold tracking-title text-ink">
              {meal.title || t('meal.' + meal.mealType)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-secondary">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {fmtDateLabel(meal.date, tz, t)} {fmtTime(meal.diningTime, tz)}
            </span>
            {summary && summary.participants > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {t('mealcard.people', { n: summary.participants })}
              </span>
            )}
            {cookName && (
              <span className="inline-flex items-center gap-1 text-accent">
                <ChefHat className="h-3.5 w-3.5" />
                {cookName}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={status.tone}>{t(status.labelKey)}</Badge>
          <ChevronRight className="h-4 w-4 text-secondary/40" />
        </div>
      </div>

      {(open || dishLine) && (
        <div className="mt-3 flex items-center gap-2 border-t border-black/[0.05] pt-2.5 text-xs">
          {open && (
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 font-semibold',
                mine > 0 ? 'bg-tint text-accent' : 'bg-accent-strong text-white',
              )}
            >
              {mine > 0 ? t('mealcard.mine', { n: mine }) : t('mealcard.yourTurn')}
            </span>
          )}
          {dishLine && <span className="truncate text-secondary">{dishLine}</span>}
        </div>
      )}
    </Link>
  )
}

/** 历史饭局的紧凑行：日期在前，摘要是「吃了什么」 */
export async function HistoryRow({
  meal,
  cookName,
  summary,
  tz,
}: {
  meal: Meal
  cookName?: string | null
  summary?: MealSummary
  tz: string
}) {
  const t = await getT()
  const sep = t('common.listSep')
  const dishes =
    summary && summary.topDishes.length > 0
      ? summary.dishCount > summary.topDishes.length
        ? t('mealcard.dishesMore', {
            names: summary.topDishes.slice(0, 3).join(sep),
            n: summary.dishCount,
          })
        : summary.topDishes.join(sep)
      : t('mealcard.noOrders')
  // 掌勺人放前面：名字短，菜名列表长，截断时保住「谁做的」
  const sub = cookName ? `${t('mealcard.cookBy', { name: cookName })} · ${dishes}` : dishes

  return (
    <Link href={`/meals/${meal.id}`} className="mf-row mf-row-inset mf-row-press">
      <span
        className={cn(
          'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] text-[18px]',
          STATUS_META[meal.status].tile,
        )}
      >
        {MEAL_EMOJI[meal.mealType]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">
          {fmtDateLabel(meal.date, tz, t)} · {meal.title || t('meal.' + meal.mealType)}
        </span>
        <span className="mt-0.5 block truncate text-xs text-secondary">{sub}</span>
      </span>
      {meal.status === 'cancelled' ? (
        <Badge tone="danger">{t('status.cancelled')}</Badge>
      ) : summary?.rating ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-[#b3791f]">
          <Star className="h-3.5 w-3.5 fill-current" />
          {summary.rating.toFixed(1)}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-secondary/50" />
    </Link>
  )
}
