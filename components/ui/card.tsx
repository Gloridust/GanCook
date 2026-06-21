import * as React from 'react'
import { cn } from '@/lib/utils'

/** 浮起白布卡片。pressable 时可点击有按压反馈。 */
export function Card({
  className,
  pressable,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { pressable?: boolean }) {
  return (
    <div
      className={cn(
        'mf-raised p-4',
        pressable && 'mf-pressable cursor-pointer',
        className,
      )}
      {...props}
    />
  )
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('relative text-base font-semibold text-ink', className)}
      {...props}
    />
  )
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('relative text-sm text-secondary', className)} {...props} />
  )
}
