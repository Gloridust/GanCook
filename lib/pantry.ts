/**
 * 家里库存：输入校验与展示用的纯函数（服务端 / 客户端 / 开放 API 共用）。
 */
import { daysBetween } from '@/lib/recommend/rules'
import { isValidDate } from '@/lib/date-input'

export const PANTRY_LOCATIONS = ['fridge', 'freezer', 'pantry'] as const
export type PantryLocation = (typeof PANTRY_LOCATIONS)[number]

/** 常用单位（点一下即可） */
export const PANTRY_UNITS_ZH = ['个', '斤', '克', '盒', '袋', '瓶', '把', '根']
export const PANTRY_UNITS_EN = ['pcs', 'g', 'kg', 'lb', 'box', 'bag', 'bottle', 'bunch']

export type PantryInput = {
  name: string
  quantity: number | null
  unit: string | null
  location: PantryLocation
  expiresOn: string | null
  note: string | null
}

export type PantryInputError =
  | 'nameRequired'
  | 'nameTooLong'
  | 'quantityInvalid'
  | 'dateInvalid'
  | 'locationInvalid'

/** 校验并规整库存输入；raw 来自表单或 API JSON */
export function normalizePantryInput(
  raw: Record<string, unknown>,
): { ok: true; value: PantryInput } | { ok: false; error: PantryInputError } {
  const name = String(raw.name ?? '').trim()
  if (!name) return { ok: false, error: 'nameRequired' }
  if (name.length > 30) return { ok: false, error: 'nameTooLong' }

  let quantity: number | null = null
  if (raw.quantity !== undefined && raw.quantity !== null && raw.quantity !== '') {
    const q = Number(raw.quantity)
    if (!Number.isFinite(q) || q < 0 || q > 99_999)
      return { ok: false, error: 'quantityInvalid' }
    quantity = Math.round(q * 100) / 100
  }

  const location = (raw.location ?? 'fridge') as PantryLocation
  if (!PANTRY_LOCATIONS.includes(location))
    return { ok: false, error: 'locationInvalid' }

  let expiresOn: string | null = null
  if (raw.expiresOn) {
    const s = String(raw.expiresOn).trim()
    if (!isValidDate(s)) return { ok: false, error: 'dateInvalid' }
    expiresOn = s
  }

  const unit = String(raw.unit ?? '').trim().slice(0, 10) || null
  const note = String(raw.note ?? '').trim().slice(0, 100) || null
  return { ok: true, value: { name, quantity, unit, location, expiresOn, note } }
}

/** 保质期状态：expired 已过期 / soon 3 天内 / ok / none 未填 */
export function expiryState(
  expiresOn: string | null | undefined,
  today: string,
): { state: 'expired' | 'soon' | 'ok' | 'none'; days: number | null } {
  if (!expiresOn) return { state: 'none', days: null }
  const days = daysBetween(today, expiresOn)
  if (days < 0) return { state: 'expired', days }
  if (days <= 3) return { state: 'soon', days }
  return { state: 'ok', days }
}

/** 数量展示：6 个 / 1.5 斤 / 空 */
export function fmtQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null || quantity === undefined) return unit ?? ''
  return unit ? `${quantity} ${unit}` : String(quantity)
}
