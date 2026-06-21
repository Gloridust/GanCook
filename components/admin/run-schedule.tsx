'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { runScheduleNow } from '@/lib/actions/admin'

export function RunSchedule() {
  const router = useRouter()
  const t = useT()
  const [msg, setMsg] = useState('')
  const [pending, startTransition] = useTransition()

  const run = () => {
    setMsg('')
    startTransition(async () => {
      const res = await runScheduleNow()
      if (res.ok) {
        setMsg(
          t('admin.runResult', {
            c: res.created,
            s: res.started,
            f: res.finished,
          }),
        )
        router.refresh()
      } else {
        setMsg(res.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="trough" size="sm" loading={pending} onClick={run}>
        <RefreshCw className="h-4 w-4" />
        {t('admin.runNow')}
      </Button>
      {msg && <span className="text-sm text-secondary">{msg}</span>}
    </div>
  )
}
