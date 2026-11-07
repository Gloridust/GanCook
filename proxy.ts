import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { AUTH_SECRET } from '@/lib/env'

const COOKIE = 'gancook_session'
const secret = new TextEncoder().encode(AUTH_SECRET)

// 无需登录即可访问的页面（是否再跳转交给页面判断——页面能读数据库，能验证用户是否真实存在）
const PUBLIC_PAGES = ['/login', '/setup']
const PUBLIC_API = ['/api/uploads', '/api/cron']

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE)?.value
  if (!token) return false
  try {
    await jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

/**
 * 反向代理 / NAS 远程访问（如飞牛 App、FN Connect、nginx 未透传 Host）常会改写
 * Host / X-Forwarded-Host，导致 Next.js Server Actions 的来源校验误判为 CSRF：
 *   "`x-forwarded-host` header ... does not match `origin` header ... Aborting the action."
 *
 * 处理方式：仅当浏览器自己声明这是「同源请求」（Sec-Fetch-Site: same-origin，
 * 该头属于禁止脚本修改的请求头，网页无法伪造）时，才把 X-Forwarded-Host 对齐到 Origin。
 * 真正的跨站请求会带 cross-site / same-site，依旧会被 Next.js 拦截。
 */
function alignForwardedHost(req: NextRequest): Headers | null {
  if (req.method !== 'POST') return null
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return null
  const origin = req.headers.get('origin')
  if (!origin || origin === 'null') return null

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return null
  }
  const forwarded = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const effectiveHost = forwarded || req.headers.get('host')
  if (effectiveHost === originHost) return null

  const headers = new Headers(req.headers)
  headers.set('x-forwarded-host', originHost)
  return headers
}

function pass(req: NextRequest) {
  const headers = alignForwardedHost(req)
  return headers ? NextResponse.next({ request: { headers } }) : NextResponse.next()
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 公共 API 放行
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const authed = await hasValidSession(req)

  // 其余 API：未登录返回 401
  if (pathname.startsWith('/api')) {
    if (!authed)
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    return pass(req)
  }

  // 登录/首启页：放行，由页面自行决定是否跳转（避免「有效 cookie + 空库」的重定向死循环）
  if (PUBLIC_PAGES.includes(pathname)) {
    return pass(req)
  }

  // 受保护页面：无有效会话跳登录（持有效 cookie 但用户已不存在时，页面的 requireUser 会再处理）
  if (!authed) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return pass(req)
}

export const config = {
  matcher: [
    // 排除静态资源；菜单导入（大文件上传）自行鉴权，避免 proxy 把请求体截断在 10MB
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|api/dishes/import|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)).*)',
  ],
}
