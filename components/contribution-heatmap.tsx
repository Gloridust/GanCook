import { dayjs } from '@/lib/time'

const LEVEL_ALPHA = [0, 0.28, 0.5, 0.72, 1]

function level(count: number): number {
  if (count <= 0) return 0
  if (count >= 4) return 4
  return count
}

/**
 * GitHub 风格贡献热力图（服务端渲染，hover 用 title）。
 * 列 = 周，行 = 周日..周六；强度按当天次数着色（青菜绿）。
 */
export function ContributionHeatmap({
  data,
  today,
  weeks = 26,
  label,
}: {
  data: Record<string, number>
  today: string
  weeks?: number
  label?: string
}) {
  const end = dayjs(today)
  let gridStart = end.subtract(weeks * 7 - 1, 'day')
  gridStart = gridStart.subtract(gridStart.day(), 'day') // 回到周日
  const numCols = Math.ceil((end.diff(gridStart, 'day') + 1) / 7)

  const cols: { date: string | null; count: number }[][] = []
  for (let c = 0; c < numCols; c++) {
    const col: { date: string | null; count: number }[] = []
    for (let r = 0; r < 7; r++) {
      const d = gridStart.add(c * 7 + r, 'day')
      if (d.isAfter(end)) {
        col.push({ date: null, count: 0 })
      } else {
        const ds = d.format('YYYY-MM-DD')
        col.push({ date: ds, count: data[ds] ?? 0 })
      }
    }
    cols.push(col)
  }

  return (
    <div>
      {label && (
        <p className="mb-1.5 text-xs font-medium text-secondary">{label}</p>
      )}
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]">
          {cols.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((cell, ri) => {
                if (!cell.date)
                  return <div key={ri} className="h-[11px] w-[11px]" />
                const lv = level(cell.count)
                return (
                  <div
                    key={ri}
                    title={`${cell.date} · ${cell.count} 次`}
                    className="h-[11px] w-[11px] rounded-[3px]"
                    style={{
                      background:
                        lv === 0
                          ? 'var(--mf-trough)'
                          : `rgb(var(--mf-accent-soft) / ${LEVEL_ALPHA[lv]})`,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
