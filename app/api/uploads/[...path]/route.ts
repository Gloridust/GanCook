import { readFile } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'
import { UPLOAD_DIR } from '@/lib/env'

const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const rel = normalize(path.join('/'))
  // 防目录穿越
  if (rel.startsWith('..') || rel.includes('..')) {
    return new Response('Not found', { status: 404 })
  }
  try {
    const data = await readFile(join(UPLOAD_DIR, rel))
    const type = TYPES[extname(rel).toLowerCase()] || 'application/octet-stream'
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
