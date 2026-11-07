'use client'

import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/components/i18n-provider'
import { DishThumb } from '@/components/dishes/dish-thumb'
import type { Dish } from '@/lib/db/schema'

type DetailDish = Pick<
  Dish,
  'name' | 'description' | 'instructions' | 'imagePath' | 'tags'
>

/** 菜品详情（只读）：简介、做法。可作触发器包裹，也可受控（open/onOpenChange） */
export function DishDetails({
  dish,
  children,
  open,
  onOpenChange,
  footer,
}: {
  dish: DetailDish
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 底部附加操作（如点菜页的「点这道」） */
  footer?: React.ReactNode
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        title={dish.name}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <div className="space-y-4">
          <DishThumb
            name={dish.name}
            imagePath={dish.imagePath}
            tags={dish.tags}
            sizes="(max-width: 480px) 100vw, 448px"
            className={dish.imagePath ? 'aspect-[4/3] rounded-2xl' : 'h-28 rounded-2xl'}
            emojiClassName="text-[52px]"
          />

          {dish.tags && dish.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {dish.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          )}

          {dish.description && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-ink">
                {t('dishform.note')}
              </h3>
              <p className="whitespace-pre-wrap text-sm text-secondary">
                {dish.description}
              </p>
            </div>
          )}

          {dish.instructions ? (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-ink">
                {t('dishform.instructions')}
              </h3>
              <p className="whitespace-pre-wrap text-[15px] leading-7 text-ink">
                {dish.instructions}
              </p>
            </div>
          ) : (
            !dish.description && (
              <p className="text-sm text-secondary">{t('dishdetail.empty')}</p>
            )
          )}

          {footer}
        </div>
      </DialogContent>
    </Dialog>
  )
}
