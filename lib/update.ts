import 'server-only'
import { existsSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import { APP_VERSION, IMAGE_REPO } from './version'

const SOCK = '/var/run/docker.sock'

// ── 版本检查（查 Docker Hub 标签，总是可用，失败有兜底） ──

type Semver = [number, number, number]
function parseSemver(s: string): Semver | null {
  const m = String(s)
    .replace(/^v/, '')
    .match(/^(\d+)\.(\d+)\.(\d+)/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}
function cmp(a: Semver, b: Semver): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

export type UpdateCheck =
  | {
      ok: true
      current: string
      latest: string | null
      hasUpdate: boolean
      isDev: boolean
    }
  | { ok: false; error: string }

export async function checkForUpdate(): Promise<UpdateCheck> {
  try {
    const res = await fetch(
      `https://hub.docker.com/v2/repositories/${IMAGE_REPO}/tags?page_size=100&ordering=last_updated`,
      { signal: AbortSignal.timeout(8000), cache: 'no-store' },
    )
    if (!res.ok) return { ok: false, error: 'registry' }
    const data = (await res.json()) as { results?: { name: string }[] }
    const semvers = (data.results ?? [])
      .map((t) => parseSemver(t.name))
      .filter((v): v is Semver => !!v)
      .sort(cmp)
    const top = semvers[semvers.length - 1] ?? null
    const latest = top ? `v${top.join('.')}` : null
    const cur = parseSemver(APP_VERSION)
    const hasUpdate = !!(top && cur && cmp(top, cur) > 0)
    return { ok: true, current: APP_VERSION, latest, hasUpdate, isDev: !cur }
  } catch (e) {
    console.warn('[update] 检查更新失败:', (e as Error)?.message)
    return { ok: false, error: 'network' }
  }
}

// ── Docker 套接字（自更新能力探测 + 触发） ──

function dockerApi(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null
    const req = http.request(
      {
        socketPath: SOCK,
        method,
        path,
        timeout: 8000,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : {},
      },
      (res) => {
        let buf = ''
        res.on('data', (c) => (buf += c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text: buf }))
      },
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('timeout')))
    if (payload) req.write(payload)
    req.end()
  })
}

export type Capability =
  | { canUpdate: true }
  | { canUpdate: false; reason: 'no-socket' | 'permission' | 'unreachable' }

/** 探测是否具备「一键更新」能力（套接字存在且可访问） */
export async function updateCapability(): Promise<Capability> {
  if (!existsSync(SOCK)) return { canUpdate: false, reason: 'no-socket' }
  try {
    const r = await dockerApi('GET', '/_ping')
    if (r.status === 200) return { canUpdate: true }
    return { canUpdate: false, reason: 'unreachable' }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'EACCES') return { canUpdate: false, reason: 'permission' }
    return { canUpdate: false, reason: 'unreachable' }
  }
}

async function selfContainerName(): Promise<string> {
  try {
    const r = await dockerApi('GET', `/containers/${os.hostname()}/json`)
    if (r.status === 200) {
      const j = JSON.parse(r.text) as { Name?: string }
      if (j.Name) return j.Name.replace(/^\//, '')
    }
  } catch {
    // 忽略，用默认名兜底
  }
  return 'gancook'
}

export type UpdateResult =
  | { ok: true; target: string }
  | {
      ok: false
      reason: 'no-socket' | 'permission' | 'unreachable' | 'error'
      detail?: string
    }

/**
 * 触发一次性 Watchtower 容器来拉取新镜像并重建本容器。
 * 用 Watchtower 而非自己重建——它能在本容器被替换时存活，并完整保留卷/端口/环境。
 */
export async function performUpdate(): Promise<UpdateResult> {
  const cap = await updateCapability()
  if (!cap.canUpdate) return { ok: false, reason: cap.reason }

  try {
    const target = await selfContainerName()

    // 1) 拉取 watchtower 镜像（公共，无需鉴权；流式响应读到结束即可）
    await dockerApi(
      'POST',
      '/images/create?fromImage=containrrr/watchtower&tag=latest',
    )

    // 2) 创建一次性 watchtower 容器：拉新镜像 + 重建目标容器 + 自清理
    const create = await dockerApi('POST', '/containers/create', {
      Image: 'containrrr/watchtower:latest',
      Cmd: ['--run-once', '--cleanup', target],
      HostConfig: {
        AutoRemove: true,
        Binds: [`${SOCK}:/var/run/docker.sock`],
      },
    })
    if (create.status !== 201) {
      return { ok: false, reason: 'error', detail: `create ${create.status}` }
    }
    const id = (JSON.parse(create.text) as { Id: string }).Id

    // 3) 启动；之后 watchtower 会拉取并重建本容器（本进程随之被替换）
    const start = await dockerApi('POST', `/containers/${id}/start`)
    if (start.status !== 204 && start.status !== 200) {
      return { ok: false, reason: 'error', detail: `start ${start.status}` }
    }
    return { ok: true, target }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'EACCES') return { ok: false, reason: 'permission' }
    return { ok: false, reason: 'error', detail: (e as Error).message }
  }
}
