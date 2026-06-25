import { Flame, ChefHat, UtensilsCrossed, Sprout } from 'lucide-react'
import { requireUser } from '@/lib/auth/user'
import { getContributions } from '@/lib/contributions'
import { getT } from '@/lib/i18n/server'
import { PageHeader } from '@/components/page-header'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { ContributionHeatmap } from '@/components/contribution-heatmap'

export const dynamic = 'force-dynamic'

export default async function WallPage() {
  await requireUser()
  const t = await getT()
  const { members, today, weeks } = getContributions()

  const hasAny = members.some((m) => m.cookTotal > 0 || m.orderTotal > 0)

  return (
    <>
      <PageHeader title={t('wall.title')} subtitle={t('wall.sub')} />

      {!hasAny ? (
        <EmptyState
          icon={<Sprout />}
          title={t('wall.emptyTitle')}
          description={t('wall.emptyDesc')}
        />
      ) : (
        <div className="space-y-4">
          {members.map((m) => (
            <div key={m.id} className="mf-raised p-4">
              <div className="relative flex items-center gap-3">
                <Avatar
                  name={m.name}
                  src={m.avatarPath ? `/api/uploads/${m.avatarPath}` : null}
                  size={42}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{m.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <ChefHat className="h-3.5 w-3.5 text-accent" />
                      {t('wall.cook', { n: m.cookTotal })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UtensilsCrossed className="h-3.5 w-3.5" />
                      {t('wall.order', { n: m.orderTotal })}
                    </span>
                    {m.streak > 0 && (
                      <span className="inline-flex items-center gap-1 text-[#c2410c]">
                        <Flame className="h-3.5 w-3.5" />
                        {t('wall.streak', { n: m.streak })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative mt-4 space-y-3">
                <ContributionHeatmap
                  data={m.cookByDate}
                  today={today}
                  weeks={weeks}
                  label={t('wall.cookLabel')}
                />
                <ContributionHeatmap
                  data={m.orderByDate}
                  today={today}
                  weeks={weeks}
                  label={t('wall.orderLabel')}
                />
              </div>
            </div>
          ))}

          {/* 图例 */}
          <div className="flex items-center justify-end gap-1.5 pr-1 text-xs text-secondary">
            <span>{t('wall.less')}</span>
            {[0, 0.42, 0.62, 0.82, 1].map((a, i) => (
              <span
                key={i}
                className="h-[11px] w-[11px] rounded-[3px]"
                style={{
                  background:
                    a === 0
                      ? 'var(--mf-trough)'
                      : `rgb(var(--mf-accent-soft) / ${a})`,
                }}
              />
            ))}
            <span>{t('wall.more')}</span>
          </div>
        </div>
      )}
    </>
  )
}
