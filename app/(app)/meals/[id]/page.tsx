import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight, Clock, Timer, ChefHat, Users } from 'lucide-react'
import { and, eq, gte, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes as dishesTable, meals as mealsTable, orders as ordersTable } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { getMealDetail, myOrderQuantities } from '@/lib/meals'
import { MEAL_EMOJI, fmtTime, fmtDateLabel, deadlineText, nowSec } from '@/lib/time'
import { getT } from '@/lib/i18n/server'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { List, Row } from '@/components/ui/list'
import { STATUS_META } from '@/components/meals/meal-card'
import { CookButton, MealManage, StatusAction } from '@/components/meals/meal-controls'
import { OrderPicker } from '@/components/meals/order-picker'
import { ReviewSection } from '@/components/meals/review-section'
import { DishThumb } from '@/components/dishes/dish-thumb'

export const dynamic = 'force-dynamic'

const RECENT_DAYS = 4

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

  const isCook = meal.cookId === me.id
  const canManage = me.isAdmin || meal.createdBy === me.id || isCook
  const canDelete = me.isAdmin || meal.createdBy === me.id
  const orderingOpen = meal.status === 'ordering' && nowSec() < meal.orderDeadline

  const activeDishes = orderingOpen
    ? db
        .select({
          id: dishesTable.id,
          name: dishesTable.name,
          description: dishesTable.description,
          instructions: dishesTable.instructions,
          imagePath: dishesTable.imagePath,
          tags: dishesTable.tags,
        })
        .from(dishesTable)
        .where(eq(dishesTable.status, 'active'))
        .all()
    : []
  const myQty = orderingOpen ? myOrderQuantities(id, me.id) : {}
  // 最近几天吃过的菜：「随便来点」时降低权重
  const recentDishIds = orderingOpen
    ? db
        .selectDistinct({ id: ordersTable.dishId })
        .from(ordersTable)
        .innerJoin(mealsTable, eq(ordersTable.mealId, mealsTable.id))
        .where(
          and(
            ne(mealsTable.id, id),
            ne(mealsTable.status, 'cancelled'),
            gte(mealsTable.diningTime, nowSec() - RECENT_DAYS * 86400),
          ),
        )
        .all()
        .map((r) => r.id)
    : []

  // 按菜聚合「谁点了 / 共几份」
  type Group = {
    dishId: string
    name: string
    image: string | null
    tags: string[] | null
    total: number
    people: { id: string; name: string; qty: number }[]
  }
  const byDish = new Map<string, Group>()
  for (const o of orders) {
    let g = byDish.get(o.dishId)
    if (!g) {
      g = { dishId: o.dishId, name: o.dishName, image: o.dishImage, tags: o.dishTags, total: 0, people: [] }
      byDish.set(o.dishId, g)
    }
    g.total += o.quantity
    g.people.push({ id: o.userId, name: o.userName, qty: o.quantity })
  }
  const dishGroups = [...byDish.values()].sort((a, b) => b.total - a.total)
  const participantCount = new Set(orders.map((o) => o.userId)).size
  const servings = dishGroups.reduce((s, g) => s + g.total, 0)
  const myPickedCount = Object.keys(myQty).length

  const status = STATUS_META[meal.status]
  const sep = t('common.listSep')
  const whoText = (g: Group) =>
    g.people.map((p) => (p.qty > 1 ? `${p.name} ×${p.qty}` : p.name)).join(sep)

  const summaryList =
    dishGroups.length === 0 ? (
      <div className="mf-inset rounded-2xl p-5 text-center text-sm text-secondary">
        {orderingOpen ? t('detail.noOrdersOpen') : t('detail.noOrdersClosed')}
      </div>
    ) : (
      <List>
        {dishGroups.map((g) => (
          <Row
            key={g.dishId}
            chevron={false}
            className="mf-row-dish"
            leading={
              <DishThumb
                name={g.name}
                imagePath={g.image}
                tags={g.tags}
                sizes="44px"
                className="h-11 w-11 shrink-0 rounded-xl"
                emojiClassName="text-[22px]"
              />
            }
            title={g.name}
            subtitle={whoText(g)}
            trailing={
              <span className="rounded-full bg-tint px-2.5 py-1 text-sm font-semibold tabular-nums text-accent">
                ×{g.total}
              </span>
            }
          />
        ))}
      </List>
    )

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/meals" className="-ml-1 inline-flex items-center text-secondary">
          <ChevronLeft className="h-5 w-5" />
          {t('nav.meals')}
        </Link>
        <Badge tone={status.tone}>{t(status.labelKey)}</Badge>
      </div>

      {/* 信息卡：吃什么时候 + 谁掌勺（认领按钮就在旁边） */}
      <div className="mf-raised mb-4 p-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl ${status.tile}`}
          >
            {MEAL_EMOJI[meal.mealType]}
          </div>
          <div className="min-w-0">
            <h1 className="tracking-title truncate text-xl font-bold text-ink">
              {meal.title || `${fmtDateLabel(meal.date, tz, t)} ${t('meal.' + meal.mealType)}`}
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

        <div className="mt-4 space-y-3 border-t border-black/[0.05] pt-3.5 text-sm">
          <div className="flex items-center gap-2 text-secondary">
            <Timer className="h-4 w-4 shrink-0" />
            {meal.status === 'ordering'
              ? deadlineText(meal.orderDeadline, tz, t)
              : meal.status === 'cancelled'
                ? t('detail.orderCancelled')
                : t('detail.orderEnded')}
          </div>
          <div className="flex min-h-9 items-center gap-2">
            <ChefHat className="h-4 w-4 shrink-0 text-accent" />
            {cook ? (
              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-ink">
                <Avatar
                  name={cook.name}
                  src={cook.avatarPath ? `/api/uploads/${cook.avatarPath}` : null}
                  size={22}
                />
                <span className="truncate">{t('detail.cook', { name: cook.name })}</span>
              </span>
            ) : (
              <span className="flex-1 text-secondary">{t('detail.noCook')}</span>
            )}
            <CookButton meal={meal} isCook={isCook} hasCook={Boolean(cook)} />
          </div>
        </div>
      </div>

      {/* 点菜 */}
      {orderingOpen && (
        <section className="mb-7">
          {dishGroups.length > 0 && (
            <a
              href="#who"
              className="mf-tonal mf-pressable mb-4 flex items-center gap-3 px-4 py-3"
            >
              <Users className="h-[18px] w-[18px] shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">
                  {t('detail.summary', { p: participantCount, d: dishGroups.length })}
                </span>
                <span className="block truncate text-xs text-secondary">
                  {dishGroups
                    .slice(0, 4)
                    .map((g) => (g.total > 1 ? `${g.name}×${g.total}` : g.name))
                    .join(sep)}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-secondary/60" />
            </a>
          )}
          <h2 className="mb-2 text-base font-semibold text-ink">
            {t('detail.pick')}
            {myPickedCount > 0 && (
              <span className="ml-1.5 text-sm font-normal text-accent">
                {t('detail.picked', { n: myPickedCount })}
              </span>
            )}
          </h2>
          <OrderPicker
            mealId={meal.id}
            mealType={meal.mealType}
            dishes={activeDishes}
            initialQty={myQty}
            recentDishIds={recentDishIds}
          />
        </section>
      )}

      {/* 大家点了什么（掌勺人的「要做清单」） */}
      <section id="who" className="scroll-mt-4">
        <h2 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-ink">
          {t('detail.who')}
          {participantCount > 0 && (
            <span className="text-sm font-normal text-secondary">
              {t('detail.summaryServings', {
                p: participantCount,
                d: dishGroups.length,
                s: servings,
              })}
            </span>
          )}
        </h2>
        {summaryList}
      </section>

      {(meal.status === 'ordering' || meal.status === 'cooking') && canManage && (
        <div className="mt-4">
          <StatusAction meal={meal} canManage={canManage} />
        </div>
      )}

      {meal.status === 'done' && (
        <ReviewSection mealId={meal.id} reviews={reviews} meId={me.id} />
      )}

      <MealManage meal={meal} canManage={canManage} canDelete={canDelete} />
    </>
  )
}
