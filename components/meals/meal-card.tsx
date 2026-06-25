import Link from 'next/link'
import { Clock, Users, ChefHat, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MEAL_EMOJI, fmtTime, fmtDateLabel } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'
import type { Meal } from '@/lib/db/schema'

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

export async function MealCard({
  meal,
  cookName,
  participants,
  tz,
}: {
  meal: Meal
  cookName?: string | null
  participants?: number
  tz?: string
}) {
  const t = await getT()
  const status = STATUS_META[meal.status]
  const fallbackTitle = t('meal.' + meal.mealType)
  return (
    <Link
      href={`/meals/${meal.id}`}
      className="mf-raised mf-pressable flex items-center gap-3.5 p-3.5"
    >
      <div
        className={cn(
          'flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] text-[26px]',
          status.tile,
        )}
      >
        {MEAL_EMOJI[meal.mealType]}
      </div>

      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold tracking-title text-ink">
            {meal.title || fallbackTitle}
          </span>
          {meal.isAuto && <Badge tone="auto">{t('mealcard.auto')}</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-secondary">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {fmtDateLabel(meal.date, tz!, t)} {fmtTime(meal.diningTime, tz)}
          </span>
          {typeof participants === 'number' && participants > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {t('mealcard.people', { n: participants })}
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

      <div className="relative flex shrink-0 items-center gap-1">
        <Badge tone={status.tone}>{t(status.labelKey)}</Badge>
        <ChevronRight className="h-4 w-4 text-secondary/40" />
      </div>
    </Link>
  )
}
