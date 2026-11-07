import * as React from 'react'
import { cn } from '@/lib/utils'
import { DishThumb } from '@/components/dishes/dish-thumb'
import type { Dish } from '@/lib/db/schema'

type CardDish = Pick<Dish, 'name' | 'description' | 'imagePath' | 'tags'>

function subline(dish: CardDish): string | null {
  if (dish.tags && dish.tags.length > 0) return dish.tags.slice(0, 3).join(' · ')
  return dish.description || null
}

/** 菜品卡片（网格视图） */
export const DishCard = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    dish: CardDish
    dimmed?: boolean
  }
>(({ dish, dimmed, className, ...props }, ref) => {
  const sub = subline(dish)
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'mf-raised mf-pressable block w-full overflow-hidden p-0 text-left',
        dimmed && 'opacity-50',
        className,
      )}
      {...props}
    >
      <DishThumb
        name={dish.name}
        imagePath={dish.imagePath}
        tags={dish.tags}
        sizes="(max-width: 480px) 50vw, 220px"
        className="aspect-[4/3] w-full"
        emojiClassName="text-[40px]"
      />
      <div className="relative px-3.5 py-3">
        <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {dish.name}
        </h3>
        <p className="mt-0.5 truncate text-xs text-secondary">{sub ?? ' '}</p>
      </div>
    </button>
  )
})
DishCard.displayName = 'DishCard'

/** 菜品行（列表视图，一屏十几道，适合菜多又不拍照的家庭） */
export function DishRow({
  dish,
  dimmed,
  onClick,
  trailing,
}: {
  dish: CardDish
  dimmed?: boolean
  onClick?: () => void
  trailing?: React.ReactNode
}) {
  const sub = subline(dish)
  const body = (
    <>
      <DishThumb
        name={dish.name}
        imagePath={dish.imagePath}
        tags={dish.tags}
        sizes="48px"
        className="h-12 w-12 shrink-0 rounded-[14px]"
        emojiClassName="text-[24px]"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">
          {dish.name}
        </span>
        {sub && (
          <span className="mt-0.5 block truncate text-xs text-secondary">
            {sub}
          </span>
        )}
      </span>
    </>
  )
  const cls = cn('mf-row mf-row-inset mf-row-dish', dimmed && 'opacity-50')
  if (trailing) {
    // 尾部有自己的按钮（如点菜步进器）时，整行不能再是 button（避免按钮嵌套）
    return (
      <div className={cls}>
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-[0.8rem] text-left"
        >
          {body}
        </button>
        {trailing}
      </div>
    )
  }
  if (!onClick) return <div className={cls}>{body}</div>
  return (
    <button type="button" onClick={onClick} className={cn(cls, 'mf-row-press')}>
      {body}
    </button>
  )
}
