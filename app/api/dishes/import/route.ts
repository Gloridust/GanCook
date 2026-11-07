import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import {
  ImportError,
  MAX_IMPORT_BYTES,
  importDishes,
  parseImportFile,
} from '@/lib/menu-transfer'

export const dynamic = 'force-dynamic'

/**
 * 导入菜单。此路由不经过 proxy（proxy 会把请求体截断在 10MB），因此自行鉴权：
 * - 必须登录
 * - 拒绝浏览器标记为跨站的请求（Route Handler 没有 Server Actions 自带的来源校验）
 */
export async function POST(req: Request) {
  const t = await getT()
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none')
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 })

  const me = await getCurrentUser()
  if (!me)
    return Response.json({ ok: false, error: t('err.loginRequired') }, { status: 401 })

  const declared = Number(req.headers.get('content-length') || 0)
  if (declared > MAX_IMPORT_BYTES + 1024 * 1024)
    return Response.json({ ok: false, error: t('err.importTooLarge') }, { status: 413 })

  let file: File
  try {
    const form = await req.formData()
    const f = form.get('file')
    if (!(f instanceof File) || f.size === 0) throw new ImportError('EMPTY')
    file = f
  } catch {
    return Response.json({ ok: false, error: t('err.importBadFile') }, { status: 400 })
  }

  try {
    const list = parseImportFile(new Uint8Array(await file.arrayBuffer()), file.name)
    const result = await importDishes(list, me.id)
    revalidatePath('/dishes')
    return Response.json({ ok: true, ...result })
  } catch (e) {
    const code = e instanceof ImportError ? e.code : 'BAD_FILE'
    const error =
      code === 'TOO_LARGE'
        ? t('err.importTooLarge')
        : code === 'UNSUPPORTED'
          ? t('err.importUnsupported')
          : code === 'EMPTY'
            ? t('err.importEmpty')
            : t('err.importBadFile')
    if (!(e instanceof ImportError)) console.error('[menu-import] 失败', e)
    return Response.json({ ok: false, error }, { status: 400 })
  }
}
