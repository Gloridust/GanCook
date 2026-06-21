'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { getCroppedBlob, type CropArea } from '@/lib/client/crop-image'

/** 全屏图片裁剪器。aspect=1 为方形（圆形预览，用于头像）。 */
export function ImageCropper({
  src,
  aspect = 1,
  maxSide = 1024,
  onCancel,
  onConfirm,
}: {
  src: string
  aspect?: number
  maxSide?: number
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}) {
  const t = useT()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pixels, setPixels] = useState<CropArea | null>(null)
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const onCropComplete = useCallback((_: unknown, areaPixels: CropArea) => {
    setPixels(areaPixels)
  }, [])

  const confirm = async () => {
    if (!pixels) return
    setBusy(true)
    try {
      const blob = await getCroppedBlob(src, pixels, maxSide)
      onConfirm(blob)
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/85">
      <div className="relative flex-1">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape={aspect === 1 ? 'round' : 'rect'}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="space-y-4 bg-base p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: 'var(--mf-accent-strong)' }}
          aria-label="zoom"
        />
        <div className="flex gap-3">
          <Button variant="trough" className="flex-1" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1" loading={busy} onClick={confirm}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
