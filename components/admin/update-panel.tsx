'use client'

import { useEffect, useState, useTransition } from 'react'
import { RefreshCw, Download, CheckCircle2, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/components/i18n-provider'
import { checkUpdate, runUpdate } from '@/lib/actions/update'

type Cap = { canUpdate: boolean; reason?: 'no-socket' | 'permission' | 'unreachable' }
type Check =
  | { ok: true; current: string; latest: string | null; hasUpdate: boolean; isDev: boolean }
  | { ok: false; error: string }

export function UpdatePanel({
  current,
  capability,
  imageRepo,
}: {
  current: string
  capability: Cap
  imageRepo: string
}) {
  const t = useT()
  const [check, setCheck] = useState<Check | null>(null)
  const [checking, startCheck] = useTransition()
  const [updating, startUpdate] = useTransition()
  const [done, setDone] = useState(false)
  const [failMsg, setFailMsg] = useState('')

  const doCheck = () => startCheck(async () => setCheck(await checkUpdate()))
  // 进入页面自动查一次
  useEffect(() => {
    doCheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doUpdate = () =>
    startUpdate(async () => {
      setFailMsg('')
      const res = await runUpdate()
      if (res.ok) setDone(true)
      else {
        const reason =
          'reason' in res && res.reason !== 'error'
            ? t(`update.reason.${res.reason}`)
            : ('detail' in res && res.detail) || ''
        setFailMsg(t('update.failed', { r: reason }))
      }
    })

  const hasUpdate = check?.ok && check.hasUpdate

  let statusLine = ''
  if (checking) statusLine = t('update.checking')
  else if (check?.ok) {
    if (check.hasUpdate) statusLine = t('update.available', { v: check.latest! })
    else if (check.isDev && check.latest) statusLine = t('update.dev', { v: check.latest })
    else if (!check.latest) statusLine = t('update.noTags')
    else statusLine = t('update.upToDate')
  } else if (check && !check.ok) statusLine = t('update.checkFailed')

  return (
    <div className="mf-raised space-y-4 p-4">
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-[15px] font-medium text-ink">{t('update.current')}</p>
          <p className="mt-0.5 font-mono text-sm text-secondary">{current}</p>
        </div>
        {check?.ok && !check.hasUpdate && !check.isDev && check.latest && (
          <Badge tone="accent">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('update.upToDate')}
          </Badge>
        )}
        {hasUpdate && <Badge tone="warn">{check!.ok && check.latest}</Badge>}
      </div>

      <div className="relative flex items-center gap-3">
        <Button variant="trough" size="sm" loading={checking} onClick={doCheck}>
          <RefreshCw className="h-4 w-4" />
          {t('update.check')}
        </Button>
        <span className="text-sm text-secondary">{statusLine}</span>
      </div>

      {/* 一键更新（具备能力即可；已是最新时点击为空操作，无副作用） */}
      {capability.canUpdate && !done && (
        <Button
          className="relative w-full"
          size="lg"
          variant={hasUpdate ? 'primary' : 'secondary'}
          loading={updating}
          onClick={doUpdate}
        >
          <Download className="h-5 w-5" />
          {updating ? t('update.updating') : t('update.now')}
        </Button>
      )}
      {done && (
        <p className="relative rounded-2xl mf-inset p-3 text-center text-sm text-accent">
          {t('update.started')}
        </p>
      )}
      {failMsg && <p className="relative text-sm text-danger">{failMsg}</p>}

      {/* 兜底：无一键更新能力 → 手动指引 */}
      {!capability.canUpdate && (
        <div className="relative space-y-2 border-t border-black/[0.04] pt-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <Terminal className="h-4 w-4" />
            {t('update.manualTitle')}
            {capability.reason && (
              <span className="text-xs font-normal text-secondary">
                · {t(`update.reason.${capability.reason}`)}
              </span>
            )}
          </p>
          <p className="text-xs text-secondary">{t('update.manualHint')}</p>
          <pre className="overflow-x-auto rounded-xl mf-inset p-3 text-xs leading-relaxed text-ink">
            <code>{`docker compose pull && docker compose up -d
# docker run 部署：
docker pull ${imageRepo}:latest  # 然后重建容器`}</code>
          </pre>
          <p className="text-xs text-secondary">{t('update.enableHint')}</p>
        </div>
      )}
    </div>
  )
}
