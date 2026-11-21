import assert from 'node:assert/strict'
import test from 'node:test'
import { seasonLabel, seasonOf, solarTerm, weatherFeel } from '../lib/recommend/season'
import {
  ANY_TAG,
  pantryMatches,
  planToSlots,
  rulePick,
  type RecDish,
} from '../lib/recommend/rules'
import {
  buildRecommendPrompt,
  parseRecommendOutput,
  remainingSlots,
} from '../lib/recommend/llm'

const dishes: RecDish[] = [
  { id: 'a', name: '番茄炒蛋', tags: ['素菜'], description: '下饭' },
  { id: 'b', name: '红烧肉', tags: ['荤菜'], instructions: '五花肉焯水后炖一小时' },
  { id: 'c', name: '冬瓜排骨汤', tags: ['汤', '荤菜'] },
  { id: 'd', name: '清炒菠菜', tags: ['素菜'] },
  { id: 'e', name: '可乐鸡翅', tags: ['荤菜'] },
]

test('solar terms and seasons follow the traditional calendar', () => {
  assert.equal(solarTerm('2026-01-03').zh, '冬至')
  assert.equal(solarTerm('2026-02-04').zh, '立春')
  assert.equal(solarTerm('2026-11-20').zh, '立冬')
  assert.equal(seasonOf('2026-08-07'), 'autumn')
  assert.equal(seasonOf('2026-02-03'), 'winter')
  assert.equal(weatherFeel('2026-07-15'), 'hot')
  assert.equal(seasonLabel('2026-11-23', 'zh'), '小雪 · 冬季')
  assert.equal(seasonLabel('2026-03-21', 'en'), 'Spring Equinox · Spring')
})

test('pantry matching understands synonyms and skips expired or empty items', () => {
  const pantry = [
    { name: '西红柿', expiresOn: '2026-11-21' },
    { name: '五花肉', expiresOn: '2026-11-01' }, // 已过期
    { name: '鸡蛋', quantity: 0 }, // 吃完了
  ]
  const hits = pantryMatches(dishes[0], pantry, '2026-11-20')
  assert.deepEqual(hits.map((h) => h.item.name), ['西红柿'])
  assert.equal(hits[0].daysLeft, 1)
  assert.equal(pantryMatches(dishes[1], pantry, '2026-11-20').length, 0)
})

test('planToSlots puts specific tags before "any" and drops zeros', () => {
  assert.deepEqual(planToSlots({ [ANY_TAG]: 2, 荤菜: 1, 汤: 0, 素菜: 99 }), [
    { tag: '荤菜', count: 1 },
    { tag: '素菜', count: 6 },
    { tag: ANY_TAG, count: 2 },
  ])
})

test('rulePick honours the plan, avoids duplicates and prefers expiring pantry items', () => {
  const picks = rulePick({
    dishes,
    slots: planToSlots({ 荤菜: 2, 素菜: 1 }),
    pantry: [{ name: '番茄', expiresOn: '2026-11-21' }],
    recentIds: [],
    excludeIds: ['e'],
    date: '2026-11-20',
    random: () => 0,
  })
  assert.equal(picks.length, 3)
  assert.equal(new Set(picks.map((p) => p.id)).size, 3)
  assert.ok(!picks.some((p) => p.id === 'e'))
  const veg = picks.find((p) => p.id === 'a')
  assert.ok(veg, 'tomato dish should win the veggie slot')
  assert.deepEqual(veg.reasons[0], { kind: 'expiring', item: '番茄' })
})

test('LLM prompt uses short codes and parse validates them against slots', () => {
  const slots = planToSlots({ 荤菜: 1, 素菜: 1 })
  const prompt = buildRecommendPrompt({
    locale: 'zh',
    date: '2026-11-20',
    seasonLabel: '立冬 · 冬季',
    mealType: 'dinner',
    slots,
    dishes,
    pantry: [],
    recentNames: [],
    excludeIds: new Set(),
  })
  assert.ok(!prompt.user.includes('"a"'))
  const codeOf = (id: string) => [...prompt.idMap].find(([, v]) => v === id)![0]
  const raw = `<think>想想</think>\n\`\`\`json\n${JSON.stringify({
    picks: [
      { id: codeOf('b'), reason: '暖和' },
      { id: codeOf('e'), reason: '第二道荤菜，超出配方' },
      { id: 'd999', reason: '编造的' },
      { id: codeOf('d'), reason: '应季菠菜' },
    ],
    summary: '一荤一素',
  })}\n\`\`\``
  const out = parseRecommendOutput(raw, { idMap: prompt.idMap, slots, dishes })
  assert.deepEqual(out.picks.map((p) => p.id), ['b', 'd'])
  assert.equal(out.summary, '一荤一素')
  assert.deepEqual(remainingSlots(slots, out.picks.slice(0, 1), dishes), [
    { tag: '素菜', count: 1 },
  ])
})

test('parseRecommendOutput rejects non-JSON output', () => {
  assert.throws(
    () => parseRecommendOutput('抱歉，我无法回答', { idMap: new Map(), slots: [], dishes }),
    /LLM_INVALID_JSON/,
  )
})

test('staples and single-character items only count when they are in the dish name', () => {
  const braise: RecDish = {
    id: 'x',
    name: '红烧肉',
    tags: ['荤菜'],
    instructions: '加盐、生抽、料酒、葱姜蒜，再放两个鸡蛋',
  }
  const pantry = [{ name: '盐' }, { name: '生抽' }, { name: '葱' }, { name: '鸡蛋' }]
  // 鸡蛋（非调味料、两个字）照常按做法匹配；盐 / 生抽 / 葱 不算
  assert.deepEqual(pantryMatches(braise, pantry, '2026-11-20').map((h) => h.item.name), ['鸡蛋'])
  const scallionPancake: RecDish = { id: 'y', name: '葱油饼', tags: ['主食'] }
  assert.deepEqual(pantryMatches(scallionPancake, pantry, '2026-11-20').map((h) => h.item.name), ['葱'])
  // 「蛋」作为鸡蛋的别名只看菜名
  const soup: RecDish = { id: 'z', name: '紫菜汤', tags: ['汤'], instructions: '打入蛋液' }
  assert.equal(pantryMatches(soup, [{ name: '鸡蛋' }], '2026-11-20').length, 0)
})
