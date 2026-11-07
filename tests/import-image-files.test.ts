import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  cleanupExpiredImportFiles,
  promoteImportFile,
} from '../lib/recipe/import-image-files'

test('promoteImportFile atomically allows a temporary image to be consumed once', async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), 'gancook-import-'))
  const importsDir = join(uploadDir, 'imports')
  await mkdir(importsDir)
  const temporaryPath =
    'imports/123e4567-e89b-12d3-a456-426614174000.webp'
  await writeFile(join(uploadDir, temporaryPath), 'image')

  const results = await Promise.allSettled([
    promoteImportFile(uploadDir, temporaryPath),
    promoteImportFile(uploadDir, temporaryPath),
  ])
  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<string> =>
      result.status === 'fulfilled',
  )
  const rejected = results.filter((result) => result.status === 'rejected')

  assert.equal(fulfilled.length, 1)
  assert.equal(rejected.length, 1)
  assert.match(fulfilled[0].value, /^dishes\/[0-9a-f-]+\.webp$/)
  assert.equal(
    await readFile(join(uploadDir, fulfilled[0].value), 'utf8'),
    'image',
  )
})

test('cleanupExpiredImportFiles removes expired files and preserves fresh files', async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), 'gancook-import-'))
  const importsDir = join(uploadDir, 'imports')
  await mkdir(importsDir)
  const expired = join(importsDir, 'expired.webp')
  const fresh = join(importsDir, 'fresh.webp')
  await writeFile(expired, 'old')
  await writeFile(fresh, 'new')
  await utimes(expired, new Date(1_000), new Date(1_000))
  await utimes(fresh, new Date(9_000), new Date(9_000))

  await cleanupExpiredImportFiles(uploadDir, 5_000, 10_000)

  await assert.rejects(stat(expired))
  assert.equal((await stat(fresh)).isFile(), true)
})
