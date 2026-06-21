import 'server-only'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getSession } from './session'
import type { User } from '@/lib/db/schema'

export function countUsers(): number {
  const row = db
    .select({ c: sql<number>`count(*)` })
    .from(users)
    .get()
  return row?.c ?? 0
}

export function isSetupNeeded(): boolean {
  return countUsers() === 0
}

export function getUserById(id: string): User | undefined {
  return db.select().from(users).where(eq(users.id, id)).get()
}

export function getUserByName(name: string): User | undefined {
  return db.select().from(users).where(eq(users.name, name)).get()
}

export function listMembers(): User[] {
  return db.select().from(users).orderBy(users.createdAt).all()
}

/** 当前登录用户（结合会话 + DB）。未登录返回 null。 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession()
  if (!session) return null
  return getUserById(session.userId) ?? null
}

/** 受保护页面用：未登录跳登录，无用户跳首启 */
export async function requireUser(): Promise<User> {
  if (isSetupNeeded()) redirect('/setup')
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser()
  if (!user.isAdmin) redirect('/home')
  return user
}
