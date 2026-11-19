/**
 * 「智能推荐」的规则引擎（不依赖 LLM，也是 LLM 失败时的兜底）。纯函数。
 *
 * 打分思路：
 * - 用得上家里库存（快过期的更优先）
 * - 应季食材、契合冷热的做法
 * - 最近几天吃过的降权
 * - 加一点随机，避免每次都一样
 */
import { seasonalHit, weatherHit } from './season'

export const ANY_TAG = '__any__'

export type RecDish = {
  id: string
  name: string
  description?: string | null
  instructions?: string | null
  tags: string[] | null
}

export type RecPantryItem = {
  name: string
  quantity?: number | null
  unit?: string | null
  expiresOn?: string | null
}

export type Slot = { tag: string; count: number }

export type Reason =
  | { kind: 'expiring'; item: string }
  | { kind: 'pantry'; item: string }
  | { kind: 'seasonal'; item: string }
  | { kind: 'weather'; feel: 'hot' | 'cold' }
  | { kind: 'fresh' }

export type RulePick = { id: string; reasons: Reason[] }

/** 同一种食材的常见叫法 */
const SYNONYMS: string[][] = [
  ['番茄', '西红柿'],
  ['土豆', '马铃薯', '洋芋'],
  ['包菜', '圆白菜', '卷心菜', '甘蓝'],
  ['香菜', '芫荽'],
  ['红薯', '地瓜', '番薯'],
  ['玉米', '苞谷'],
  ['鸡蛋', '蛋'],
]

function aliases(name: string): string[] {
  const n = name.trim().toLowerCase()
  if (!n) return []
  const group = SYNONYMS.find((g) => g.includes(n))
  // 「蛋」太宽泛：只作为「鸡蛋」的别名，库存写「蛋」时也只认「蛋」
  return group && n !== '蛋' ? group : [n]
}

export function dishText(d: RecDish): string {
  return [d.name, d.description ?? '', (d.instructions ?? '').slice(0, 3000)]
    .join('\n')
    .toLowerCase()
}

/** 两个 YYYY-MM-DD 相差天数（b - a） */
export function daysBetween(a: string, b: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((ms(b) - ms(a)) / 86_400_000)
}

/** 某道菜用得上的库存（已过期的不算） */
export function pantryMatches(
  dish: RecDish,
  pantry: RecPantryItem[],
  today: string,
  text = dishText(dish),
): { item: RecPantryItem; daysLeft: number | null }[] {
  const out: { item: RecPantryItem; daysLeft: number | null }[] = []
  for (const item of pantry) {
    const daysLeft = item.expiresOn ? daysBetween(today, item.expiresOn) : null
    if (daysLeft !== null && daysLeft < 0) continue
    if (item.quantity === 0) continue
    if (aliases(item.name).some((a) => text.includes(a)))
      out.push({ item, daysLeft })
  }
  return out
}

/** 计划 → 有序的槽位（具体分类在前，「不限」最后） */
export function planToSlots(plan: Record<string, number>): Slot[] {
  return Object.entries(plan)
    .map(([tag, count]) => ({
      tag,
      count: Math.max(0, Math.min(6, Math.floor(Number(count) || 0))),
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => (a.tag === ANY_TAG ? 1 : 0) - (b.tag === ANY_TAG ? 1 : 0))
}

export function slotPool(
  dishes: RecDish[],
  slot: Slot,
  taken: Set<string>,
): RecDish[] {
  return dishes.filter(
    (d) =>
      !taken.has(d.id) &&
      (slot.tag === ANY_TAG || (d.tags ?? []).includes(slot.tag)),
  )
}

export function scoreDish(
  dish: RecDish,
  ctx: { pantry: RecPantryItem[]; recent: Set<string>; date: string },
): { score: number; reasons: Reason[] } {
  const text = dishText(dish)
  const reasons: Reason[] = []
  let score = 1

  const hits = pantryMatches(dish, ctx.pantry, ctx.date, text)
  const expiring = hits
    .filter((h) => h.daysLeft !== null && h.daysLeft <= 3)
    .sort((a, b) => a.daysLeft! - b.daysLeft!)
  if (expiring.length > 0) {
    score += 3
    reasons.push({ kind: 'expiring', item: expiring[0].item.name })
  } else if (hits.length > 0) {
    score += 2
    reasons.push({ kind: 'pantry', item: hits[0].item.name })
  }

  const seasonal = seasonalHit(text, ctx.date)
  if (seasonal) {
    score += 1.2
    reasons.push({ kind: 'seasonal', item: seasonal })
  }
  const feel = weatherHit(text, ctx.date)
  if (feel) {
    score += 0.6
    reasons.push({ kind: 'weather', feel })
  }

  if (ctx.recent.has(dish.id)) score -= 1.5
  else if (reasons.length === 0) reasons.push({ kind: 'fresh' })

  return { score, reasons }
}

/** 按槽位挑菜：每个槽位里取「分数 + 随机扰动」最高的 n 道 */
export function rulePick(input: {
  dishes: RecDish[]
  slots: Slot[]
  pantry: RecPantryItem[]
  recentIds: Iterable<string>
  excludeIds: Iterable<string>
  date: string
  random?: () => number
}): RulePick[] {
  const random = input.random ?? Math.random
  const recent = new Set(input.recentIds)
  const taken = new Set(input.excludeIds)
  const ctx = { pantry: input.pantry, recent, date: input.date }
  const out: RulePick[] = []
  for (const slot of input.slots) {
    const ranked = slotPool(input.dishes, slot, taken)
      .map((d) => {
        const s = scoreDish(d, ctx)
        return { d, reasons: s.reasons, rank: s.score + random() * 1.2 }
      })
      .sort((a, b) => b.rank - a.rank)
      .slice(0, slot.count)
    for (const r of ranked) {
      taken.add(r.d.id)
      out.push({ id: r.d.id, reasons: r.reasons })
    }
  }
  return out
}
