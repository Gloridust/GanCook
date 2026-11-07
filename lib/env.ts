import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

/** 数据目录：SQLite 与上传文件的根（Docker 中为 /data） */
export const DATA_DIR = process.env.DATA_DIR
  ? process.env.DATA_DIR
  : join(process.cwd(), 'data')

export const DB_PATH = join(DATA_DIR, 'app.db')
export const UPLOAD_DIR = join(DATA_DIR, 'uploads')

/**
 * 读取或首次生成并持久化一个密钥（DATA_DIR/<name>.secret）。
 * Docker 入口脚本已经会做这件事；这里兜底「非 Docker / 自定义入口」的部署，
 * 绝不回退到写死的公开默认值（否则任何人都能伪造登录态）。
 */
function persistentSecret(envValue: string | undefined, name: string): string {
  if (envValue) return envValue
  const file = join(DATA_DIR, `${name}.secret`)
  try {
    const existing = readFileSync(file, 'utf8').trim()
    if (existing) return existing
  } catch {
    // 文件不存在，下面生成
  }
  const value = randomBytes(32).toString('base64url')
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    // wx：多个进程/模块同时首启时只有一个能写成功，其余读取它写下的值
    writeFileSync(file, value, { flag: 'wx', mode: 0o600 })
    return value
  } catch {
    try {
      const existing = readFileSync(file, 'utf8').trim()
      if (existing) return existing
    } catch {
      // 数据目录不可写：仅本进程有效（重启后需重新登录）
    }
    console.warn(`[env] 无法持久化 ${file}，本次使用临时密钥（重启后需重新登录）`)
    return value
  }
}

export const AUTH_SECRET = persistentSecret(process.env.AUTH_SECRET, 'auth')

export const CRON_SECRET = persistentSecret(process.env.CRON_SECRET, 'cron')

export const TIMEZONE = process.env.TZ || 'Asia/Shanghai'
