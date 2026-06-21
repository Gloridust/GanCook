import 'server-only'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import sharp from 'sharp'
import { UPLOAD_DIR } from '@/lib/env'

/**
 * 图片落盘存储（替代原项目的 base64 进库）：
 * sharp 自动转向 → 长边≤1280 → webp(q80) → 写入 DATA_DIR/uploads/<subdir>/<uuid>.webp
 * DB 只保存返回的相对路径，如 "dishes/xxxx.webp"。
 */
const MAX_SIDE = 1280

export async function saveImage(
  buffer: Buffer,
  subdir: 'dishes' | 'avatars',
): Promise<string> {
  const dir = join(UPLOAD_DIR, subdir)
  await mkdir(dir, { recursive: true })
  const filename = `${crypto.randomUUID()}.webp`
  const out = await sharp(buffer)
    .rotate()
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
  await writeFile(join(dir, filename), out)
  return `${subdir}/${filename}`
}

/** 删除一张已存图片（容错：文件不存在不报错） */
export async function deleteImage(relPath: string | null | undefined) {
  if (!relPath) return
  // 防目录穿越
  const safe = normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '')
  if (safe.startsWith('..')) return
  try {
    await unlink(join(UPLOAD_DIR, safe))
  } catch {
    // 忽略
  }
}

/** 校验并读取上传文件为 Buffer（限制类型与大小） */
export async function fileToBuffer(
  file: File,
  maxBytes = 5 * 1024 * 1024,
): Promise<Buffer> {
  // 抛出稳定错误码，由调用方按语言翻译
  if (!file.type.startsWith('image/')) throw new Error('IMAGE_ONLY')
  if (file.size > maxBytes) throw new Error('IMAGE_TOO_LARGE')
  return Buffer.from(await file.arrayBuffer())
}
