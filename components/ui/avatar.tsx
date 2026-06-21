'use client'

import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'

/** 头像：有图显示图，无图显示昵称首字，底色按名字稳定取青系色调 */
const PALETTE = [
  '#4ea96b',
  '#5b9bd5',
  '#e0a13a',
  '#d9776f',
  '#8a7bd8',
  '#46b6a8',
]

function colorFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  const initial = name?.trim().slice(0, 1).toUpperCase() || '?'
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src && (
        <AvatarPrimitive.Image
          src={src}
          alt={name}
          className="h-full w-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center font-semibold text-white"
        style={{ background: colorFor(name), fontSize: size * 0.42 }}
        delayMs={src ? 300 : 0}
      >
        {initial}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
