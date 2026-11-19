import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { getT } from '@/lib/i18n/server'
import { listPantry } from '@/lib/services/pantry'
import { todayLocal } from '@/lib/time'
import { PageHeader } from '@/components/page-header'
import { PantryBoard } from '@/components/pantry/pantry-board'

export const dynamic = 'force-dynamic'

export default async function PantryPage() {
  await requireUser()
  const t = await getT()
  const items = listPantry()
  const today = todayLocal(getSettings().timezone)

  return (
    <>
      <div className="mb-4">
        <Link href="/dishes" className="-ml-1 inline-flex items-center text-secondary">
          <ChevronLeft className="h-5 w-5" />
          {t('nav.dishes')}
        </Link>
      </div>
      <PageHeader
        title={t('pantry.title')}
        subtitle={items.length > 0 ? t('pantry.count', { n: items.length }) : t('pantry.sub')}
      />
      <PantryBoard items={items} today={today} />
    </>
  )
}
