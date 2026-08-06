'use client'

import Image from 'next/image'
import { Soup } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/components/i18n-provider'
import type { Dish } from '@/lib/db/schema'

export function DishDetails({
  dish,
  children,
}: {
  dish: Dish
  children: React.ReactNode
}) {
  const t = useT()
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={dish.name}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <div className="space-y-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            {dish.imagePath ? (
              <Image
                src={`/api/uploads/${dish.imagePath}`}
                alt={dish.name}
                fill
                sizes="(max-width: 480px) 100vw, 448px"
                className="object-cover"
              />
            ) : (
              <div className="mf-img-empty flex h-full items-center justify-center">
                <Soup
                  className="h-12 w-12 text-accent/35"
                  strokeWidth={1.5}
                />
              </div>
            )}
          </div>

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

          {dish.instructions && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-ink">
                {t('dishform.instructions')}
              </h3>
              <p className="whitespace-pre-wrap text-[15px] leading-7 text-ink">
                {dish.instructions}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
