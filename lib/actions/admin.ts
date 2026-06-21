'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { mealSchedules, users } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/user'
import { setSetting } from '@/lib/settings'
import { getT } from '@/lib/i18n/server'
import type { User } from '@/lib/db/schema'

export type ActionResult = { ok: true } | { ok: false; error: string }

async function requireAdminUser(): Promise<
  { ok: true; me: User } | { ok: false; error: string }
> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  if (!me.isAdmin) return { ok: false, error: t('err.adminRequired') }
  return { ok: true, me }
}

export async function updateFamilySettings(input: {
  familyName: string
  registrationOpen: boolean
  joinCode: string
}): Promise<ActionResult> {
  const t = await getT()
  const r = await requireAdminUser()
  if (!r.ok) return r

  const familyName = input.familyName.trim().slice(0, 20)
  if (!familyName) return { ok: false, error: t('err.familyNameEmpty') }

  setSetting('familyName', familyName)
  setSetting('registrationOpen', input.registrationOpen ? '1' : '0')
  setSetting('joinCode', input.joinCode.trim())
  revalidatePath('/admin')
  revalidatePath('/login')
  return { ok: true }
}

const scheduleSchema = z.object({
  name: z.string().trim().min(1, '请填写规则名称').max(20),
  mealType: z.enum(['breakfast', 'lunch', 'dinner']),
  enabled: z.boolean(),
  diningTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式不对'),
  createLeadHours: z.number().int().min(0).max(72),
  deadlineLeadMinutes: z.number().int().min(0).max(1440),
  weekdays: z.array(z.number().int().min(0).max(6)),
})

export type ScheduleInput = z.infer<typeof scheduleSchema>

export async function createSchedule(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const r = await requireAdminUser()
  if (!r.ok) return r
  const row = db
    .insert(mealSchedules)
    .values({
      name: '新饭局',
      mealType: 'dinner',
      enabled: true,
      diningTime: '18:00',
      createLeadHours: 10,
      deadlineLeadMinutes: 120,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
    })
    .returning()
    .get()
  revalidatePath('/admin')
  return { ok: true, id: row.id }
}

export async function updateSchedule(
  id: string,
  input: ScheduleInput,
): Promise<ActionResult> {
  const t = await getT()
  const r = await requireAdminUser()
  if (!r.ok) return r

  const parsed = scheduleSchema.safeParse(input)
  if (!parsed.success) {
    const field = parsed.error.issues[0].path[0]
    return {
      ok: false,
      error: field === 'name' ? t('err.scheduleName') : t('err.timeFmt'),
    }
  }

  db.update(mealSchedules)
    .set(parsed.data)
    .where(eq(mealSchedules.id, id))
    .run()
  revalidatePath('/admin')
  return { ok: true }
}

export async function deleteSchedule(id: string): Promise<ActionResult> {
  const r = await requireAdminUser()
  if (!r.ok) return r
  db.delete(mealSchedules).where(eq(mealSchedules.id, id)).run()
  revalidatePath('/admin')
  return { ok: true }
}

export async function setMemberAdmin(
  userId: string,
  isAdmin: boolean,
): Promise<ActionResult> {
  const t = await getT()
  const r = await requireAdminUser()
  if (!r.ok) return r
  if (userId === r.me.id && !isAdmin)
    return { ok: false, error: t('err.cantDemoteSelf') }
  db.update(users).set({ isAdmin }).where(eq(users.id, userId)).run()
  revalidatePath('/admin')
  return { ok: true }
}

export async function runScheduleNow(): Promise<
  { ok: true; created: number; started: number; finished: number } | { ok: false; error: string }
> {
  const r = await requireAdminUser()
  if (!r.ok) return r
  const { tick } = await import('@/lib/scheduler')
  const res = tick()
  revalidatePath('/meals')
  revalidatePath('/home')
  return { ok: true, ...res }
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const t = await getT()
  const r = await requireAdminUser()
  if (!r.ok) return r
  if (userId === r.me.id) return { ok: false, error: t('err.cantRemoveSelf') }
  db.delete(users).where(eq(users.id, userId)).run()
  revalidatePath('/admin')
  return { ok: true }
}
