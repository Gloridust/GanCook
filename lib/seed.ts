import 'server-only'
import { db } from '@/lib/db/client'
import { mealSchedules } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

/** 首次初始化时写入默认自动饭局规则（午餐、晚餐；早餐默认关闭） */
export function seedDefaultSchedules(): void {
  const existing = db
    .select({ c: sql<number>`count(*)` })
    .from(mealSchedules)
    .get()
  if ((existing?.c ?? 0) > 0) return

  db.insert(mealSchedules)
    .values([
      {
        name: '每日午餐',
        mealType: 'lunch',
        enabled: true,
        diningTime: '12:00',
        createLeadHours: 16, // 前一天 20:00 开次日午餐
        deadlineLeadMinutes: 120, // 10:00 截止
        weekdays: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        name: '每日晚餐',
        mealType: 'dinner',
        enabled: true,
        diningTime: '18:30',
        createLeadHours: 10, // 当天 08:30 开
        deadlineLeadMinutes: 150, // 16:00 截止
        weekdays: [0, 1, 2, 3, 4, 5, 6],
      },
    ])
    .run()
}
