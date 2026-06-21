'use client'

const MAX_BYTES = 2 * 1024 * 1024 // 2MB 上限

/**
 * 上传前在浏览器端压缩图片：
 * - 长边降采样到 maxSide
 * - 导出 jpeg，并循环降低质量/尺寸直到 ≤ 2MB
 * 服务端 sharp 还会再转 webp；这一步保证上传体积可控、加载更快。
 */
export async function compressImage(
  file: Blob,
  maxSide = 1600,
  quality = 0.85,
  maxBytes = MAX_BYTES,
): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const baseMax = Math.max(bitmap.width, bitmap.height)

  const render = (side: number, q: number): Promise<Blob | null> => {
    const scale = Math.min(1, side / baseMax)
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return Promise.resolve(null)
    ctx.drawImage(bitmap, 0, 0, w, h)
    return new Promise((res) => canvas.toBlob(res, 'image/jpeg', q))
  }

  let side = maxSide
  let q = quality
  let out = await render(side, q)

  // 循环收敛到 2MB 以内
  while (out && out.size > maxBytes) {
    if (q > 0.5) {
      q -= 0.15
    } else if (side > 640) {
      side = Math.round(side * 0.82)
    } else {
      break // 已到下限，尽力而为
    }
    out = await render(side, q)
  }

  bitmap.close?.()
  return out ?? file
}
