'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, KeyRound, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { List, Row } from '@/components/ui/list'
import { IconChip } from '@/components/ui/icon-chip'
import { useT } from '@/components/i18n-provider'
import { createApiToken, deleteApiToken } from '@/lib/actions/api-tokens'
import { dayjs } from '@/lib/time'

type TokenRow = {
  id: string
  name: string
  prefix: string
  lastUsedAt: number | null
  createdAt: number
}

function CopyButton({ text }: { text: string }) {
  const t = useT()
  const [done, setDone] = useState(false)
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          // 非 HTTPS 下剪贴板不可用：用户可手动长按复制
        }
      }}
    >
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {done ? t('api.copied') : t('api.copy')}
    </Button>
  )
}

export function ApiTokens({ tokens, origin }: { tokens: TokenRow[]; origin: string }) {
  const t = useT()
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [creating, startCreating] = useTransition()
  const [, startDeleting] = useTransition()

  const create = () =>
    startCreating(async () => {
      setError('')
      const res = await createApiToken(name || t('api.defaultName'))
      if (res.ok) {
        setFresh(res.token)
        setName('')
      } else setError(res.error)
    })

  const example = `curl -H "Authorization: Bearer ${fresh ?? 'gck_…'}" ${origin}/api/v1/dishes`

  return (
    <div className="space-y-5">
      <div className="mf-raised space-y-3 p-4">
        <div className="flex gap-2">
          <Input
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('api.namePh')}
            aria-label={t('api.name')}
          />
          <Button loading={creating} onClick={create}>
            {t('api.create')}
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {fresh && (
          <div className="space-y-2 rounded-2xl bg-tint p-3">
            <p className="text-sm font-semibold text-accent">{t('api.freshTitle')}</p>
            <code className="block break-all rounded-xl bg-surface px-3 py-2 text-[13px] text-ink">
              {fresh}
            </code>
            <CopyButton text={fresh} />
          </div>
        )}
      </div>

      {tokens.length > 0 && (
        <List>
          {tokens.map((tk) => (
            <Row
              key={tk.id}
              chevron={false}
              leading={
                <IconChip tone="neutral">
                  <KeyRound />
                </IconChip>
              }
              title={tk.name}
              subtitle={`${tk.prefix}… · ${
                tk.lastUsedAt
                  ? t('api.lastUsed', { time: dayjs.unix(tk.lastUsedAt).format('M/D HH:mm') })
                  : t('api.neverUsed')
              }`}
              trailing={
                <button
                  type="button"
                  aria-label={t('api.revoke')}
                  onClick={() => {
                    if (confirm(t('api.revokeConfirm', { name: tk.name })))
                      startDeleting(async () => {
                        await deleteApiToken(tk.id)
                      })
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-danger active:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              }
            />
          ))}
        </List>
      )}

      <div className="mf-inset space-y-2 rounded-2xl p-4 text-sm">
        <p className="font-semibold text-ink">{t('api.quickStart')}</p>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-surface px-3 py-2 text-[12px] leading-5 text-ink">
          {example}
        </pre>
        <p className="text-secondary">{t('api.endpoints')}</p>
        <ul className="space-y-0.5 font-mono text-[12px] text-secondary">
          <li>GET/POST /api/v1/dishes</li>
          <li>GET/PATCH/DELETE /api/v1/dishes/:id</li>
          <li>GET/POST /api/v1/meals</li>
          <li>GET /api/v1/meals/:id</li>
          <li>POST /api/v1/meals/:id/orders</li>
          <li>POST /api/v1/meals/:id/recommend</li>
          <li>GET/POST /api/v1/pantry · PATCH/DELETE /api/v1/pantry/:id</li>
          <li>GET /api/v1/me</li>
        </ul>
        <a
          href="https://github.com/Gloridust/GanCook/blob/main/doc/API.md"
          target="_blank"
          rel="noreferrer"
          className="inline-block font-medium text-accent"
        >
          {t('api.docs')} →
        </a>
      </div>
    </div>
  )
}
