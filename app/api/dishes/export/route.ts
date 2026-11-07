import { getCurrentUser } from '@/lib/auth/user'
import { buildMenuExport } from '@/lib/menu-transfer'
import { todayLocal } from '@/lib/time'
import { getSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

/** 导出整个菜单（含图片）为 zip，可分享给亲友或导入另一台 GanCook */
export async function GET() {
  const me = await getCurrentUser()
  if (!me) return new Response('unauthorized', { status: 401 })

  const { zip } = await buildMenuExport()
  const s = getSettings()
  const filename = `gancook-menu-${todayLocal(s.timezone)}.zip`
  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
