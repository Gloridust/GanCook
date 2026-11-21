import Database from 'better-sqlite3'

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * 打开 SQLite 并切到 WAL。
 *
 * next build 会开十几个 worker 同时打开同一个新库；切换 WAL 需要独占锁，
 * 而 SQLite 在可能死锁的锁升级上不走 busy handler、直接返回 SQLITE_BUSY，
 * 所以这里遇 BUSY 自行重试（Docker 构建里尤其容易撞上）。
 */
export function openDatabase(path: string): Database.Database {
  const sqlite = new Database(path, { timeout: 5000 })
  for (let attempt = 0; ; attempt++) {
    try {
      sqlite.pragma('journal_mode = WAL')
      break
    } catch (error) {
      if ((error as { code?: string }).code !== 'SQLITE_BUSY' || attempt >= 50) {
        sqlite.close()
        throw error
      }
      sleepSync(50 + Math.floor(Math.random() * 100))
    }
  }
  sqlite.pragma('foreign_keys = ON')
  return sqlite
}
