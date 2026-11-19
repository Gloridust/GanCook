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

test('database migrations create pantry, notification and API token tables', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gancook-migration-'))
  const sqlite = new Database(join(dir, 'app.db'))
  try {
    migrate(drizzle(sqlite), { migrationsFolder: join(process.cwd(), 'drizzle') })
    const tables = (
      sqlite.prepare("select name from sqlite_master where type = 'table'").all() as Array<{ name: string }>
    ).map((t) => t.name)
    for (const name of ['pantry_items', 'notify_channels', 'api_tokens'])
      assert.ok(tables.includes(name), `missing table ${name}`)
    const reminded = (
      sqlite.prepare('pragma table_info(meals)').all() as Array<{ name: string; dflt_value: string }>
    ).find((c) => c.name === 'deadline_reminded')
    assert.equal(reminded?.dflt_value, 'false')
    // 旧数据升级后：已有饭局默认未提醒
    sqlite.prepare("insert into meals (id, meal_type, date, dining_time, order_deadline) values ('m', 'lunch', '2026-01-01', 1, 1)").run()
    assert.equal((sqlite.prepare("select deadline_reminded r from meals where id = 'm'").get() as { r: number }).r, 0)
  } finally {
    sqlite.close()
  }
})
