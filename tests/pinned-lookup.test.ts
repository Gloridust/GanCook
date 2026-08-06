import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinnedLookup } from '../lib/net/pinned-lookup'

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | Array<{ address: string; family: number }>,
  family?: number,
) => void

function runLookup(
  lookup: Awaited<ReturnType<typeof createPinnedLookup>>,
  options: { all?: boolean },
): Promise<{
  address: string | Array<{ address: string; family: number }>
  family?: number
}> {
  return new Promise((resolve, reject) => {
    ;(
      lookup as unknown as (
        hostname: string,
        options: { all?: boolean },
        callback: LookupCallback,
      ) => void
    )('recipes.example', options, (error, address, family) => {
      if (error) reject(error)
      else resolve({ address, family })
    })
  })
}

test('pinned lookup honors Node all:true while returning only the pinned address', async () => {
  const pinned = await createPinnedLookup(
    new URL('https://recipes.example/dish'),
    async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ],
  )

  assert.deepEqual(await runLookup(pinned, { all: true }), {
    address: [{ address: '93.184.216.34', family: 4 }],
    family: undefined,
  })
  assert.deepEqual(await runLookup(pinned, {}), {
    address: '93.184.216.34',
    family: 4,
  })
})

test('pinned lookup keeps rejecting DNS results containing a private address', async () => {
  await assert.rejects(
    createPinnedLookup(new URL('https://recipes.example/dish'), async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]),
    /UNSAFE_URL/,
  )
})

test('pinned lookup can rotate across validated public addresses', async () => {
  const resolver = async () => [
    { address: '93.184.216.34', family: 4 },
    { address: '93.184.216.35', family: 4 },
  ]
  const first = await createPinnedLookup(
    new URL('https://recipes.example/dish'),
    { resolveAddresses: resolver, addressIndex: 0 },
  )
  const second = await createPinnedLookup(
    new URL('https://recipes.example/dish'),
    { resolveAddresses: resolver, addressIndex: 1 },
  )

  assert.deepEqual(await runLookup(first, { all: true }), {
    address: [{ address: '93.184.216.34', family: 4 }],
    family: undefined,
  })
  assert.deepEqual(await runLookup(second, { all: true }), {
    address: [{ address: '93.184.216.35', family: 4 }],
    family: undefined,
  })
})
