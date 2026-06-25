import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 内嵌分组列表容器（iOS 风格：圆角卡片 + 行间发丝线） */
export function List({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('mf-list', className)}>{children}</div>
}

type RowProps = {
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
  /** 链接行：右侧自动加 chevron */
  href?: string
  onClick?: () => void
  chevron?: boolean
  className?: string
}

/** 列表行：前导图标 + 标题/副标题 + 尾部控件/箭头 */
export function Row({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  chevron,
  className,
}: RowProps) {
  const interactive = !!href || !!onClick
  const showChevron = chevron ?? (!!href || (!!onClick && !trailing))

  const inner = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">
          {title}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-xs text-secondary">
            {subtitle}
          </span>
        )}
      </span>
      {trailing}
      {showChevron && (
        <ChevronRight className="h-4 w-4 shrink-0 text-secondary/50" />
      )}
    </>
  )

  const cls = cn(
    'mf-row',
    leading ? 'mf-row-inset' : '',
    interactive && 'mf-row-press',
    className,
  )

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    )
  }
  return <div className={cls}>{inner}</div>
}
