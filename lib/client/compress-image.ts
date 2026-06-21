'use client'

/**
 * 上传前在浏览器端把图片降采样到长边 ≤ maxSide，导出为 jpeg Blob。
 * 服务端 sharp 还会再压一次转 webp；这一步主要为了减小上传体积。
 */
export async function compressImage(
  file: File,
  maxSide = 1600,
  quality = 0.85,
): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  let { width, height } = bitmap
  if (width > maxSide || height > maxSide) {
    const scale = maxSide / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  return blob ?? file
}
