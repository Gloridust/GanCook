import assert from 'node:assert/strict'
import test from 'node:test'
import { dishEmoji, matchDish, tagStats } from '../lib/dish-categories'

test('dishEmoji prefers concrete food in the name, then tags', () => {
  assert.equal(dishEmoji(['荤菜'], '可乐鸡翅'), '🍗')
  assert.equal(dishEmoji(['荤菜'], '清蒸鲈鱼'), '🐟')
  // 「鱼香肉丝」没有鱼
  assert.equal(dishEmoji(['荤菜'], '鱼香肉丝'), '🍖')
  assert.equal(dishEmoji(['汤'], '番茄蛋花汤'), '🍲')
  assert.equal(dishEmoji(['Dessert'], 'Tiramisu'), '🍮')
  assert.equal(dishEmoji([], '神秘料理'), '🍽️')
})

test('tagStats orders by frequency', () => {
  const stats = tagStats([
    { tags: ['素菜'] },
    { tags: ['荤菜', '辣'] },
    { tags: ['荤菜'] },
    { tags: null },
  ])
  assert.deepEqual(stats[0], { tag: '荤菜', count: 2 })
  assert.equal(stats.length, 3)
})

test('matchDish searches name, description and tags with AND semantics', () => {
  const d = { name: '水煮牛肉', description: '麻辣鲜香', tags: ['荤菜', '辣'] }
  assert.ok(matchDish(d, ''))
  assert.ok(matchDish(d, '牛肉'))
  assert.ok(matchDish(d, '荤菜 辣'))
  assert.ok(matchDish(d, '麻辣'))
  assert.ok(!matchDish(d, '牛肉 汤'))
})
