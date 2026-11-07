'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { DishCard, DishRow } from '@/components/dishes/dish-card'
import { DishForm } from '@/components/dishes/dish-form'
import { DishDetails } from '@/components/dishes/dish-details'
import {
  DishFilterBar,
  NoMatch,
  useDishFilter,
} from '@/components/dishes/dish-filter'
import {
  ViewModeToggle,
  defaultViewMode,
  useViewMode,
} from '@/components/dishes/view-mode'
import { List } from '@/components/ui/list'
import type { Dish } from '@/lib/db/schema'

export function DishLibrary({
  dishes,
  meId,
  isAdmin,
}: {
  dishes: Dish[]
  meId: string
  isAdmin: boolean
}) {
  const t = useT()
  const active = useMemo(() => dishes.filter((d) => d.status === 'active'), [dishes])
  const archived = useMemo(
    () => dishes.filter((d) => d.status === 'archived'),
    [dishes],
  )
  const { query, setQuery, tag, setTag, tags, filtered } = useDishFilter(active)
  const [mode, setMode] = useViewMode('gancook.dishes.view', defaultViewMode(active))
  const [showArchived, setShowArchived] = useState(false)
  // 整页只挂一个编辑表单 / 详情弹窗（菜多时每道菜一个实例会很卡）
  const [selected, setSelected] = useState<Dish | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const suggestedTags = useMemo(() => tags.map((x) => x.tag), [tags])

  const canManage = (d: Dish) => d.createdBy === meId || isAdmin
  const openDish = (d: Dish) => {
    setSelected(d)
    setDialogOpen(true)
  }

  const renderDishes = (list: Dish[], dimmed = false) =>
    mode === 'grid' ? (
      <div className="grid grid-cols-2 gap-3">
        {list.map((d) => (
          <DishCard key={d.id} dish={d} dimmed={dimmed} onClick={() => openDish(d)} />
        ))}
      </div>
    ) : (
      <List>
        {list.map((d) => (
          <DishRow key={d.id} dish={d} dimmed={dimmed} onClick={() => openDish(d)} />
        ))}
      </List>
    )

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-4 bg-base/92 px-4 pb-3 pt-2 backdrop-blur-md">
        <DishFilterBar
          query={query}
          onQuery={setQuery}
          tag={tag}
          onTag={setTag}
          tags={tags}
          total={active.length}
          trailing={<ViewModeToggle mode={mode} onChange={setMode} />}
        />
      </div>

      {filtered.length === 0 && active.length > 0 ? (
        <NoMatch
          onReset={() => {
            setQuery('')
            setTag(null)
          }}
        />
      ) : (
        renderDishes(filtered)
      )}

      {archived.length > 0 && (
        <div className="mt-7">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="mf-section mb-3 inline-flex items-center gap-1"
          >
            {t('dishes.archivedN', { n: archived.length })}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showArchived ? 'rotate-180' : ''}`}
            />
          </button>
          {showArchived && renderDishes(archived, true)}
        </div>
      )}

      {selected &&
        (canManage(selected) ? (
          <DishForm
            key={selected.id}
            mode="edit"
            dish={selected}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            suggestedTags={suggestedTags}
          />
        ) : (
          <DishDetails
            key={selected.id}
            dish={selected}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          />
        ))}
    </>
  )
}
