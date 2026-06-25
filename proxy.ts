import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE = 'gancook_session'
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'insecure-dev-secret-change-me',
)

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

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const authed = await hasValidSession(req)

  // 公共 API 放行
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 其余 API：未登录返回 401
  if (pathname.startsWith('/api')) {
    if (!authed)
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    return NextResponse.next()
  }

  // 登录/首启页：放行，由页面自行决定是否跳转（避免「有效 cookie + 空库」的重定向死循环）
  if (PUBLIC_PAGES.includes(pathname)) {
    return NextResponse.next()
  }

  // 受保护页面：无有效会话跳登录（持有效 cookie 但用户已不存在时，页面的 requireUser 会再处理）
  if (!authed) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    // 排除静态资源
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)).*)',
  ],
}
