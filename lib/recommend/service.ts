import 'server-only'
import { and, eq, gte, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { dishes, meals, orders, type Meal } from '@/lib/db/schema'
import { listPantry } from '@/lib/services/pantry'
import { getStoredLlmConfig } from '@/lib/llm/settings'
import { chatJson } from '@/lib/llm/client'
import { RECOMMEND_LLM_TIMEOUT_MS } from '@/lib/llm/timeouts'
import { dictionaries } from '@/lib/i18n/dictionaries'
import { format, type Locale } from '@/lib/i18n/config'
import { nowSec } from '@/lib/time'
import { seasonLabel } from './season'
import {
  planToSlots,
  rulePick,
  type Reason,
  type RecDish,
} from './rules'
import {
  buildRecommendPrompt,
  parseRecommendOutput,
  remainingSlots,
} from './llm'

const RECENT_DAYS = 4

export type SmartPick = { id: string; reason: string }
export type SmartResult = {
  picks: SmartPick[]
  summary: string
  source: 'llm' | 'rules'
  seasonLabel: string
  /** LLM 已开启但这次调用失败、退回规则时为 true */
  llmFailed: boolean
}

export function reasonText(reasons: Reason[], locale: Locale): string {
  const msgs = dictionaries[locale]
  const sep = msgs['common.listSep'] ?? '、'
  return reasons
    .slice(0, 2)
    .map((r) => {
      switch (r.kind) {
        case 'expiring':
          return format(msgs['smart.reason.expiring'], { item: r.item })
        case 'pantry':
          return format(msgs['smart.reason.pantry'], { item: r.item })
        case 'seasonal':
          return format(msgs['smart.reason.seasonal'], { item: r.item })
        case 'weather':
          return msgs[r.feel === 'hot' ? 'smart.reason.hot' : 'smart.reason.cold']
        default:
          return msgs['smart.reason.fresh']
      }
    })
    .join(sep)
}

function recentDishes(excludeMealId: string): { id: string; name: string }[] {
  return db
    .selectDistinct({ id: orders.dishId, name: dishes.name })
    .from(orders)
    .innerJoin(meals, eq(orders.mealId, meals.id))
    .innerJoin(dishes, eq(orders.dishId, dishes.id))
    .where(
      and(
        ne(meals.id, excludeMealId),
        ne(meals.status, 'cancelled'),
        gte(meals.diningTime, nowSec() - RECENT_DAYS * 86400),
      ),
    )
    .all()
}

/**
 * 「智能」配一桌：LLM 已配置就让它挑（结合时令、库存、最近吃过的），
 * 挑不满或失败时用规则引擎补齐；没配置 LLM 就只用规则。
 */
export async function smartRecommend(input: {
  meal: Pick<Meal, 'id' | 'date' | 'mealType'>
  plan: Record<string, number>
  excludeIds: string[]
  locale: Locale
}): Promise<SmartResult> {
  const slots = planToSlots(input.plan)
  const label = seasonLabel(input.meal.date, input.locale)
  const pool: RecDish[] = db
    .select({
      id: dishes.id,
      name: dishes.name,
      description: dishes.description,
      instructions: dishes.instructions,
      tags: dishes.tags,
    })
    .from(dishes)
    .where(eq(dishes.status, 'active'))
    .all()
  const pantry = listPantry()
  const recent = recentDishes(input.meal.id)
  const exclude = new Set(input.excludeIds)
  const empty: SmartResult = {
    picks: [],
    summary: '',
    source: 'rules',
    seasonLabel: label,
    llmFailed: false,
  }
  if (slots.length === 0 || pool.length === 0) return empty

  const config = getStoredLlmConfig()
  let llmPicks: SmartPick[] = []
  let summary = ''
  let llmFailed = false
  if (config.enabled) {
    try {
      const prompt = buildRecommendPrompt({
        locale: input.locale,
        date: input.meal.date,
        seasonLabel: seasonLabel(input.meal.date, 'zh'),
        mealType: input.meal.mealType,
        slots,
        dishes: pool,
        pantry,
        recentNames: recent.map((r) => r.name),
        excludeIds: exclude,
      })
      const raw = await chatJson(config, {
        system: prompt.system,
        user: prompt.user,
        maxTokens: 1200,
        timeoutMs: RECOMMEND_LLM_TIMEOUT_MS,
        temperature: 0.7,
      })
      const parsed = parseRecommendOutput(raw, {
        idMap: prompt.idMap,
        slots,
        dishes: pool,
      })
      llmPicks = parsed.picks.filter((p) => !exclude.has(p.id))
      summary = parsed.summary
    } catch (error) {
      llmFailed = true
      console.warn('[recommend] LLM 推荐失败，改用规则：', (error as Error).message)
    }
  }

  const rest = remainingSlots(slots, llmPicks, pool)
  const ruled = rulePick({
    dishes: pool,
    slots: rest,
    pantry,
    recentIds: recent.map((r) => r.id),
    excludeIds: [...exclude, ...llmPicks.map((p) => p.id)],
    date: input.meal.date,
  }).map((p) => ({ id: p.id, reason: reasonText(p.reasons, input.locale) }))

  const picks = [...llmPicks, ...ruled]
  return {
    picks,
    summary,
    source: llmPicks.length > 0 ? 'llm' : 'rules',
    seasonLabel: label,
    llmFailed,
  }
}
