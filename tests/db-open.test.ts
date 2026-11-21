import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const OPEN = resolve('lib/db/open.ts')

function runChild(code: string, env: Record<string, string>): Promise<{ code: number; err: string }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      env: { ...process.env, ...env },
    })
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    child.on('close', (c) => done({ code: c ?? 1, err }))
  })
}

// 复现 next build：十几个 worker 同一时刻打开同一个新库并切 WAL
test('many processes can open a brand-new database at the same instant', { timeout: 60_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gancook-open-'))
  const db = join(dir, 'app.db')
  const startAt = String(Date.now() + 3000)
  const code = `
    import { openDatabase } from ${JSON.stringify(OPEN)}
    while (Date.now() < Number(process.env.START_AT)) {}
    const sqlite = openDatabase(process.env.DB)
    if (sqlite.pragma('journal_mode', { simple: true }) !== 'wal') process.exit(2)
    sqlite.prepare('create table if not exists t (x)').run()
    sqlite.close()
  `
  const results = await Promise.all(
    Array.from({ length: 12 }, () => runChild(code, { DB: db, START_AT: startAt })),
  )
  const failed = results.filter((r) => r.code !== 0)
  assert.equal(failed.length, 0, failed.map((f) => f.err).join('\n'))
})
