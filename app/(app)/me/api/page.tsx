import Link from 'next/link'
import { headers } from 'next/headers'
import { ChevronLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import { listTokens } from '@/lib/api/tokens'
import { getSettings } from '@/lib/settings'
import { dayjs } from '@/lib/time'
import { PageHeader } from '@/components/page-header'
import { ApiTokens } from '@/components/me/api-tokens'

export const dynamic = 'force-dynamic'

export default async function ApiPage() {
  const me = await requireUser()
  const t = await getT()
  const tz = getSettings().timezone
  const h = await headers()
  const host = h.get('x-forwarded-host')?.split(',')[0]?.trim() || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http'

  return (
    <>
      <div className="mb-4">
        <Link href="/me" className="-ml-1 inline-flex items-center text-secondary">
          <ChevronLeft className="h-5 w-5" />
          {t('me.title')}
        </Link>
      </div>
      <PageHeader title={t('api.title')} subtitle={t('api.sub')} />
      <ApiTokens
        tokens={listTokens(me.id).map((tk) => ({
          id: tk.id,
          name: tk.name,
          prefix: tk.prefix,
          // 服务端按家庭时区格式化，避免水合时浏览器时区不同导致不一致
          lastUsed: tk.lastUsedAt ? dayjs.unix(tk.lastUsedAt).tz(tz).format('M/D HH:mm') : null,
        }))}
        origin={`${proto}://${host}`}
      />
    </>
  )
}
