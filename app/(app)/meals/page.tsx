import Link from 'next/link'
import { Plus, UtensilsCrossed } from 'lucide-react'
import { requireUser, listMembers } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import {
  countEmptyHistoryMeals,
  listActiveMeals,
  listHistoryMeals,
  mealSummaries,
} from '@/lib/meals'
import { dayjs, todayLocal } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { List } from '@/components/ui/list'
import { MealCard, HistoryRow } from '@/components/meals/meal-card'
import { CreateMealDialog } from '@/components/meals/create-meal-dialog'

export const dynamic = 'force-dynamic'

const PAGE = 30

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string; empty?: string }>
}) {
  const me = await requireUser()
  const t = await getT()
  const tz = getSettings().timezone
  const sp = await searchParams
  const limit = Math.min(Math.max(Number(sp.n) || PAGE, PAGE), 1000)
  const includeEmpty = sp.empty === '1'

  const active = listActiveMeals()
  const history = listHistoryMeals({ limit, includeEmpty })
  const emptyCount = countEmptyHistoryMeals()
  const summaries = mealSummaries(
    [...active, ...history.items].map((m) => m.id),
    me.id,
  )
  const members = new Map(listMembers().map((m) => [m.id, m.name]))

  const today = todayLocal(tz)
  const tomorrow = dayjs(today).add(1, 'day').format('YYYY-MM-DD')
  const qs = (n: number, empty: boolean) => {
    const p = new URLSearchParams()
    if (n !== PAGE) p.set('n', String(n))
    if (empty) p.set('empty', '1')
    const s = p.toString()
    return s ? `/meals?${s}` : '/meals'
  }

  const createBtn = (
    <CreateMealDialog today={today} tomorrow={tomorrow}>
      <Button size="sm">
        <Plus className="h-4 w-4" />
        {t('home.openMeal')}
      </Button>
    </CreateMealDialog>
  )

  const nothing = active.length === 0 && history.items.length === 0 && emptyCount === 0

  return (
    <>
      <PageHeader title={t('meals.title')} action={createBtn} />

      {nothing ? (
        <EmptyState
          icon={<UtensilsCrossed />}
          title={t('meals.emptyTitle')}
          description={t('meals.emptyDesc')}
          action={
            <CreateMealDialog today={today} tomorrow={tomorrow}>
              <Button>
                <Plus className="h-4 w-4" />
                {t('meals.openFirst')}
              </Button>
            </CreateMealDialog>
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((m) => (
                <MealCard
                  key={m.id}
                  meal={m}
                  tz={tz}
                  cookName={m.cookId ? members.get(m.cookId) : null}
                  summary={summaries.get(m.id)}
                />
              ))}
            </div>
          )}

          <div className="mb-3 mt-7 flex items-center justify-between">
            <h2 className="mf-section">{t('meals.history')}</h2>
            {emptyCount > 0 && (
              <Link
                href={qs(limit, !includeEmpty)}
                scroll={false}
                className="text-xs font-medium text-accent"
              >
                {includeEmpty
                  ? t('meals.hideEmpty')
                  : t('meals.showEmpty', { n: emptyCount })}
              </Link>
            )}
          </div>

          {history.items.length === 0 ? (
            <p className="mf-inset rounded-2xl p-5 text-center text-sm text-secondary">
              {emptyCount > 0 ? t('meals.historyAllEmpty') : t('meals.historyNone')}
            </p>
          ) : (
            <List>
              {history.items.map((m) => (
                <HistoryRow
                  key={m.id}
                  meal={m}
                  tz={tz}
                  cookName={m.cookId ? members.get(m.cookId) : null}
                  summary={summaries.get(m.id)}
                />
              ))}
            </List>
          )}

          {history.hasMore && (
            <div className="mt-4 text-center">
              <Link
                href={qs(limit + PAGE, includeEmpty)}
                scroll={false}
                className="mf-outline inline-flex h-10 items-center rounded-full px-5 text-sm font-medium text-accent"
              >
                {t('meals.loadMore')}
              </Link>
            </div>
          )}
        </>
      )}
    </>
  )
}
