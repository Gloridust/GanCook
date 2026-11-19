'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { notifyChannels } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { setSettings, getSettings } from '@/lib/settings'
import { getT } from '@/lib/i18n/server'
import { NOTIFY_CHANNEL_TYPES, NOTIFY_EVENTS } from '@/lib/notify/events'
import { validChannelUrl } from '@/lib/notify/format'
import { sendToChannel } from '@/lib/notify/dispatch'
import { getNotifyConfig, NOTIFY_SETTING_KEYS } from '@/lib/notify/settings'
import { fmtTime, nowSec, todayLocal } from '@/lib/time'

export type ActionResult = { ok: true } | { ok: false; error: string }

async function guard(): Promise<ActionResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  if (!me.isAdmin) return { ok: false, error: t('err.adminRequired') }
  return { ok: true }
}

const channelSchema = z.object({
  name: z.string().trim().min(1).max(20),
  type: z.enum(NOTIFY_CHANNEL_TYPES),
  url: z.string().trim().min(1).max(1000),
  enabled: z.boolean(),
  events: z.array(z.enum(NOTIFY_EVENTS)).max(NOTIFY_EVENTS.length),
})

export type ChannelInput = z.infer<typeof channelSchema>

/** 新增或修改渠道（id 为空 = 新增） */
export async function saveNotifyChannel(
  id: string | null,
  input: ChannelInput,
): Promise<ActionResult> {
  const g = await guard()
  if (!g.ok) return g
  const t = await getT()
  const parsed = channelSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t('notify.err.invalid') }
  const url = validChannelUrl(parsed.data.url)
  if (!url) return { ok: false, error: t('notify.err.url') }
  const values = { ...parsed.data, url, events: [...new Set(parsed.data.events)] }
  if (id) db.update(notifyChannels).set(values).where(eq(notifyChannels.id, id)).run()
  else db.insert(notifyChannels).values(values).run()
  revalidatePath('/admin')
  return { ok: true }
}

export async function deleteNotifyChannel(id: string): Promise<ActionResult> {
  const g = await guard()
  if (!g.ok) return g
  db.delete(notifyChannels).where(eq(notifyChannels.id, id)).run()
  revalidatePath('/admin')
  return { ok: true }
}

/** 发一条测试消息（用当前表单里的类型和地址，不必先保存） */
export async function testNotifyChannel(input: {
  type: ChannelInput['type']
  url: string
}): Promise<ActionResult> {
  const g = await guard()
  if (!g.ok) return g
  const t = await getT()
  if (!NOTIFY_CHANNEL_TYPES.includes(input.type))
    return { ok: false, error: t('notify.err.invalid') }
  const url = validChannelUrl(input.url)
  if (!url) return { ok: false, error: t('notify.err.url') }
  const s = getSettings()
  const cfg = getNotifyConfig()
  const now = nowSec()
  const err = await sendToChannel({ type: input.type, url }, 'test', {
    locale: cfg.locale,
    familyName: s.familyName,
    meal: {
      id: 'test',
      title: null,
      mealType: 'dinner',
      date: todayLocal(s.timezone),
      diningTime: fmtTime(now, s.timezone),
      deadline: fmtTime(now, s.timezone),
    },
    dishes: [],
    cookName: null,
    link: cfg.baseUrl || null,
  })
  return err ? { ok: false, error: t('notify.err.send', { reason: err }) } : { ok: true }
}

const configSchema = z.object({
  baseUrl: z.string().trim().max(300),
  deadlineMinutes: z.number().int().min(5).max(720),
  locale: z.enum(['zh', 'en']),
})

export async function updateNotifyConfig(
  input: z.infer<typeof configSchema>,
): Promise<ActionResult> {
  const g = await guard()
  if (!g.ok) return g
  const t = await getT()
  const parsed = configSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t('notify.err.invalid') }
  let baseUrl = ''
  if (parsed.data.baseUrl) {
    const u = validChannelUrl(parsed.data.baseUrl)
    if (!u) return { ok: false, error: t('notify.err.url') }
    baseUrl = u.replace(/\/+$/, '')
  }
  setSettings([
    [NOTIFY_SETTING_KEYS.baseUrl, baseUrl],
    [NOTIFY_SETTING_KEYS.deadlineMinutes, String(parsed.data.deadlineMinutes)],
    [NOTIFY_SETTING_KEYS.locale, parsed.data.locale],
  ])
  revalidatePath('/admin')
  return { ok: true }
}
