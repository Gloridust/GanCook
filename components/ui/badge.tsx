import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        accent: 'bg-[rgb(var(--mf-accent-soft)/0.15)] text-accent',
        neutral: 'bg-trough text-secondary',
        warn: 'bg-[#e0a13a]/15 text-[#b3791f]',
        danger: 'bg-danger/12 text-danger',
        auto: 'bg-[rgb(var(--mf-accent-soft)/0.12)] text-accent',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
