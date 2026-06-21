import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Clock, Timer, ChefHat, Soup } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes as dishesTable } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { getMealDetail, myOrderedDishIds } from '@/lib/meals'
import { MEAL_EMOJI, fmtTime, fmtDateLabel, deadlineText, nowSec } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { STATUS_META } from '@/components/meals/meal-card'
import { MealControls } from '@/components/meals/meal-controls'
import { OrderPicker } from '@/components/meals/order-picker'
import { ReviewSection } from '@/components/meals/review-section'

export const dynamic = 'force-dynamic'

export default async function MealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const me = await requireUser()
  const detail = getMealDetail(id)
  if (!detail) notFound()
  const { meal, cook, orders, reviews } = detail
  const tz = getSettings().timezone
  const t = await getT()

  const activeDishes = db
    .select()
    .from(dishesTable)
    .where(eq(dishesTable.status, 'active'))
    .all()
  const myIds = [...myOrderedDishIds(id, me.id)]

  const isCook = meal.cookId === me.id
  const canManage = me.isAdmin || meal.createdBy === me.id || isCook
  const canDelete = me.isAdmin || meal.createdBy === me.id
  const orderingOpen =
    meal.status === 'ordering' && nowSec() < meal.orderDeadline

  // 按菜聚合「谁点了」
  const byDish = new Map<
    string,
    { name: string; image: string | null; people: { id: string; name: string; avatar: string | null }[] }
  >()
  for (const o of orders) {
    if (!byDish.has(o.dishId))
      byDish.set(o.dishId, { name: o.dishName, image: o.dishImage, people: [] })
    byDish.get(o.dishId)!.people.push({
      id: o.userId,
      name: o.userName,
      avatar: o.userAvatar,
    })
  }
  const dishGroups = [...byDish.values()].sort(
    (a, b) => b.people.length - a.people.length,
  )
  const participantCount = new Set(orders.map((o) => o.userId)).size

  const status = STATUS_META[meal.status]

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/meals"
          className="-ml-1 inline-flex items-center text-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
          {t('nav.meals')}
        </Link>
        <Badge tone={status.tone}>{t(status.labelKey)}</Badge>
      </div>

      {/* 信息卡 */}
      <div className="mf-raised mb-4 p-5">
        <div className="relative flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-trough text-3xl">
            {MEAL_EMOJI[meal.mealType]}
          </div>
          <div>
            <h1 className="tracking-title text-xl font-bold text-ink">
              {meal.title ||
                `${fmtDateLabel(meal.date, tz, t)} ${t('meal.' + meal.mealType)}`}
            </h1>
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-secondary">
              <Clock className="h-4 w-4" />
              {t('detail.eatAt', {
                date: fmtDateLabel(meal.date, tz, t),
                time: fmtTime(meal.diningTime, tz),
              })}
            </p>
          </div>
        </div>

        <div className="relative mt-4 flex flex-col gap-2 border-t border-black/[0.04] pt-4 text-sm">
          <div className="flex items-center gap-2 text-secondary">
            <Timer className="h-4 w-4" />
            {meal.status === 'ordering'
              ? deadlineText(meal.orderDeadline, tz, t)
              : meal.status === 'cancelled'
                ? t('detail.orderCancelled')
                : t('detail.orderEnded')}
          </div>
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-accent" />
            {cook ? (
              <span className="inline-flex items-center gap-1.5 text-ink">
                <Avatar
                  name={cook.name}
                  src={cook.avatarPath ? `/api/uploads/${cook.avatarPath}` : null}
                  size={22}
                />
                {t('detail.cook', { name: cook.name })}
              </span>
            ) : (
              <span className="text-secondary">{t('detail.noCook')}</span>
            )}
          </div>
        </div>
      </div>

      {/* 控制 */}
      <div className="mb-6">
        <MealControls
          meal={meal}
          isCook={isCook}
          canManage={canManage}
          canDelete={canDelete}
        />
      </div>

      {/* 点菜 */}
      {orderingOpen && (
        <section className="mb-6">
          <h2 className="mb-3 text-base font-semibold text-ink">
            {t('detail.pick')}
            {myIds.length > 0 && t('detail.picked', { n: myIds.length })}
          </h2>
          <OrderPicker
            mealId={meal.id}
            dishes={activeDishes}
            initialSelected={myIds}
          />
        </section>
      )}

      {/* 大家点了什么 */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">
          {t('detail.who')}
          {participantCount > 0 && (
            <span className="ml-2 text-sm font-normal text-secondary">
              {t('detail.summary', {
                p: participantCount,
                d: dishGroups.length,
              })}
            </span>
          )}
        </h2>
        {dishGroups.length === 0 ? (
          <div className="rounded-2xl mf-inset p-5 text-center text-sm text-secondary">
            {orderingOpen
              ? t('detail.noOrdersOpen')
              : t('detail.noOrdersClosed')}
          </div>
        ) : (
          <div className="space-y-2.5">
            {dishGroups.map((g) => (
              <div
                key={g.name}
                className="mf-raised flex items-center gap-3 p-3"
              >
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-trough">
                  {g.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/uploads/${g.image}`}
                      alt={g.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Soup className="h-5 w-5 text-secondary/40" />
                  )}
                </div>
                <div className="relative min-w-0 flex-1">
                  <p className="font-medium text-ink">{g.name}</p>
                  <p className="truncate text-xs text-secondary">
                    {g.people.map((p) => p.name).join(t('common.listSep'))}
                  </p>
                </div>
                <span className="relative shrink-0 rounded-full bg-[rgb(var(--mf-accent-soft)/0.15)] px-2.5 py-1 text-sm font-semibold text-accent">
                  ×{g.people.length}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {meal.status === 'done' && (
        <ReviewSection mealId={meal.id} reviews={reviews} meId={me.id} />
      )}
    </>
  )
}
