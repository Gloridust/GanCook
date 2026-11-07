'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownToLine, ArrowUpFromLine, Ellipsis, Info } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { List, Row } from '@/components/ui/list'
import { useT } from '@/components/i18n-provider'

type ImportResponse =
  | { ok: true; created: number; skipped: number; imagesAdded: number; failedImages: number }
  | { ok: false; error: string }

/** 菜单导入 / 导出（分享菜单给亲友、批量建库、换设备迁移） */
export function MenuTransfer({ dishCount }: { dishCount: number }) {
  const t = useT()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(
    null,
  )

  const upload = async (file: File) => {
    setBusy(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch('/api/dishes/import', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as ImportResponse | null
      if (!data) throw new Error('bad response')
      if (!data.ok) {
        setMessage({ tone: 'error', text: data.error })
        return
      }
      const parts = [t('transfer.created', { n: data.created })]
      if (data.imagesAdded) parts.push(t('transfer.imagesAdded', { n: data.imagesAdded }))
      if (data.skipped) parts.push(t('transfer.skipped', { n: data.skipped }))
      if (data.failedImages) parts.push(t('transfer.failedImages', { n: data.failedImages }))
      setMessage({ tone: 'ok', text: parts.join(t('common.listSep')) })
      router.refresh()
    } catch {
      setMessage({ tone: 'error', text: t('err.importFailed') })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setMessage(null)
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t('transfer.title')}
          className="mf-outline flex h-9 w-9 items-center justify-center rounded-full text-secondary"
        >
          <Ellipsis className="h-[18px] w-[18px]" />
        </button>
      </DialogTrigger>
      <DialogContent title={t('transfer.title')}>
        <div className="space-y-4">
          <List>
            {dishCount > 0 && (
              <a
                href="/api/dishes/export"
                download
                className="mf-row mf-row-inset mf-row-press"
              >
                <span className="mf-chip">
                  <ArrowDownToLine className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-ink">
                    {t('transfer.export')}
                  </span>
                  <span className="mt-0.5 block text-xs text-secondary">
                    {t('transfer.exportSub', { n: dishCount })}
                  </span>
                </span>
              </a>
            )}
            <Row
              leading={
                <span className="mf-chip">
                  <ArrowUpFromLine className="h-[18px] w-[18px]" />
                </span>
              }
              title={busy ? t('transfer.importing') : t('transfer.import')}
              subtitle={t('transfer.importSub')}
              onClick={() => !busy && fileRef.current?.click()}
              chevron={false}
            />
          </List>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.json,.txt,.csv,application/zip,application/json,text/plain,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
            }}
          />

          {message && (
            <p
              role="status"
              className={
                message.tone === 'ok'
                  ? 'mf-tonal rounded-2xl px-4 py-3 text-sm text-accent'
                  : 'rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger'
              }
            >
              {message.text}
            </p>
          )}

          <div className="flex gap-2 rounded-2xl bg-trough/70 p-3.5 text-xs leading-5 text-secondary">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p>{t('transfer.help1')}</p>
              <p>{t('transfer.help2')}</p>
              <p>{t('transfer.help3')}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
