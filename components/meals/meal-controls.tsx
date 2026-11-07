'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChefHat, CookingPot, CheckCircle2, X, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { toggleCook, setMealStatus, deleteMeal } from '@/lib/actions/meals'
import type { Meal } from '@/lib/db/schema'

function useRun() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn()
      router.refresh()
    })
  return { pending, run, router }
}

/** 「我来做这顿」——放在信息卡里，和「谁掌勺」挨在一起 */
export function CookButton({
  meal,
  isCook,
  hasCook,
}: {
  meal: Meal
  isCook: boolean
  hasCook: boolean
}) {
  const t = useT()
  const { pending, run } = useRun()
  if (meal.status === 'cancelled' || meal.status === 'done') return null
  return (
    <Button
      size="sm"
      variant={isCook || hasCook ? 'secondary' : 'primary'}
      loading={pending}
      onClick={() => run(() => toggleCook(meal.id))}
      className="shrink-0"
    >
      {!isCook && <ChefHat className="h-4 w-4" />}
      {isCook
        ? t('controls.uncookShort')
        : hasCook
          ? t('controls.takeOver')
          : t('controls.cookShort')}
    </Button>
  )
}

/** 掌勺人推进饭局状态的主操作（截止开做 / 做好了） */
export function StatusAction({ meal, canManage }: { meal: Meal; canManage: boolean }) {
  const t = useT()
  const { pending, run } = useRun()
  if (!canManage) return null
  if (meal.status === 'ordering')
    return (
      <Button
        variant="tonal"
        className="w-full"
        loading={pending}
        onClick={() => run(() => setMealStatus(meal.id, 'cooking'))}
      >
        <CookingPot className="h-4 w-4" />
        {t('controls.startCooking')}
      </Button>
    )
  if (meal.status === 'cooking')
    return (
      <Button
        className="w-full"
        loading={pending}
        onClick={() => run(() => setMealStatus(meal.id, 'done'))}
      >
        <CheckCircle2 className="h-4 w-4" />
        {t('controls.finish')}
      </Button>
    )
  return null
}

/** 次要的管理操作：取消 / 恢复 / 删除，放在页面底部，避免和点菜抢位置 */
export function MealManage({
  meal,
  canManage,
  canDelete,
}: {
  meal: Meal
  canManage: boolean
  canDelete: boolean
}) {
  const t = useT()
  const { run, router } = useRun()
  const canCancel = canManage && (meal.status === 'ordering' || meal.status === 'cooking')
  const canReopen = canManage && meal.status === 'cancelled'
  if (!canCancel && !canReopen && !canDelete) return null

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-secondary">
      {canCancel && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 py-2"
          onClick={() => {
            if (confirm(t('controls.cancelConfirm')))
              run(() => setMealStatus(meal.id, 'cancelled'))
          }}
        >
          <X className="h-4 w-4" />
          {t('controls.cancelMeal')}
        </button>
      )}
      {canReopen && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 py-2"
          onClick={() => run(() => setMealStatus(meal.id, 'ordering'))}
        >
          <Undo2 className="h-4 w-4" />
          {t('controls.reopen')}
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 py-2 text-danger/80"
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
