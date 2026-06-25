'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Milk Fabric 按钮
 * - primary：青菜绿填充（.mf-accent-fill）+ 白字 + 白色顶面 sheen
 * - secondary：浮起白布（.mf-raised）+ accent 文字
 * - ghost / danger
 * 所有可按压变体带 .mf-pressable（按下缩小 + 阴影收紧）
 */
const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-[-0.01em] select-none disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'mf-accent-fill mf-pressable text-white',
        secondary: 'mf-outline mf-pressable text-accent',
        tonal: 'mf-tonal mf-pressable text-accent',
        ghost: 'mf-pressable text-secondary hover:text-ink',
        danger: 'mf-pressable bg-danger text-white',
        trough: 'mf-trough mf-pressable text-secondary',
      },
      size: {
        sm: 'h-9 px-4 text-sm rounded-2xl',
        md: 'h-11 px-5 text-[15px] rounded-2xl',
        lg: 'h-14 px-7 text-base rounded-3xl',
        icon: 'h-11 w-11 rounded-2xl',
        pill: 'h-11 px-6 text-[15px] rounded-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild, loading, children, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          children
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
