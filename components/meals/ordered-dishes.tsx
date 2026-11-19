'use client'

import { useState } from 'react'
import { BookOpen, Refrigerator } from 'lucide-react'
import { List, Row } from '@/components/ui/list'
import { DishThumb } from '@/components/dishes/dish-thumb'
import { DishDetails } from '@/components/dishes/dish-details'
import { useT } from '@/components/i18n-provider'

export type OrderedDish = {
  dishId: string
  name: string
  image: string | null
  tags: string[] | null
  description: string | null
  instructions: string | null
  total: number
  who: string
  /** 家里库存里用得上的（如「鸡蛋 6 个」） */
  pantry: string[]
}

/**
 * 「大家点了什么」：掌勺人的要做清单。点一行看简介和做法，
 * 并提示家里库存里有哪些用得上（备菜时心里有数）。
 */
export function OrderedDishes({ groups }: { groups: OrderedDish[] }) {
  const t = useT()
  const [open, setOpen] = useState<OrderedDish | null>(null)
  const sep = t('common.listSep')

  return (
    <>
      <List>
        {groups.map((g) => (
          <Row
            key={g.dishId}
            chevron={false}
            className="mf-row-dish"
            onClick={() => setOpen(g)}
            leading={
              <DishThumb
                name={g.name}
                imagePath={g.image}
                tags={g.tags}
                sizes="44px"
                className="h-11 w-11 shrink-0 rounded-xl"
                emojiClassName="text-[22px]"
              />
            }
            title={
              <span className="inline-flex max-w-full items-center gap-1.5">
                <span className="truncate">{g.name}</span>
                {g.instructions && (
                  <BookOpen
                    aria-label={t('picker.howTo')}
                    className="h-3.5 w-3.5 shrink-0 text-secondary/60"
                  />
                )}
              </span>
            }
            subtitle={g.who}
            trailing={
              <span className="rounded-full bg-tint px-2.5 py-1 text-sm font-semibold tabular-nums text-accent">
                ×{g.total}
              </span>
            }
          />
        ))}
      </List>

      {open && (
        <DishDetails
          key={open.dishId}
          dish={{
            name: open.name,
            description: open.description,
            instructions: open.instructions,
            imagePath: open.image,
            tags: open.tags,
          }}
          open
          onOpenChange={(o) => !o && setOpen(null)}
          footer={
            <div className="mf-inset flex items-start gap-2 rounded-2xl px-3.5 py-3 text-sm">
              <Refrigerator className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="text-secondary">
                {open.pantry.length > 0
                  ? t('detail.pantryHas', { items: open.pantry.join(sep) })
                  : t('detail.pantryNone')}
              </span>
            </div>
          }
        />
      )}
    </>
  )
}
