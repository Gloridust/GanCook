import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

test('database migrations add the nullable dishes.instructions column', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gancook-migration-'))
  const sqlite = new Database(join(dir, 'app.db'))
  try {
    migrate(drizzle(sqlite), { migrationsFolder: join(process.cwd(), 'drizzle') })
    const columns = sqlite
      .prepare('pragma table_info(dishes)')
      .all() as Array<{ name: string; notnull: number }>
    const instructions = columns.find((column) => column.name === 'instructions')

    assert.deepEqual(instructions && {
      name: instructions.name,
      notnull: instructions.notnull,
    }, {
      name: 'instructions',
      notnull: 0,
    })
  } finally {
    sqlite.close()
  }
})
