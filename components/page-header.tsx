import * as React from 'react'

/** 页面顶部标题栏：大标题 + 可选副标题 + 右侧操作 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="tracking-title text-2xl font-bold text-ink">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-secondary">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  )
}
