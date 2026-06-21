import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { AUTH_SECRET } from '@/lib/env'

const COOKIE = 'gancook_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 天
const secret = new TextEncoder().encode(AUTH_SECRET)

export type SessionPayload = {
  userId: string
  name: string
  isAdmin: boolean
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret)
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    return {
      userId: payload.userId as string,
      name: payload.name as string,
      isAdmin: Boolean(payload.isAdmin),
    }
  } catch {
    return null
  }
}

/** 在 Server Action 中创建会话（写 httpOnly cookie） */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload)
  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE)
}

/** 读取当前会话（服务端组件 / Action 中使用） */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  return verifySession(store.get(COOKIE)?.value)
}

export const SESSION_COOKIE = COOKIE
