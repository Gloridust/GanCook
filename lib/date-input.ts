/**
 * 日期 / 时间输入校验（纯函数）。只看格式不够：2026-02-31、25:99 这类
 * 会被 dayjs 宽松解析「滚」到别的日子，导致存下的日期和时间戳对不上。
 */
const reDate = /^\d{4}-\d{2}-\d{2}$/
const reTime = /^\d{2}:\d{2}$/

/** 真实存在的 YYYY-MM-DD */
export function isValidDate(s: string): boolean {
  if (!reDate.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** 00:00–23:59 的 HH:MM */
export function isValidTime(s: string): boolean {
  if (!reTime.test(s)) return false
  const [h, m] = s.split(':').map(Number)
  return h <= 23 && m <= 59
}
