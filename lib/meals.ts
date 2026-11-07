import 'server-only'
import { eq, and, desc, asc, inArray, sql, exists } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { meals, orders, dishes, users, reviews } from '@/lib/db/schema'
import type { Meal } from '@/lib/db/schema'

export type OrderDetail = {
  id: string
  note: string | null
  quantity: number
  userId: string
  userName: string
  userAvatar: string | null
  dishId: string
  dishName: string
  dishImage: string | null
  dishTags: string[] | null
}

export type ReviewDetail = {
  id: string
  rating: number
  comment: string | null
  userId: string
  userName: string
  userAvatar: string | null
}

export type MealDetail = {
  meal: Meal
  cook: { id: string; name: string; avatarPath: string | null } | null
  orders: OrderDetail[]
  reviews: ReviewDetail[]
}

export function getMeal(id: string): Meal | undefined {
  return db.select().from(meals).where(eq(meals.id, id)).get()
}

export function getMealDetail(id: string): MealDetail | null {
  const meal = getMeal(id)
  if (!meal) return null

  const cook = meal.cookId
    ? db
        .select({
          id: users.id,
          name: users.name,
          avatarPath: users.avatarPath,
        })
        .from(users)
        .where(eq(users.id, meal.cookId))
        .get() ?? null
    : null

  const orderRows = db
    .select({
      id: orders.id,
      note: orders.note,
      quantity: orders.quantity,
      userId: users.id,
      userName: users.name,
      userAvatar: users.avatarPath,
      dishId: dishes.id,
      dishName: dishes.name,
      dishImage: dishes.imagePath,
      dishTags: dishes.tags,
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .innerJoin(dishes, eq(orders.dishId, dishes.id))
    .where(eq(orders.mealId, id))
    .orderBy(asc(orders.createdAt))
    .all()

  const reviewRows = db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      userId: users.id,
      userName: users.name,
      userAvatar: users.avatarPath,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.mealId, id))
    .orderBy(asc(reviews.createdAt))
    .all()

  return { meal, cook, orders: orderRows, reviews: reviewRows }
}

/** 进行中的饭局（点菜中 / 做饭中），按用餐时间升序 */
export function listActiveMeals(): Meal[] {
  return db
    .select()
    .from(meals)
    .where(inArray(meals.status, ['ordering', 'cooking']))
    .orderBy(asc(meals.diningTime))
    .all()
}

/** 某日期范围内的饭局（YYYY-MM-DD，含首尾） */
export function listMealsBetween(from: string, to: string): Meal[] {
  return db
    .select()
    .from(meals)
    .where(sql`${meals.date} >= ${from} and ${meals.date} <= ${to}`)
    .orderBy(asc(meals.diningTime))
    .all()
}

const hasOrders = exists(
  db.select({ one: sql`1` }).from(orders).where(eq(orders.mealId, meals.id)),
)

/**
 * 历史饭局（已完成 / 已取消），新的在前，分页。
 * 默认隐藏「没人点菜」的空饭局（自动饭局开了但家人没点时会大量堆积）。
 */
export function listHistoryMeals(opts: {
  limit: number
  includeEmpty: boolean
}): { items: Meal[]; hasMore: boolean } {
  const where = and(
    inArray(meals.status, ['done', 'cancelled']),
    opts.includeEmpty ? undefined : hasOrders,
  )
  const rows = db
    .select()
    .from(meals)
    .where(where)
    .orderBy(desc(meals.diningTime))
    .limit(opts.limit + 1)
    .all()
  return { items: rows.slice(0, opts.limit), hasMore: rows.length > opts.limit }
}

/** 没人点菜的历史饭局数量（用于「显示 N 个空饭局」开关） */
export function countEmptyHistoryMeals(): number {
  return (
    db
      .select({ c: sql<number>`count(*)` })
      .from(meals)
      .where(
        and(
          inArray(meals.status, ['done', 'cancelled']),
          sql`not ${hasOrders}`,
        ),
      )
      .get()?.c ?? 0
  )
}

export type MealSummary = {
  /** 点菜人数 */
  participants: number
  /** 不同菜品数 */
  dishCount: number
  /** 总份数 */
  servings: number
  /** 点得最多的几道菜名 */
  topDishes: string[]
  /** 我点了几道（不同菜品数） */
  mine: number
  /** 平均评分（无评价为 null） */
  rating: number | null
}

const EMPTY_SUMMARY: MealSummary = {
  participants: 0,
  dishCount: 0,
  servings: 0,
  topDishes: [],
  mine: 0,
  rating: null,
}

/** 一次 SQL 聚合多个饭局的摘要（替代把全部点菜记录拉进内存） */
export function mealSummaries(
  mealIds: string[],
  meId: string,
): Map<string, MealSummary> {
  const out = new Map<string, MealSummary>()
  if (mealIds.length === 0) return out
  for (const id of mealIds) out.set(id, { ...EMPTY_SUMMARY, topDishes: [] })

  const totals = db
    .select({
      mealId: orders.mealId,
      participants: sql<number>`count(distinct ${orders.userId})`,
      dishCount: sql<number>`count(distinct ${orders.dishId})`,
      servings: sql<number>`sum(${orders.quantity})`,
      mine: sql<number>`sum(case when ${orders.userId} = ${meId} then 1 else 0 end)`,
    })
    .from(orders)
    .where(inArray(orders.mealId, mealIds))
    .groupBy(orders.mealId)
    .all()
  for (const r of totals) {
    const s = out.get(r.mealId)!
    s.participants = r.participants
    s.dishCount = r.dishCount
    s.servings = r.servings ?? 0
    s.mine = r.mine ?? 0
  }

  const perDish = db
    .select({
      mealId: orders.mealId,
      name: dishes.name,
      n: sql<number>`sum(${orders.quantity})`,
    })
    .from(orders)
    .innerJoin(dishes, eq(orders.dishId, dishes.id))
    .where(inArray(orders.mealId, mealIds))
    .groupBy(orders.mealId, orders.dishId)
    .orderBy(desc(sql`sum(${orders.quantity})`), asc(dishes.name))
    .all()
  for (const r of perDish) {
    const s = out.get(r.mealId)!
    if (s.topDishes.length < 4) s.topDishes.push(r.name)
  }

  const ratings = db
    .select({
      mealId: reviews.mealId,
      avg: sql<number>`avg(${reviews.rating})`,
    })
    .from(reviews)
    .where(inArray(reviews.mealId, mealIds))
    .groupBy(reviews.mealId)
    .all()
  for (const r of ratings) out.get(r.mealId)!.rating = r.avg

  return out
}

/** 我在某饭局点的菜：dishId → 份数 */
export function myOrderQuantities(
  mealId: string,
  userId: string,
): Record<string, number> {
  const rows = db
    .select({ dishId: orders.dishId, quantity: orders.quantity })
    .from(orders)
    .where(and(eq(orders.mealId, mealId), eq(orders.userId, userId)))
    .all()
  return Object.fromEntries(rows.map((r) => [r.dishId, r.quantity]))
}
