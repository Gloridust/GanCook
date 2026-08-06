import assert from 'node:assert/strict'
import test from 'node:test'
import { logRecipeImportFailure } from '../lib/recipe/import-log'

test('recipe import failure logging is structured and does not leak sensitive details', () => {
  const original = console.error
  const calls: unknown[][] = []
  console.error = (...args: unknown[]) => calls.push(args)

  try {
    const error = Object.assign(
      new Error('request failed with Authorization: Bearer super-secret'),
      { code: 'ERR_INVALID_IP_ADDRESS' },
    )
    logRecipeImportFailure(
      'page_fetch',
      'https://recipes.example/private/path?token=super-secret',
      error,
    )
  } finally {
    console.error = original
  }

  assert.deepEqual(calls, [
    [
      '[recipe-import]',
      {
        event: 'recipe_import_failed',
        stage: 'page_fetch',
        hostname: 'recipes.example',
        code: 'ERR_INVALID_IP_ADDRESS',
      },
    ],
  ])
  const serialized = JSON.stringify(calls)
  assert.equal(serialized.includes('/private/path'), false)
  assert.equal(serialized.includes('super-secret'), false)
  assert.equal(serialized.includes('Authorization'), false)
})
