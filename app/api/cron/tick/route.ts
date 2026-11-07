import { NextResponse } from 'next/server'
import { tick } from '@/lib/scheduler'
import { CRON_SECRET } from '@/lib/env'

/**
 * 手动触发调度心跳。
 * - 必须带 ?secret=<CRON_SECRET> 或 Authorization: Bearer <CRON_SECRET>
 *   （未配置时自动生成，见 data/cron.secret）
 * - 便于测试，也可让 NAS 用系统 cron 定时 curl 本端点
 */
export async function GET(req: Request) {
  if (CRON_SECRET) {
    const url = new URL(req.url)
    const provided =
      url.searchParams.get('secret') ||
      req.headers.get('authorization')?.replace('Bearer ', '')
    if (provided !== CRON_SECRET) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }
  const result = tick()
  return NextResponse.json({ ok: true, ...result })
}
