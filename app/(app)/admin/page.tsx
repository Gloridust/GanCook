import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireAdmin, listMembers } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { db } from '@/lib/db/client'
import { mealSchedules } from '@/lib/db/schema'
import { PageHeader } from '@/components/page-header'
import { getT } from '@/lib/i18n/server'
import { FamilySettings } from '@/components/admin/family-settings'
import { ScheduleEditor } from '@/components/admin/schedule-editor'
import { MembersManager } from '@/components/admin/members-manager'
import { RunSchedule } from '@/components/admin/run-schedule'
import { UpdatePanel } from '@/components/admin/update-panel'
import { APP_VERSION, IMAGE_REPO } from '@/lib/version'
import { updateCapability } from '@/lib/update'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const me = await requireAdmin()
  const t = await getT()
  const s = getSettings()
  const capability = await updateCapability()
  const schedules = db
    .select()
    .from(mealSchedules)
    .all()
    .sort((a, b) => a.createdAt - b.createdAt)
  const members = listMembers().map((m) => ({
    id: m.id,
    name: m.name,
    avatarPath: m.avatarPath,
    isAdmin: m.isAdmin,
  }))

  return (
    <>
      <div className="mb-4">
        <Link href="/me" className="-ml-1 inline-flex items-center text-secondary">
          <ChevronLeft className="h-5 w-5" />
          {t('me.title')}
        </Link>
      </div>
      <PageHeader title={t('admin.title')} />

      <section className="mb-7">
        <h2 className="mb-3 text-base font-semibold text-ink">
          {t('admin.family')}
        </h2>
        <FamilySettings
          familyName={s.familyName}
          registrationOpen={s.registrationOpen}
          joinCode={s.joinCode}
        />
      </section>

      <section className="mb-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">
            {t('admin.autoMeals')}
          </h2>
        </div>
        <p className="mb-3 text-sm text-secondary">{t('admin.autoMealsDesc')}</p>
        <ScheduleEditor schedules={schedules} />
        <div className="mt-3">
          <RunSchedule />
        </div>
      </section>

      <section className="mb-7">
        <h2 className="mb-3 text-base font-semibold text-ink">
          {t('admin.members', { n: members.length })}
        </h2>
        <MembersManager members={members} meId={me.id} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">
          {t('update.title')}
        </h2>
        <UpdatePanel
          current={APP_VERSION}
          capability={capability}
          imageRepo={IMAGE_REPO}
        />
      </section>
    </>
  )
}
