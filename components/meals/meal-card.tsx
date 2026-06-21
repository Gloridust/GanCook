import Link from 'next/link'
import { Clock, Users, ChefHat } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MEAL_EMOJI, fmtTime, fmtDateLabel } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import type { Meal } from '@/lib/db/schema'

export const STATUS_META: Record<
  Meal['status'],
  { labelKey: string; tone: 'accent' | 'warn' | 'neutral' | 'danger' }
> = {
  ordering: { labelKey: 'status.ordering', tone: 'accent' },
  cooking: { labelKey: 'status.cooking', tone: 'warn' },
  done: { labelKey: 'status.done', tone: 'neutral' },
  cancelled: { labelKey: 'status.cancelled', tone: 'danger' },
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
  const fallbackTitle = `${fmtDateLabel(meal.date, tz!, t)} ${t('meal.' + meal.mealType)}`
  return (
    <Link href={`/meals/${meal.id}`} className="mf-raised mf-pressable block p-4">
      <div className="relative flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-trough text-2xl">
          {MEAL_EMOJI[meal.mealType]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">
              {meal.title || fallbackTitle}
            </span>
            {meal.isAuto && <Badge tone="auto">{t('mealcard.auto')}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-secondary">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {fmtTime(meal.diningTime, tz)}
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
        <Badge tone={status.tone}>{t(status.labelKey)}</Badge>
      </div>
    </Link>
  )
}
