'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChefHat, CookingPot, CheckCircle2, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { toggleCook, setMealStatus, deleteMeal } from '@/lib/actions/meals'
import type { Meal } from '@/lib/db/schema'

export function MealControls({
  meal,
  isCook,
  canManage,
  canDelete,
}: {
  meal: Meal
  isCook: boolean
  canManage: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const t = useT()
  const [pending, startTransition] = useTransition()

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn()
      router.refresh()
    })

  return (
    <div className="space-y-2.5">
      {meal.status !== 'cancelled' && meal.status !== 'done' && (
        <Button
          variant={isCook ? 'secondary' : 'primary'}
          className="w-full"
          size="lg"
          loading={pending}
          onClick={() => run(() => toggleCook(meal.id))}
        >
          <ChefHat className="h-5 w-5" />
          {isCook ? t('controls.uncook') : t('controls.cook')}
        </Button>
      )}

      {canManage && meal.status === 'ordering' && (
        <div className="flex gap-2">
          <Button
            variant="trough"
            className="flex-1"
            onClick={() => run(() => setMealStatus(meal.id, 'cooking'))}
          >
            <CookingPot className="h-4 w-4" />
            {t('controls.startCooking')}
          </Button>
          <Button
            variant="trough"
            className="flex-1"
            onClick={() => run(() => setMealStatus(meal.id, 'cancelled'))}
          >
            <X className="h-4 w-4" />
            {t('controls.cancelMeal')}
          </Button>
        </div>
      )}

      {canManage && meal.status === 'cooking' && (
        <Button
          variant="trough"
          className="w-full"
          onClick={() => run(() => setMealStatus(meal.id, 'done'))}
        >
          <CheckCircle2 className="h-4 w-4" />
          {t('controls.finish')}
        </Button>
      )}

      {canDelete && (
        <button
          className="flex w-full items-center justify-center gap-1.5 py-2 text-sm text-secondary"
          onClick={() => {
            if (confirm(t('controls.deleteConfirm')))
              run(() => deleteMeal(meal.id).then(() => router.push('/meals')))
          }}
        >
          <Trash2 className="h-4 w-4" />
          {t('controls.deleteMeal')}
        </button>
      )}
    </div>
  )
}
