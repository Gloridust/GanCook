import { join } from 'node:path'

/** 数据目录：SQLite 与上传文件的根（Docker 中为 /data） */
export const DATA_DIR = process.env.DATA_DIR
  ? process.env.DATA_DIR
  : join(process.cwd(), 'data')

export const DB_PATH = join(DATA_DIR, 'app.db')
export const UPLOAD_DIR = join(DATA_DIR, 'uploads')

export const AUTH_SECRET =
  process.env.AUTH_SECRET || 'insecure-dev-secret-change-me'

export const CRON_SECRET = process.env.CRON_SECRET || ''

export const TIMEZONE = process.env.TZ || 'Asia/Shanghai'
