import { Plus, UtensilsCrossed } from 'lucide-react'
import { requireUser, listMembers } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { listMeals } from '@/lib/meals'
import { db } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { dayjs, todayLocal } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { MealCard } from '@/components/meals/meal-card'
import { CreateMealDialog } from '@/components/meals/create-meal-dialog'

export const dynamic = 'force-dynamic'

export default async function MealsPage() {
  await requireUser()
  const t = await getT()
  const tz = getSettings().timezone
  const meals = listMeals()

  // 每个饭局的点菜人数
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

  const upcoming = meals
    .filter((m) => m.status === 'ordering' || m.status === 'cooking')
    .sort((a, b) => a.diningTime - b.diningTime)
  const history = meals.filter(
    (m) => m.status === 'done' || m.status === 'cancelled',
  )

  const today = todayLocal(tz)
  const tomorrow = dayjs(today).add(1, 'day').format('YYYY-MM-DD')

  const createBtn = (
    <CreateMealDialog today={today} tomorrow={tomorrow}>
      <Button size="sm">
        <Plus className="h-4 w-4" />
        {t('home.openMeal')}
      </Button>
    </CreateMealDialog>
  )

  return (
    <>
      <PageHeader title={t('meals.title')} action={createBtn} />

      {meals.length === 0 ? (
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
        <div className="space-y-3">
          {upcoming.map((m) => (
            <MealCard
              key={m.id}
              meal={m}
              tz={tz}
              cookName={m.cookId ? members.get(m.cookId) : null}
              participants={participants.get(m.id)?.size ?? 0}
            />
          ))}

          {history.length > 0 && (
            <>
              <p className="mb-1 mt-6 text-sm font-medium text-secondary">
                {t('meals.history')}
              </p>
              {history.map((m) => (
                <MealCard
                  key={m.id}
                  meal={m}
                  tz={tz}
                  cookName={m.cookId ? members.get(m.cookId) : null}
                  participants={participants.get(m.id)?.size ?? 0}
                />
              ))}
            </>
          )}
        </div>
      )}
    </>
  )
}
