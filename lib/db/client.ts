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

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function createConnection() {
  mkdirSync(DATA_DIR, { recursive: true })
  // 先设忙等待，再切 WAL：next build 会开十几个 worker 同时打开同一个新库，
  // 切换 WAL 需要独占锁，先到的拿锁，其余会瞬时 SQLITE_BUSY（Docker 构建里尤其容易撞上）
  const sqlite = new Database(DB_PATH, { timeout: 5000 })
  for (let attempt = 0; ; attempt++) {
    try {
      sqlite.pragma('journal_mode = WAL')
      break
    } catch (error) {
      if ((error as { code?: string }).code !== 'SQLITE_BUSY' || attempt >= 50) throw error
      sleepSync(100)
    }
  }
  sqlite.pragma('foreign_keys = ON')
  return sqlite
}

const sqlite = globalForDb.__sqlite ?? createConnection()
if (process.env.NODE_ENV !== 'production') globalForDb.__sqlite = sqlite

export const db = drizzle(sqlite, { schema })
export { schema }
