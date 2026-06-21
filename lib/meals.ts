import 'server-only'
import { eq, and, desc, asc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { meals, orders, dishes, users, reviews } from '@/lib/db/schema'
import type { Meal } from '@/lib/db/schema'

export type OrderDetail = {
  id: string
  note: string | null
  userId: string
  userName: string
  userAvatar: string | null
  dishId: string
  dishName: string
  dishImage: string | null
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
      userId: users.id,
      userName: users.name,
      userAvatar: users.avatarPath,
      dishId: dishes.id,
      dishName: dishes.name,
      dishImage: dishes.imagePath,
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

export function listMeals(): Meal[] {
  return db.select().from(meals).orderBy(desc(meals.diningTime)).all()
}

/** 我在某饭局点的菜 id 集合 */
export function myOrderedDishIds(mealId: string, userId: string): Set<string> {
  const rows = db
    .select({ dishId: orders.dishId })
    .from(orders)
    .where(and(eq(orders.mealId, mealId), eq(orders.userId, userId)))
    .all()
  return new Set(rows.map((r) => r.dishId))
}
