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

  const meals = listMeals()
  const todayMeals = meals
    .filter((m) => m.date === today && m.status !== 'cancelled')
    .sort((a, b) => a.diningTime - b.diningTime)

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
      <PageHeader
        title={t('home.hi', { name: me.name })}
        subtitle={t('home.sub', { family: s.familyName })}
        action={
          <CreateMealDialog today={today} tomorrow={tomorrow}>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t('home.openMeal')}
            </Button>
          </CreateMealDialog>
        }
      />

      <h2 className="mb-3 text-base font-semibold text-ink">{t('home.today')}</h2>
      {todayMeals.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <UtensilsCrossed className="relative h-8 w-8 text-secondary/50" />
          <p className="relative text-sm text-secondary">
            {t('home.emptyToday')}
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
          {todayMeals.map((m) => (
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
