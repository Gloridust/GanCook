'use client'

export type CropArea = { x: number; y: number; width: number; height: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** 按裁剪区域生成 jpeg Blob（长边限制到 maxSide，保留裁剪比例） */
export async function getCroppedBlob(
  src: string,
  area: CropArea,
  maxSide = 1024,
): Promise<Blob> {
  const img = await loadImage(src)
  const scale = Math.min(1, maxSide / Math.max(area.width, area.height))
  const w = Math.max(1, Math.round(area.width * scale))
  const h = Math.max(1, Math.round(area.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, w, h)

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/jpeg', 0.9),
  )
  if (!blob) throw new Error('crop failed')
  return blob
}
