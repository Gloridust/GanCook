import 'server-only'

/**
 * 登录防爆破（进程内存，单实例够用）。
 * 6 位 PIN 只有 100 万种组合，NAS 经反代暴露到公网时必须限速：
 * 同一账号连续输错 5 次后开始冷却，冷却时间指数增长（30s → 1m → 2m … 封顶 15 分钟），
 * 登录成功即清零。按账号而非 IP 计数——反代后的 IP 不可信、也容易换。
 */
const FREE_ATTEMPTS = 5
const BASE_LOCK_SEC = 30
const MAX_LOCK_SEC = 15 * 60

type Entry = { fails: number; lockedUntil: number }

const g = globalThis as unknown as { __gancookLoginRL?: Map<string, Entry> }
const store = (g.__gancookLoginRL ??= new Map())

const key = (name: string) => name.trim().toLowerCase()

/** 还需等待的秒数；0 表示可以尝试 */
export function loginRetryAfter(name: string): number {
  const e = store.get(key(name))
  if (!e) return 0
  const left = Math.ceil((e.lockedUntil - Date.now()) / 1000)
  return left > 0 ? left : 0
}

export function recordLoginFailure(name: string): void {
  const k = key(name)
  const e = store.get(k) ?? { fails: 0, lockedUntil: 0 }
  e.fails += 1
  if (e.fails >= FREE_ATTEMPTS) {
    const lock = Math.min(
      BASE_LOCK_SEC * 2 ** (e.fails - FREE_ATTEMPTS),
      MAX_LOCK_SEC,
    )
    e.lockedUntil = Date.now() + lock * 1000
  }
  store.set(k, e)
  // 防止被无限新账号名撑爆内存
  if (store.size > 1000) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
}

export function clearLoginFailures(name: string): void {
  store.delete(key(name))
}
