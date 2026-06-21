import { NextResponse } from 'next/server'
import { tick } from '@/lib/scheduler'
import { CRON_SECRET } from '@/lib/env'

/**
 * 手动触发调度心跳。
 * - 若配置了 CRON_SECRET：必须带 ?secret=... 或 Authorization: Bearer ...
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
