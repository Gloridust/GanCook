import 'server-only'
import { db } from '@/lib/db/client'
import { settings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { TIMEZONE } from '@/lib/env'

export type FamilySettings = {
  familyName: string
  joinCode: string
  registrationOpen: boolean
  timezone: string
}

const DEFAULTS: FamilySettings = {
  familyName: '我家',
  joinCode: '',
  registrationOpen: true,
  timezone: TIMEZONE,
}

export function getSetting(key: string): string | null {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get()
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run()
}

export function getSettings(): FamilySettings {
  const rows = db.select().from(settings).all()
  const map = new Map(rows.map((r) => [r.key, r.value ?? '']))
  return {
    familyName: map.get('familyName') || DEFAULTS.familyName,
    joinCode: map.get('joinCode') ?? DEFAULTS.joinCode,
    registrationOpen:
      (map.get('registrationOpen') ?? '1') === '1',
    timezone: map.get('timezone') || DEFAULTS.timezone,
  }
}
