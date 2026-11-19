import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { apiTokens, users, type User } from '@/lib/db/schema'
import { nowSec } from '@/lib/time'

const PREFIX = 'gck_'
// lastUsedAt 不必每次都写库
const TOUCH_INTERVAL_SEC = 60

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 生成新令牌；明文只在这里返回一次 */
export function issueToken(userId: string, name: string): { id: string; token: string } {
  const token = PREFIX + randomBytes(24).toString('base64url')
  const row = db
    .insert(apiTokens)
    .values({
      userId,
      name: name.trim().slice(0, 30) || 'API',
      tokenHash: hashToken(token),
      prefix: token.slice(0, PREFIX.length + 6),
    })
    .returning({ id: apiTokens.id })
    .get()
  return { id: row.id, token }
}

export function listTokens(userId: string) {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.prefix,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt))
    .all()
}

export function revokeToken(userId: string, id: string): boolean {
  return (
    db
      .delete(apiTokens)
      .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
      .run().changes > 0
  )
}

/** 从请求头取令牌对应的用户（Authorization: Bearer gck_… 或 X-API-Key） */
export function userFromRequest(req: Request): User | null {
  const auth = req.headers.get('authorization') ?? ''
  const token =
    (/^Bearer\s+(.+)$/i.exec(auth)?.[1] ?? req.headers.get('x-api-key') ?? '').trim()
  if (!token.startsWith(PREFIX) || token.length > 100) return null
  const row = db
    .select({ tokenId: apiTokens.id, lastUsedAt: apiTokens.lastUsedAt, user: users })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.userId, users.id))
    .where(eq(apiTokens.tokenHash, hashToken(token)))
    .get()
  if (!row) return null
  const now = nowSec()
  if (!row.lastUsedAt || now - row.lastUsedAt > TOUCH_INTERVAL_SEC) {
    db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, row.tokenId)).run()
  }
  return row.user
}
