import * as React from 'react'
import { cn } from '@/lib/utils'

/** 空状态：中心一个浮起圆 blob + 图标 + 标题副标题 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-16 text-center',
        className,
      )}
    >
      <div className="mf-tonal mb-5 flex h-24 w-24 items-center justify-center rounded-full">
        <span className="relative text-accent [&_svg]:h-10 [&_svg]:w-10">
          {icon}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-secondary">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
