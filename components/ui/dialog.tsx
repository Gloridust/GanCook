'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    title?: string
  }
>(({ className, children, title, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="mf-overlay fixed inset-0 z-50 bg-black/30" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'mf-sheet fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[28px] bg-base p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-6px_30px_rgba(56,71,60,0.18)]',
        'sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[28px]',
        className,
      )}
      {...props}
    >
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-trough sm:hidden" />
      {title && (
        <DialogPrimitive.Title className="mb-4 text-lg font-semibold text-ink">
          {title}
        </DialogPrimitive.Title>
      )}
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 hidden text-secondary hover:text-ink sm:block">
        <X className="h-5 w-5" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'
