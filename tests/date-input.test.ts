import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidDate, isValidTime } from '../lib/date-input'

test('isValidDate rejects dates that would roll over to another day', () => {
  assert.ok(isValidDate('2026-11-20'))
  assert.ok(isValidDate('2028-02-29'))
  for (const bad of ['2026-02-31', '2026-13-01', '2026-00-10', '2027-02-29', '2026-1-1', '20261120', ''])
    assert.equal(isValidDate(bad), false, bad)
})

test('isValidTime only accepts 00:00–23:59', () => {
  for (const ok of ['00:00', '12:30', '23:59']) assert.ok(isValidTime(ok), ok)
  for (const bad of ['24:00', '25:99', '12:60', '7:30', '12:3', '']) assert.equal(isValidTime(bad), false, bad)
})
