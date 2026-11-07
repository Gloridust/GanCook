'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { matchDish, tagStats } from '@/lib/dish-categories'
import { cn } from '@/lib/utils'

type Filterable = {
  id: string
  name: string
  description?: string | null
  tags: string[] | null
}

/** 特殊筛选：已点（仅点菜页） */
export const PICKED = '__picked__'

export function useDishFilter<D extends Filterable>(
  dishes: D[],
  opts: { pickedIds?: Set<string> } = {},
) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)
  const tags = useMemo(() => tagStats(dishes), [dishes])
  const { pickedIds } = opts

  const filtered = useMemo(
    () =>
      dishes.filter((d) => {
        if (tag === PICKED) {
          if (!pickedIds?.has(d.id)) return false
        } else if (tag && !(d.tags ?? []).includes(tag)) return false
        return matchDish(d, deferredQuery)
      }),
    [dishes, tag, deferredQuery, pickedIds],
  )

  return { query, setQuery, tag, setTag, tags, filtered }
}

export function DishFilterBar({
  query,
  onQuery,
  tag,
  onTag,
  tags,
  total,
  pickedCount,
  className,
  trailing,
}: {
  query: string
  onQuery: (q: string) => void
  tag: string | null
  onTag: (t: string | null) => void
  tags: { tag: string; count: number }[]
  total: number
  /** 传入则显示「已点 N」芯片 */
  pickedCount?: number
  className?: string
  /** 搜索框右侧的附加控件（如视图切换） */
  trailing?: React.ReactNode
}) {
  const t = useT()
  // 菜少时没必要搜索/筛选，别给界面添噪音
  const showSearch = total > 8
  const showChips = tags.length > 0 || (pickedCount ?? 0) > 0

  if (!showSearch && !showChips && !trailing) return null

  return (
    <div className={cn('space-y-2.5', className)}>
      {(showSearch || trailing) && (
        <div className="flex items-center gap-2">
          {showSearch && (
            <label className="mf-inset flex h-10 min-w-0 flex-1 items-center gap-2 px-3.5 focus-within:ring-2 focus-within:ring-accent/50">
              <Search className="h-4 w-4 shrink-0 text-secondary/70" />
              <input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder={t('filter.searchPh', { n: total })}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-secondary/70 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => onQuery('')}
                  aria-label={t('filter.clear')}
                  className="-mr-1 flex h-6 w-6 items-center justify-center rounded-full bg-secondary/20 text-secondary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
          )}
          {trailing}
        </div>
      )}

      {showChips && (
        <div className="mf-rail -mx-4 px-4 pb-0.5">
          <button
            type="button"
            className="mf-filter-chip"
            aria-pressed={tag === null}
            onClick={() => onTag(null)}
          >
            {t('filter.all')}
          </button>
          {pickedCount !== undefined && pickedCount > 0 && (
            <button
              type="button"
              className="mf-filter-chip"
              aria-pressed={tag === PICKED}
              onClick={() => onTag(tag === PICKED ? null : PICKED)}
            >
              {t('filter.picked')}
              <span className="mf-count">{pickedCount}</span>
            </button>
          )}
          {tags.map(({ tag: name, count }) => (
            <button
              key={name}
              type="button"
              className="mf-filter-chip"
              aria-pressed={tag === name}
              onClick={() => onTag(tag === name ? null : name)}
            >
              {name}
              <span className="mf-count">{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** 筛选后为空时的提示 */
export function NoMatch({ onReset }: { onReset: () => void }) {
  const t = useT()
  return (
    <div className="mf-inset flex flex-col items-center gap-2 rounded-2xl p-6 text-center text-sm text-secondary">
      {t('filter.noMatch')}
      <button
        type="button"
        onClick={onReset}
        className="font-medium text-accent"
      >
        {t('filter.reset')}
      </button>
    </div>
  )
}
