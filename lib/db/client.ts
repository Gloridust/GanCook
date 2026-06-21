import 'server-only'
import { mkdirSync } from 'node:fs'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { DATA_DIR, DB_PATH } from '@/lib/env'
import * as schema from './schema'

// 单例：避免开发热重载下重复打开数据库连接
const globalForDb = globalThis as unknown as {
  __sqlite?: Database.Database
}

function createConnection() {
  mkdirSync(DATA_DIR, { recursive: true })
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  return sqlite
}

const sqlite = globalForDb.__sqlite ?? createConnection()
if (process.env.NODE_ENV !== 'production') globalForDb.__sqlite = sqlite

export const db = drizzle(sqlite, { schema })
export { schema }
