import assert from 'node:assert/strict'
import test from 'node:test'
import { expiryState, fmtQuantity, normalizePantryInput } from '../lib/pantry'
import { completionContent, jsonObjectFrom } from '../lib/llm/json'

test('normalizePantryInput validates and trims fields', () => {
  const ok = normalizePantryInput({
    name: ' 鸡蛋 ',
    quantity: '6',
    unit: '个',
    location: 'fridge',
    expiresOn: '2026-11-25',
    note: '',
  })
  assert.deepEqual(ok, {
    ok: true,
    value: { name: '鸡蛋', quantity: 6, unit: '个', location: 'fridge', expiresOn: '2026-11-25', note: null },
  })
  assert.deepEqual(normalizePantryInput({ name: '' }), { ok: false, error: 'nameRequired' })
  assert.deepEqual(normalizePantryInput({ name: 'x', quantity: -1 }), { ok: false, error: 'quantityInvalid' })
  assert.deepEqual(normalizePantryInput({ name: 'x', expiresOn: '2026-02-30' }), { ok: false, error: 'dateInvalid' })
  assert.deepEqual(normalizePantryInput({ name: 'x', location: 'garage' }), { ok: false, error: 'locationInvalid' })
  const blankQty = normalizePantryInput({ name: '葱', quantity: '' })
  assert.ok(blankQty.ok && blankQty.value.quantity === null)
})

test('expiryState and fmtQuantity', () => {
  assert.deepEqual(expiryState('2026-11-19', '2026-11-20'), { state: 'expired', days: -1 })
  assert.deepEqual(expiryState('2026-11-20', '2026-11-20'), { state: 'soon', days: 0 })
  assert.deepEqual(expiryState('2026-12-20', '2026-11-20'), { state: 'ok', days: 30 })
  assert.deepEqual(expiryState(null, '2026-11-20'), { state: 'none', days: null })
  assert.equal(fmtQuantity(1.5, '斤'), '1.5 斤')
  assert.equal(fmtQuantity(null, null), '')
})

test('LLM JSON helpers handle think tags, fences and content parts', () => {
  assert.equal(jsonObjectFrom('<think>{"no":1}</think>答案：{"a":1}'), '{"a":1}')
  assert.equal(jsonObjectFrom('```json\n{"a":2}\n```'), '{"a":2}')
  assert.equal(
    completionContent({ choices: [{ message: { content: [{ type: 'text', text: '{"x"' }, { type: 'text', text: ':1}' }] } }] }),
    '{"x":1}',
  )
  assert.equal(completionContent({}), null)
})
