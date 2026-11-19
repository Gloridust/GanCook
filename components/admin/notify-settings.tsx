'use client'

import { useState, useTransition } from 'react'
import { Bell, BellOff, Plus, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { List, Row } from '@/components/ui/list'
import { IconChip } from '@/components/ui/icon-chip'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useT } from '@/components/i18n-provider'
import {
  deleteNotifyChannel,
  saveNotifyChannel,
  testNotifyChannel,
  updateNotifyConfig,
} from '@/lib/actions/notify'
import {
  NOTIFY_CHANNEL_TYPES,
  NOTIFY_EVENTS,
  type NotifyChannelType,
  type NotifyEvent,
} from '@/lib/notify/events'
import type { NotifyChannel } from '@/lib/db/schema'

const URL_PH: Record<NotifyChannelType, string> = {
  wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…',
  feishu: 'https://open.feishu.cn/open-apis/bot/v2/hook/…',
  dingtalk: 'https://oapi.dingtalk.com/robot/send?access_token=…',
  bark: 'https://api.day.app/<key>',
  webhook: 'https://example.com/gancook-hook',
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-none rounded-full px-3 py-1.5 text-sm ${
        active ? 'bg-tint font-medium text-accent' : 'bg-trough text-secondary'
      }`}
    >
      {children}
    </button>
  )
}

function ChannelDialog({
  channel,
  onClose,
}: {
  channel: NotifyChannel | null
  onClose: () => void
}) {
  const t = useT()
  const [type, setType] = useState<NotifyChannelType>(channel?.type ?? 'wecom')
  const [name, setName] = useState(channel?.name ?? '')
  const [url, setUrl] = useState(channel?.url ?? '')
  const [enabled, setEnabled] = useState(channel?.enabled ?? true)
  const [events, setEvents] = useState<NotifyEvent[]>(channel?.events ?? [...NOTIFY_EVENTS])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, startSaving] = useTransition()
  const [testing, startTesting] = useTransition()
  const [deleting, startDeleting] = useTransition()

  const toggleEvent = (e: NotifyEvent) =>
    setEvents((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]))

  const save = () =>
    startSaving(async () => {
      const res = await saveNotifyChannel(channel?.id ?? null, {
        name: name.trim() || t(`notify.type.${type}`),
        type,
        url,
        enabled,
        events,
      })
      if (res.ok) onClose()
      else setMsg({ ok: false, text: res.error })
    })

  const test = () =>
    startTesting(async () => {
      setMsg(null)
      const res = await testNotifyChannel({ type, url })
      setMsg(res.ok ? { ok: true, text: t('notify.testSent') } : { ok: false, text: res.error })
    })

  const remove = () =>
    startDeleting(async () => {
      if (!channel) return
      const res = await deleteNotifyChannel(channel.id)
      if (res.ok) onClose()
      else setMsg({ ok: false, text: res.error })
    })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={channel ? t('notify.editChannel') : t('notify.addChannel')}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <div className="space-y-4">
          <div>
            <Label>{t('notify.type')}</Label>
            <div className="mf-rail -mx-5 px-5">
              {NOTIFY_CHANNEL_TYPES.map((x) => (
                <Chip key={x} active={type === x} onClick={() => setType(x)}>
                  {t(`notify.type.${x}`)}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-secondary">{t(`notify.hint.${type}`)}</p>
          </div>

          <div>
            <Label htmlFor="notify-url">{t('notify.url')}</Label>
            <Input
              id="notify-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={URL_PH[type]}
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          <div>
            <Label htmlFor="notify-name">{t('notify.name')}</Label>
            <Input
              id="notify-name"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('notify.namePh')}
            />
          </div>

          <div>
            <Label>{t('notify.events')}</Label>
            <div className="flex flex-wrap gap-2">
              {NOTIFY_EVENTS.map((e) => (
                <Chip key={e} active={events.includes(e)} onClick={() => toggleEvent(e)}>
                  {t(`notify.event.${e}`)}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[15px] text-ink">{t('notify.enabled')}</p>
            <Switch checked={enabled} onChange={setEnabled} />
          </div>

          {msg && (
            <p className={`text-sm ${msg.ok ? 'text-accent' : 'text-danger'}`}>{msg.text}</p>
          )}

          <div className="flex gap-2">
            {channel && (
              <Button
                variant="secondary"
                size="icon"
                aria-label={t('common.delete')}
                loading={deleting}
                onClick={remove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="secondary" loading={testing} disabled={!url} onClick={test}>
              <Send className="h-4 w-4" />
              {t('notify.test')}
            </Button>
            <Button className="flex-1" loading={saving} disabled={!url} onClick={save}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function NotifySettings({
  channels,
  config,
}: {
  channels: NotifyChannel[]
  config: { baseUrl: string; deadlineMinutes: number; locale: 'zh' | 'en' }
}) {
  const t = useT()
  const [editing, setEditing] = useState<NotifyChannel | 'new' | null>(null)
  const [baseUrl, setBaseUrl] = useState(config.baseUrl)
  const [minutes, setMinutes] = useState(String(config.deadlineMinutes))
  const [locale, setLocale] = useState(config.locale)
  const [msg, setMsg] = useState('')
  const [saving, startSaving] = useTransition()

  const saveConfig = () =>
    startSaving(async () => {
      setMsg('')
      const res = await updateNotifyConfig({
        baseUrl,
        deadlineMinutes: Math.round(Number(minutes) || 30),
        locale,
      })
      setMsg(res.ok ? t('common.saved') : res.error)
    })

  return (
    <div className="space-y-3">
      {channels.length > 0 && (
        <List>
          {channels.map((c) => (
            <Row
              key={c.id}
              onClick={() => setEditing(c)}
              leading={
                <IconChip tone={c.enabled ? 'accent' : 'neutral'}>
                  {c.enabled ? <Bell /> : <BellOff />}
                </IconChip>
              }
              title={c.name}
              subtitle={[
                t(`notify.type.${c.type}`),
                c.events.map((e) => t(`notify.event.${e}`)).join(t('common.listSep')) ||
                  t('notify.noEvents'),
              ].join(' · ')}
            />
          ))}
        </List>
      )}
      <Button variant="tonal" size="sm" onClick={() => setEditing('new')}>
        <Plus className="h-4 w-4" />
        {t('notify.addChannel')}
      </Button>

      <div className="mf-raised space-y-4 p-4">
        <div>
          <Label htmlFor="notify-base">{t('notify.baseUrl')}</Label>
          <Input
            id="notify-base"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://cook.example.com"
            autoCapitalize="none"
            spellCheck={false}
          />
          <p className="mt-1.5 text-xs text-secondary">{t('notify.baseUrlDesc')}</p>
        </div>
        <div>
          <Label htmlFor="notify-minutes">{t('notify.deadlineMinutes')}</Label>
          <Input
            id="notify-minutes"
            inputMode="numeric"
            className="w-28"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div>
          <Label>{t('notify.locale')}</Label>
          <Segmented
            value={locale}
            onChange={setLocale}
            layoutId="notify-locale"
            options={[
              { value: 'zh', label: '中文' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button loading={saving} onClick={saveConfig}>
            {t('admin.saveSettings')}
          </Button>
          {msg && <span className="text-sm text-accent">{msg}</span>}
        </div>
      </div>

      {editing && (
        <ChannelDialog
          key={editing === 'new' ? 'new' : editing.id}
          channel={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
