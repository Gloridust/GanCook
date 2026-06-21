import * as React from 'react'
import Image from 'next/image'
import { Soup } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Dish } from '@/lib/db/schema'

/** 菜品卡片（展示型）。作为 DialogTrigger 子节点时需要转发 ref/props。 */
export const DishCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { dish: Dish; dimmed?: boolean }
>(({ dish, dimmed, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'mf-raised mf-pressable overflow-hidden p-0 text-left',
        dimmed && 'opacity-50',
        className,
      )}
      {...props}
    >
      <div className="relative aspect-[4/3] w-full">
        {dish.imagePath ? (
          <Image
            src={`/api/uploads/${dish.imagePath}`}
            alt={dish.name}
            fill
            sizes="(max-width: 480px) 50vw, 220px"
            className="object-cover"
          />
        ) : (
          <div className="mf-img-empty flex h-full w-full items-center justify-center">
            <Soup className="h-9 w-9 text-accent/35" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="relative p-3.5">
        <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {dish.name}
        </h3>
        {dish.description ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-secondary">
            {dish.description}
          </p>
        ) : dish.tags && dish.tags.length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-secondary">
            {dish.tags.slice(0, 3).join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
  )
})
DishCard.displayName = 'DishCard'
