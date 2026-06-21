import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { DATA_DIR, DB_PATH } from '../env'

/**
 * 应用数据库迁移（建表 / 升级）。
 * 在服务启动时（instrumentation）以及本地 npm run db:migrate 中调用。
 * 使用独立连接，迁移完成即关闭。
 */
export function runMigrations() {
  mkdirSync(DATA_DIR, { recursive: true })
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite)
  migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') })
  sqlite.close()
  console.log('[migrate] 数据库已就绪 →', DB_PATH)
}
