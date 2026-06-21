import { Plus, ChefHat } from 'lucide-react'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes as dishesTable } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DishCard } from '@/components/dishes/dish-card'
import { DishForm } from '@/components/dishes/dish-form'

export const dynamic = 'force-dynamic'

export default async function DishesPage() {
  const me = await requireUser()
  const t = await getT()
  const all = db
    .select()
    .from(dishesTable)
    .orderBy(desc(dishesTable.createdAt))
    .all()

  const active = all.filter((d) => d.status === 'active')
  const archived = all.filter((d) => d.status === 'archived')
  const canManage = (createdBy: string | null) =>
    createdBy === me.id || me.isAdmin

  return (
    <>
      <PageHeader
        title={t('dishes.title')}
        subtitle={t('dishes.count', { n: active.length })}
        action={
          <DishForm mode="create">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t('common.add')}
            </Button>
          </DishForm>
        }
      />

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={<ChefHat />}
          title={t('dishes.emptyTitle')}
          description={t('dishes.emptyDesc')}
          action={
            <DishForm mode="create">
              <Button>
                <Plus className="h-4 w-4" />
                {t('dishes.addFirst')}
              </Button>
            </DishForm>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {active.map((dish) =>
              canManage(dish.createdBy) ? (
                <DishForm key={dish.id} mode="edit" dish={dish}>
                  <DishCard dish={dish} />
                </DishForm>
              ) : (
                <DishCard key={dish.id} dish={dish} />
              ),
            )}
          </div>

          {archived.length > 0 && (
            <>
              <p className="mb-3 mt-7 text-sm font-medium text-secondary">
                {t('dishes.archived')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {archived.map((dish) =>
                  canManage(dish.createdBy) ? (
                    <DishForm key={dish.id} mode="edit" dish={dish}>
                      <DishCard dish={dish} dimmed />
                    </DishForm>
                  ) : (
                    <DishCard key={dish.id} dish={dish} dimmed />
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
