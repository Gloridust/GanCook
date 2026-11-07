import { Plus, ChefHat } from 'lucide-react'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes as dishesTable } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import { tagStats } from '@/lib/dish-categories'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DishForm } from '@/components/dishes/dish-form'
import { DishLibrary } from '@/components/dishes/dish-library'
import { MenuTransfer } from '@/components/dishes/menu-transfer'

export const dynamic = 'force-dynamic'

export default async function DishesPage() {
  const me = await requireUser()
  const t = await getT()
  const all = db
    .select()
    .from(dishesTable)
    .orderBy(desc(dishesTable.createdAt))
    .all()

  const activeCount = all.filter((d) => d.status === 'active').length
  const suggestedTags = tagStats(all).map((x) => x.tag)

  return (
    <>
      <PageHeader
        title={t('dishes.title')}
        subtitle={t('dishes.count', { n: activeCount })}
        action={
          <div className="flex items-center gap-2">
            <MenuTransfer dishCount={all.length} />
            <DishForm mode="create" suggestedTags={suggestedTags}>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                {t('common.add')}
              </Button>
            </DishForm>
          </div>
        }
      />

      {all.length === 0 ? (
        <EmptyState
          icon={<ChefHat />}
          title={t('dishes.emptyTitle')}
          description={t('dishes.emptyDesc')}
          action={
            <DishForm mode="create" suggestedTags={suggestedTags}>
              <Button>
                <Plus className="h-4 w-4" />
                {t('dishes.addFirst')}
              </Button>
            </DishForm>
          }
        />
      ) : (
        <DishLibrary dishes={all} meId={me.id} isAdmin={me.isAdmin} />
      )}
    </>
  )
}
