'use client'

import { useEffect, useState } from 'react'
import { LayoutGrid, List as ListIcon } from 'lucide-react'
import { useT } from '@/components/i18n-provider'

export type ViewMode = 'grid' | 'list'

/**
 * 网格 / 列表视图，记住每台设备的偏好。
 * 默认值按「有图菜品占比」决定：多数没图时列表更紧凑，一屏能看十几道。
 */
export function useViewMode(storageKey: string, fallback: ViewMode) {
  const [mode, setMode] = useState<ViewMode>(fallback)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      // 首帧之后才能读本地存储（服务端渲染没有它），这里同步一次偏好
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === 'grid' || saved === 'list') setMode(saved)
    } catch {
      // 隐私模式等：用默认
    }
  }, [storageKey])
  const update = (next: ViewMode) => {
    setMode(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // 忽略
    }
  }
  return [mode, update] as const
}

export function defaultViewMode(dishes: { imagePath: string | null }[]): ViewMode {
  if (dishes.length === 0) return 'grid'
  const withImage = dishes.filter((d) => d.imagePath).length
  return withImage / dishes.length >= 0.5 ? 'grid' : 'list'
}

export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode
  onChange: (m: ViewMode) => void
}) {
  const t = useT()
  const next = mode === 'grid' ? 'list' : 'grid'
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={next === 'list' ? t('filter.viewList') : t('filter.viewGrid')}
      className="mf-inset flex h-10 w-10 shrink-0 items-center justify-center text-secondary"
    >
      {mode === 'grid' ? (
        <ListIcon className="h-[18px] w-[18px]" />
      ) : (
        <LayoutGrid className="h-[18px] w-[18px]" />
      )}
    </button>
  )
}
