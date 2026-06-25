import { Plus, UtensilsCrossed, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { requireUser, listMembers } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { listMeals } from '@/lib/meals'
import { db } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { dayjs, todayLocal } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MealCard } from '@/components/meals/meal-card'
import { CreateMealDialog } from '@/components/meals/create-meal-dialog'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const me = await requireUser()
  const t = await getT()
  const s = getSettings()
  const tz = s.timezone
  const today = todayLocal(tz)
  const tomorrow = dayjs(today).add(1, 'day').format('YYYY-MM-DD')

  // 临近的饭局：最近 3 天（含今天）的未完成饭局 + 今天已完成的饭局
  const in3days = dayjs(today).add(2, 'day').format('YYYY-MM-DD')
  const meals = listMeals()
  const upcomingMeals = meals
    .filter((m) => {
      if (m.status === 'cancelled') return false
      if (
        (m.status === 'ordering' || m.status === 'cooking') &&
        m.date >= today &&
        m.date <= in3days
      )
        return true
      if (m.status === 'done' && m.date === today) return true
      return false
    })
    .sort(
      (a, b) =>
        (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) ||
        a.diningTime - b.diningTime,
    )

  const orderRows = db
    .select({ mealId: orders.mealId, userId: orders.userId })
    .from(orders)
    .all()
  const participants = new Map<string, Set<string>>()
  for (const r of orderRows) {
    if (!participants.has(r.mealId)) participants.set(r.mealId, new Set())
    participants.get(r.mealId)!.add(r.userId)
  }
  const members = new Map(listMembers().map((m) => [m.id, m.name]))

  return (
    <>
      {/* 问候 hero：绿色调面 */}
      <div className="mf-tonal mb-6 overflow-hidden p-5">
        <div className="relative">
          <p className="text-sm font-medium text-accent">{s.familyName}</p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-title text-ink">
            {t('home.hi', { name: me.name })}
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {t('home.sub', { family: s.familyName }).split('·').pop()?.trim()}
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="mf-section text-[15px] text-ink">{t('home.upcoming')}</h2>
        <CreateMealDialog today={today} tomorrow={tomorrow}>
          <Button size="sm" variant="tonal">
            <Plus className="h-4 w-4" />
            {t('home.openMeal')}
          </Button>
        </CreateMealDialog>
      </div>
      {upcomingMeals.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <UtensilsCrossed className="relative h-8 w-8 text-secondary/50" />
          <p className="relative text-sm text-secondary">
            {t('home.emptyUpcoming')}
          </p>
          <CreateMealDialog today={today} tomorrow={tomorrow}>
            <Button size="sm" className="relative">
              <Plus className="h-4 w-4" />
              {t('home.openMeal')}
            </Button>
          </CreateMealDialog>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcomingMeals.map((m) => (
            <MealCard
              key={m.id}
              meal={m}
              tz={tz}
              cookName={m.cookId ? members.get(m.cookId) : null}
              participants={participants.get(m.id)?.size ?? 0}
            />
          ))}
        </div>
      )}

      <Link
        href="/meals"
        className="mt-4 inline-flex items-center gap-1 text-sm text-accent"
      >
        {t('home.viewAll')}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </>
  )
}
