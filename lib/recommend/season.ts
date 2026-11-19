/**
 * 时令：节气、季节、应季食材。纯函数，便于测试。
 * 节气日期取 21 世纪常见日期（实际年份可能 ±1 天，用于推荐足够）。
 */

type Term = { m: number; d: number; zh: string; en: string }

const TERMS: Term[] = [
  { m: 1, d: 5, zh: '小寒', en: 'Minor Cold' },
  { m: 1, d: 20, zh: '大寒', en: 'Major Cold' },
  { m: 2, d: 4, zh: '立春', en: 'Start of Spring' },
  { m: 2, d: 19, zh: '雨水', en: 'Rain Water' },
  { m: 3, d: 5, zh: '惊蛰', en: 'Awakening of Insects' },
  { m: 3, d: 20, zh: '春分', en: 'Spring Equinox' },
  { m: 4, d: 4, zh: '清明', en: 'Clear and Bright' },
  { m: 4, d: 20, zh: '谷雨', en: 'Grain Rain' },
  { m: 5, d: 5, zh: '立夏', en: 'Start of Summer' },
  { m: 5, d: 21, zh: '小满', en: 'Grain Buds' },
  { m: 6, d: 5, zh: '芒种', en: 'Grain in Ear' },
  { m: 6, d: 21, zh: '夏至', en: 'Summer Solstice' },
  { m: 7, d: 7, zh: '小暑', en: 'Minor Heat' },
  { m: 7, d: 22, zh: '大暑', en: 'Major Heat' },
  { m: 8, d: 7, zh: '立秋', en: 'Start of Autumn' },
  { m: 8, d: 23, zh: '处暑', en: 'End of Heat' },
  { m: 9, d: 7, zh: '白露', en: 'White Dew' },
  { m: 9, d: 23, zh: '秋分', en: 'Autumn Equinox' },
  { m: 10, d: 8, zh: '寒露', en: 'Cold Dew' },
  { m: 10, d: 23, zh: '霜降', en: "Frost's Descent" },
  { m: 11, d: 7, zh: '立冬', en: 'Start of Winter' },
  { m: 11, d: 22, zh: '小雪', en: 'Minor Snow' },
  { m: 12, d: 7, zh: '大雪', en: 'Major Snow' },
  { m: 12, d: 21, zh: '冬至', en: 'Winter Solstice' },
]

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** 每月应季食材（中国大部分地区） */
const MONTHLY_PRODUCE: Record<number, string[]> = {
  1: ['白菜', '萝卜', '菠菜', '冬笋', '蒜苗', '莲藕', '芥蓝'],
  2: ['白菜', '萝卜', '菠菜', '韭菜', '蒜苗', '荠菜'],
  3: ['春笋', '韭菜', '荠菜', '香椿', '菠菜', '豌豆苗', '莴笋'],
  4: ['春笋', '香椿', '豌豆', '蚕豆', '莴笋', '芦笋', '韭菜'],
  5: ['蚕豆', '豌豆', '芦笋', '黄瓜', '苋菜', '西葫芦', '小龙虾'],
  6: ['黄瓜', '丝瓜', '苦瓜', '茄子', '豇豆', '毛豆', '番茄', '西红柿', '空心菜', '小龙虾'],
  7: ['冬瓜', '丝瓜', '苦瓜', '茄子', '豇豆', '毛豆', '番茄', '西红柿', '空心菜', '玉米'],
  8: ['冬瓜', '苦瓜', '茄子', '玉米', '毛豆', '莲藕', '南瓜', '秋葵'],
  9: ['莲藕', '南瓜', '山药', '芋头', '螃蟹', '大闸蟹', '栗子', '秋葵'],
  10: ['山药', '芋头', '南瓜', '莲藕', '螃蟹', '大闸蟹', '栗子', '萝卜', '花生'],
  11: ['白菜', '萝卜', '山药', '莲藕', '冬笋', '菠菜', '羊肉'],
  12: ['白菜', '萝卜', '冬笋', '菠菜', '羊肉', '芥蓝', '蒜苗'],
}

/** 天热 / 天冷时更合适的做法关键字 */
const HOT_STYLE = /凉拌|凉皮|凉面|冷面|绿豆|冬瓜|苦瓜|拍黄瓜|酸梅|salad|cold|cucumber/i
const COLD_STYLE = /炖|煲|焖|火锅|羊肉|砂锅|姜|stew|braise|hot ?pot/i

function parseDate(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number)
  return { y, m, d }
}

/** 当前所处节气（最近一个已到的节气） */
export function solarTerm(date: string): Term {
  const { m, d } = parseDate(date)
  let current = TERMS[TERMS.length - 1] // 1 月 5 日前仍是上一年的冬至
  for (const term of TERMS) {
    if (m > term.m || (m === term.m && d >= term.d)) current = term
  }
  return current
}

/** 按节气划分四季（立春 / 立夏 / 立秋 / 立冬 起） */
export function seasonOf(date: string): Season {
  const { m, d } = parseDate(date)
  const after = (tm: number, td: number) => m > tm || (m === tm && d >= td)
  if (after(11, 7) || !after(2, 4)) return 'winter'
  if (after(8, 7)) return 'autumn'
  if (after(5, 5)) return 'summer'
  return 'spring'
}

/** 体感：6–9 月偏热，11–2 月偏冷（饮食上「清爽 / 暖和」用这个，比节气更贴近实际） */
export function weatherFeel(date: string): 'hot' | 'cold' | 'mild' {
  const { m } = parseDate(date)
  if (m >= 6 && m <= 9) return 'hot'
  if (m >= 11 || m <= 2) return 'cold'
  return 'mild'
}

export function seasonalProduce(date: string): string[] {
  return MONTHLY_PRODUCE[parseDate(date).m] ?? []
}

/** 文本里出现的应季食材（取第一个命中的） */
export function seasonalHit(text: string, date: string): string | null {
  for (const p of seasonalProduce(date)) if (text.includes(p)) return p
  return null
}

/** 做法是否契合当下冷热 */
export function weatherHit(text: string, date: string): 'hot' | 'cold' | null {
  const feel = weatherFeel(date)
  if (feel === 'hot' && HOT_STYLE.test(text)) return 'hot'
  if (feel === 'cold' && COLD_STYLE.test(text)) return 'cold'
  return null
}

export function seasonLabel(date: string, locale: 'zh' | 'en'): string {
  const term = solarTerm(date)
  const season = seasonOf(date)
  const names = {
    zh: { spring: '春', summer: '夏', autumn: '秋', winter: '冬' },
    en: { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' },
  }
  return locale === 'zh'
    ? `${term.zh} · ${names.zh[season]}季`
    : `${term.en} · ${names.en[season]}`
}
