/**
 * 菜品分类 = 标签（dishes.tags）。这里放纯函数，服务端与客户端共用。
 * 不新建分类表：家里用的分类各不相同（荤素汤 / 苏帮菜 / 宝宝辅食…），标签最灵活。
 */

/** 添加菜品时的快捷标签（点一下即可，不用打字） */
export const PRESET_TAGS = [
  '荤菜',
  '素菜',
  '汤',
  '主食',
  '凉菜',
  '早餐',
  '甜点',
  '海鲜',
  '辣',
] as const

export const PRESET_TAGS_EN = [
  'Meat',
  'Veggie',
  'Soup',
  'Staple',
  'Cold dish',
  'Breakfast',
  'Dessert',
  'Seafood',
  'Spicy',
] as const

/** 按标签关键字推断一个代表 emoji（无图菜品的占位，比统一的灰碗更好认） */
const EMOJI_RULES: [RegExp, string][] = [
  [/汤|羹|soup/i, '🍲'],
  [/海鲜|鱼|虾|蟹|贝|seafood|fish|shrimp/i, '🦐'],
  [/早餐|早点|包子|饺|breakfast/i, '🥟'],
  [/主食|面|饭|粉|饼|staple|noodle|rice/i, '🍚'],
  [/甜|点心|dessert|sweet|cake/i, '🍮'],
  [/凉菜|凉拌|cold|salad/i, '🥒'],
  [/饮|茶|汁|drink|juice/i, '🥤'],
  [/素|蔬|菌|豆腐|veg/i, '🥬'],
  [/荤|肉|鸡|鸭|牛|羊|猪|排骨|meat|chicken|beef|pork/i, '🍖'],
]

/** 菜名里的具体食材（比分类更具体，先匹配）。「鱼香肉丝」里没有鱼，单独排除 */
const NAME_RULES: [RegExp, string][] = [
  [/汤|羹/, '🍲'],
  [/粥/, '🥣'],
  [/面|粉丝|米线/, '🍜'],
  [/饺|包子|小笼|馄饨|盒子/, '🥟'],
  [/饭/, '🍚'],
  [/虾/, '🦐'],
  [/蟹/, '🦀'],
  [/鱼(?!香)/, '🐟'],
  // 「鸡蛋饼」「鸡蛋」不是鸡肉：饼、蛋要排在鸡前面
  [/饼/, '🫓'],
  [/蛋/, '🍳'],
  [/鸡|鸭|鹅/, '🍗'],
  [/牛/, '🥩'],
  [/排骨|猪|肉|羊/, '🍖'],
  [/玉米/, '🌽'],
  [/土豆|马铃薯/, '🥔'],
  [/番茄|西红柿/, '🍅'],
  [/西兰花|花菜/, '🥦'],
  [/茄子/, '🍆'],
  [/黄瓜/, '🥒'],
  [/菇|蘑/, '🍄'],
  [/豆浆|油条/, '🥛'],
  [/奶|西米露|布丁/, '🍮'],
  [/菜|豆/, '🥬'],
]

export function dishEmoji(tags: string[] | null | undefined, name = ''): string {
  for (const [re, emoji] of NAME_RULES) if (re.test(name)) return emoji
  const tagText = (tags ?? []).join(' ')
  for (const [re, emoji] of EMOJI_RULES) if (re.test(tagText)) return emoji
  for (const [re, emoji] of EMOJI_RULES) if (re.test(name)) return emoji
  return '🍽️'
}

/** 柔和的占位底色（按名字稳定散列），让一屏无图菜品也有节奏感 */
const TILE_HUES = [140, 32, 200, 350, 90, 260, 18, 170]
export function dishTileHue(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return TILE_HUES[h % TILE_HUES.length]
}

/** 统计菜品库里的标签，按出现次数降序（同数按预设顺序/字典序） */
export function tagStats(
  dishes: { tags: string[] | null }[],
): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const d of dishes)
    for (const t of d.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
  const presetRank = (t: string) => {
    const i = (PRESET_TAGS as readonly string[]).indexOf(t)
    return i < 0 ? 99 : i
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        presetRank(a.tag) - presetRank(b.tag) ||
        a.tag.localeCompare(b.tag, 'zh'),
    )
}

/** 搜索：菜名 / 简介 / 标签，空格分隔的多个词需同时命中 */
export function matchDish(
  dish: { name: string; description?: string | null; tags: string[] | null },
  query: string,
): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const hay = [dish.name, dish.description ?? '', ...(dish.tags ?? [])]
    .join(' ')
    .toLowerCase()
  return words.every((w) => hay.includes(w))
}
