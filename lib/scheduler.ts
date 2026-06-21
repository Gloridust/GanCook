import 'server-only'
import { and, eq, lte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { meals, mealSchedules } from '@/lib/db/schema'
import { getSettings } from '@/lib/settings'
import { dayjs, localDateTimeToSec, nowSec } from '@/lib/time'

// 用餐时间过后多久自动标记「已完成」
const DONE_AFTER_SEC = 4 * 3600

export type TickResult = {
  created: number
  started: number
  finished: number
}

/**
 * 调度心跳：幂等创建到点的自动饭局 + 自动流转状态。
 * 可被进程内 cron 调用，也可被 /api/cron/tick 手动触发。
 */
export function tick(): TickResult {
  const tz = getSettings().timezone
  const now = nowSec()
  let created = 0

  // 1) 按规则创建到点的饭局
  const schedules = db
    .select()
    .from(mealSchedules)
    .where(eq(mealSchedules.enabled, true))
    .all()

  for (const s of schedules) {
    // 检查未来 3 天内的候选日期（覆盖较大的提前量）
    for (let offset = 0; offset <= 2; offset++) {
      const day = dayjs().tz(tz).add(offset, 'day')
      const date = day.format('YYYY-MM-DD')
      if (!s.weekdays.includes(day.day())) continue

      const diningSec = localDateTimeToSec(date, s.diningTime, tz)
      const createSec = diningSec - s.createLeadHours * 3600
      // 到了创建时刻、且用餐时间还没过
      if (now < createSec || now >= diningSec) continue

      const deadlineSec = diningSec - s.deadlineLeadMinutes * 60

      // 幂等：同一规则同一天只建一次
      const exists = db
        .select({ id: meals.id })
        .from(meals)
        .where(and(eq(meals.scheduleId, s.id), eq(meals.date, date)))
        .get()
      if (exists) continue

      db.insert(meals)
        .values({
          title: s.name,
          mealType: s.mealType,
          date,
          diningTime: diningSec,
          orderDeadline: deadlineSec,
          status: 'ordering',
          isAuto: true,
          scheduleId: s.id,
        })
        .run()
      created++
    }
  }

  // 2) 点菜截止 → 做饭中
  const started = db
    .update(meals)
    .set({ status: 'cooking' })
    .where(
      and(eq(meals.status, 'ordering'), lte(meals.orderDeadline, now)),
    )
    .run().changes

  // 3) 用餐结束 → 已完成（含错过截止仍在 ordering 的）
  const finished = db
    .update(meals)
    .set({ status: 'done' })
    .where(
      and(
        inArray(meals.status, ['ordering', 'cooking']),
        lte(meals.diningTime, now - DONE_AFTER_SEC),
      ),
    )
    .run().changes

  return { created, started, finished }
}

// 进程内 cron 只启动一次
const g = globalThis as unknown as { __gancookCron?: boolean }

export async function startScheduler() {
  if (g.__gancookCron) return
  g.__gancookCron = true
  const cron = (await import('node-cron')).default
  // 每 5 分钟一次
  cron.schedule('*/5 * * * *', () => {
    try {
      const r = tick()
      if (r.created || r.started || r.finished)
        console.log('[scheduler]', r)
    } catch (e) {
      console.error('[scheduler] tick failed', e)
    }
  })
  // 启动时先跑一次，补齐停机期间错过的饭局
  try {
    tick()
  } catch (e) {
    console.error('[scheduler] initial tick failed', e)
  }
  console.log('[scheduler] 已启动（每 5 分钟检查一次）')
}
