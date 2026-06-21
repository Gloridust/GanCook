/**
 * 干饭厨子 数据库结构（Drizzle ORM / SQLite）
 *
 * 设计要点（相对原 mycook 的改造）：
 * - 去掉 users.role：一账号多角色，做饭人按「每一餐」在 meals.cookId 上认领
 * - 菜品图片只存文件路径（imagePath），不再用 base64
 * - 新增 mealSchedules（自动饭局规则）与 settings（家庭配置）
 * - 单实例单家庭：无需 household 表
 */
import { sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  unique,
  index,
} from 'drizzle-orm/sqlite-core'

const now = sql`(unixepoch())`

/** 时间统一用 unix 秒（integer），便于排序与 dayjs 转换 */

// ── 用户（家庭成员） ──
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  avatarPath: text('avatar_path'),
  // 首位注册者 = 管理员
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(now),
})

// ── 菜品库 ──
export const dishes = sqliteTable(
  'dishes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    // 图片相对路径，如 dishes/<uuid>.webp（落盘存储，非 base64）
    imagePath: text('image_path'),
    // 标签：荤/素/汤/主食 等，JSON 数组存储
    tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
    status: text('status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('idx_dishes_status').on(t.status)],
)

// ── 饭局（一餐） ──
export const meals = sqliteTable(
  'meals',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title'),
    mealType: text('meal_type', {
      enum: ['breakfast', 'lunch', 'dinner'],
    }).notNull(),
    // 日期 YYYY-MM-DD（家庭时区下的自然日，用于唯一约束与展示）
    date: text('date').notNull(),
    diningTime: integer('dining_time').notNull(),
    orderDeadline: integer('order_deadline').notNull(),
    // 做饭人：按每一餐认领，可空
    cookId: text('cook_id').references(() => users.id, { onDelete: 'set null' }),
    status: text('status', {
      enum: ['ordering', 'cooking', 'done', 'cancelled'],
    })
      .notNull()
      .default('ordering'),
    // 是否由调度器自动创建
    isAuto: integer('is_auto', { mode: 'boolean' }).notNull().default(false),
    // 来源规则（自动创建时记录，用于幂等；规则删除后置空）
    scheduleId: text('schedule_id').references(() => mealSchedules.id, {
      onDelete: 'set null',
    }),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    index('idx_meals_status').on(t.status),
    index('idx_meals_date').on(t.date),
    index('idx_meals_schedule').on(t.scheduleId),
  ],
)

// ── 点菜记录（谁点了什么） ──
export const orders = sqliteTable(
  'orders',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mealId: text('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    dishId: text('dish_id')
      .notNull()
      .references(() => dishes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    note: text('note'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    unique('uniq_order').on(t.mealId, t.dishId, t.userId),
    index('idx_orders_meal').on(t.mealId),
    index('idx_orders_user').on(t.userId),
  ],
)

// ── 餐后评价（轻量） ──
export const reviews = sqliteTable(
  'reviews',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mealId: text('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    unique('uniq_review').on(t.mealId, t.userId),
    index('idx_reviews_meal').on(t.mealId),
  ],
)

// ── 自动饭局规则（管理员配置） ──
export const mealSchedules = sqliteTable('meal_schedules', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // 规则名称（像闹钟标签，如「工作日午餐」「周末早午餐」）
  name: text('name').notNull().default('饭局'),
  mealType: text('meal_type', {
    enum: ['breakfast', 'lunch', 'dinner'],
  }).notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  // 用餐时间 HH:MM（家庭时区）
  diningTime: text('dining_time').notNull(),
  // 提前多少小时创建点菜（如 16 = 前一天 20:00 开次日 12:00 的午餐）
  createLeadHours: integer('create_lead_hours').notNull().default(16),
  // 点菜截止早于用餐多少分钟
  deadlineLeadMinutes: integer('deadline_lead_minutes').notNull().default(120),
  // 生效星期：0(周日)..6，JSON 数组
  weekdays: text('weekdays', { mode: 'json' })
    .$type<number[]>()
    .notNull()
    .default([0, 1, 2, 3, 4, 5, 6]),
  createdAt: integer('created_at').notNull().default(now),
})

// ── 家庭设置（键值表，单家庭） ──
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
})

// 类型导出
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Dish = typeof dishes.$inferSelect
export type NewDish = typeof dishes.$inferInsert
export type Meal = typeof meals.$inferSelect
export type NewMeal = typeof meals.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type Review = typeof reviews.$inferSelect
export type NewReview = typeof reviews.$inferInsert
export type MealSchedule = typeof mealSchedules.$inferSelect
export type NewMealSchedule = typeof mealSchedules.$inferInsert
