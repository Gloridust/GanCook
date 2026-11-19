import 'server-only'
import type { Dish, Meal, PantryItem, User } from '@/lib/db/schema'
import type { MealDetail } from '@/lib/meals'

const img = (p: string | null) => (p ? `/api/uploads/${p}` : null)

export function userOut(u: User) {
  return { id: u.id, name: u.name, isAdmin: u.isAdmin, avatarUrl: img(u.avatarPath) }
}

export function dishOut(d: Dish) {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    instructions: d.instructions,
    tags: d.tags ?? [],
    imageUrl: img(d.imagePath),
    status: d.status,
    createdAt: d.createdAt,
  }
}

export function mealOut(m: Meal) {
  return {
    id: m.id,
    title: m.title,
    mealType: m.mealType,
    date: m.date,
    diningTime: m.diningTime,
    orderDeadline: m.orderDeadline,
    status: m.status,
    cookId: m.cookId,
    isAuto: m.isAuto,
    createdAt: m.createdAt,
  }
}

export function mealDetailOut(d: MealDetail) {
  const byDish = new Map<
    string,
    { dishId: string; name: string; total: number; orders: { userId: string; userName: string; quantity: number }[] }
  >()
  for (const o of d.orders) {
    let g = byDish.get(o.dishId)
    if (!g) {
      g = { dishId: o.dishId, name: o.dishName, total: 0, orders: [] }
      byDish.set(o.dishId, g)
    }
    g.total += o.quantity
    g.orders.push({ userId: o.userId, userName: o.userName, quantity: o.quantity })
  }
  return {
    ...mealOut(d.meal),
    cook: d.cook ? { id: d.cook.id, name: d.cook.name } : null,
    dishes: [...byDish.values()].sort((a, b) => b.total - a.total),
    reviews: d.reviews.map((r) => ({
      userId: r.userId,
      userName: r.userName,
      rating: r.rating,
      comment: r.comment,
    })),
  }
}

export function pantryOut(p: PantryItem) {
  return {
    id: p.id,
    name: p.name,
    quantity: p.quantity,
    unit: p.unit,
    location: p.location,
    expiresOn: p.expiresOn,
    note: p.note,
    updatedAt: p.updatedAt,
  }
}
