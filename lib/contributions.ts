import 'server-only'
import { sql, inArray, isNotNull, and } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { meals, orders } from '@/lib/db/schema'
import { listMembers } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { dayjs, todayLocal } from '@/lib/time'

export type MemberContribution = {
  id: string
  name: string
  avatarPath: string | null
  cookByDate: Record<string, number>
  orderByDate: Record<string, number>
  cookTotal: number
  orderTotal: number
  streak: number // 连续活跃天数（做饭或点菜）
}

/** 当前连续活跃天数（截至今天往前数） */
function currentStreak(
  active: Set<string>,
  today: string,
): number {
  let streak = 0
  let d = dayjs(today)
  // 今天没活动也允许从昨天起算？这里严格：必须含今天才计；否则从最近活跃日回溯
  // 采用「最近活跃日往前连续」：找到最近活跃日
  if (!active.has(d.format('YYYY-MM-DD'))) {
    if (active.has(d.subtract(1, 'day').format('YYYY-MM-DD'))) d = d.subtract(1, 'day')
    else return 0
  }
  while (active.has(d.format('YYYY-MM-DD'))) {
    streak++
    d = d.subtract(1, 'day')
  }
  return streak
}

export function getContributions(): {
  members: MemberContribution[]
  today: string
  weeks: number
} {
  const tz = getSettings().timezone
  const today = todayLocal(tz)
  const weeks = 18 // 适配手机宽度，整图免横向滚动，最近活动始终可见

  const members = listMembers()
  if (members.length === 0) return { members: [], today, weeks }

  // 做饭：按 cookId + 饭局日期 计数（已做/做饭中，排除取消）
  const cookRows = db
    .select({
      userId: meals.cookId,
      date: meals.date,
      c: sql<number>`count(*)`,
    })
    .from(meals)
    .where(
      and(isNotNull(meals.cookId), inArray(meals.status, ['done', 'cooking'])),
    )
    .groupBy(meals.cookId, meals.date)
    .all()

  // 点菜：按 userId + 下单当天（家庭时区）计「参与的饭局数」
  // 用 createdAt 反映当天的点菜活跃，而非饭局日期（可能在未来）
  const orderRows = db
    .select({
      userId: orders.userId,
      mealId: orders.mealId,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .all()

  const cookMap = new Map<string, Record<string, number>>()
  for (const r of cookRows) {
    if (!r.userId) continue
    if (!cookMap.has(r.userId)) cookMap.set(r.userId, {})
    cookMap.get(r.userId)![r.date] = Number(r.c)
  }

  // 先按 (user, day) 收集去重的饭局集合，再计数
  const orderSets = new Map<string, Map<string, Set<string>>>()
  for (const r of orderRows) {
    const day = dayjs.unix(r.createdAt).tz(tz).format('YYYY-MM-DD')
    if (!orderSets.has(r.userId)) orderSets.set(r.userId, new Map())
    const byDay = orderSets.get(r.userId)!
    if (!byDay.has(day)) byDay.set(day, new Set())
    byDay.get(day)!.add(r.mealId)
  }
  const orderMap = new Map<string, Record<string, number>>()
  for (const [userId, byDay] of orderSets) {
    const rec: Record<string, number> = {}
    for (const [day, meals2] of byDay) rec[day] = meals2.size
    orderMap.set(userId, rec)
  }

  const result = members.map((m) => {
    const cookByDate = cookMap.get(m.id) ?? {}
    const orderByDate = orderMap.get(m.id) ?? {}
    const active = new Set<string>([
      ...Object.keys(cookByDate),
      ...Object.keys(orderByDate),
    ])
    return {
      id: m.id,
      name: m.name,
      avatarPath: m.avatarPath,
      cookByDate,
      orderByDate,
      cookTotal: Object.values(cookByDate).reduce((a, b) => a + b, 0),
      orderTotal: Object.values(orderByDate).reduce((a, b) => a + b, 0),
      streak: currentStreak(active, today),
    }
  })

  // 做饭多的排前面
  result.sort((a, b) => b.cookTotal - a.cookTotal || b.orderTotal - a.orderTotal)

  return { members: result, today, weeks }
}
