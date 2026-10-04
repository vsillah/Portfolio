// Disposable localhost PostgreSQL only. No env files, providers or credential broker.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
const modulePath = process.env.CAMPAIGN_TEST_POSTGRES_MODULE
if (!modulePath?.startsWith('/')) throw Error('Absolute disposable embedded-postgres module path required')
const { default: Postgres } = await import(pathToFileURL(modulePath).href)
const directory = await mkdtemp(join(tmpdir(), 'campaign-reconciliation-pg-'))
const pg = new Postgres({ databaseDir: join(directory, 'data'), user: 'postgres', password: 'local-synthetic-only',
  port: 15492, persistent: false, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} })
let code = 1
try {
  await pg.initialise(); await pg.start()
  const client = pg.getPgClient(); await client.connect()
  try {
    await client.query('create role anon; create role authenticated; create role service_role bypassrls; create role campaign_repair_unrelated')
    console.log('Database engine:', (await client.query('select version()')).rows[0].version)
  } finally { await client.end() }
  for (const mode of ['skipped_phase6', 'full_sequence']) await pg.createDatabase(`campaign_repair_${mode}`)
  const child = spawn(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--reporter=verbose', 'lib/campaign-authority-reconciliation.test.ts'], {
    stdio: 'inherit', env: { PATH: process.env.PATH, HOME: process.env.HOME,
      CAMPAIGN_RECONCILIATION_TEST_URL: 'postgresql://postgres:local-synthetic-only@127.0.0.1:15492/postgres' },
  })
  const result = await new Promise(resolve => child.on('exit', resolve))
  code = typeof result === 'number' ? result : 1
} finally { await pg.stop().catch(() => {}) }
process.exit(code)
