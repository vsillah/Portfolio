// Optional disposable local runner. Install embedded-postgres outside the repo;
// pass its absolute module path as CAMPAIGN_TEST_POSTGRES_MODULE. No env files.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
const modulePath = process.env.CAMPAIGN_TEST_POSTGRES_MODULE
if (!modulePath?.startsWith('/')) throw new Error('Absolute disposable embedded-postgres module path required')
const { default: Postgres } = await import(pathToFileURL(modulePath).href)
const directory = await mkdtemp(join(tmpdir(), 'campaign-atomic-pg-'))
const pg = new Postgres({ databaseDir: join(directory, 'data'), user: 'postgres', password: 'local-synthetic-only', port: 15487,
  persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} })
let resultCode = 0
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('campaign_phase7_test')
  const child = spawn(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', 'lib/campaign-release-atomic-recovery.test.ts'], {
    stdio: 'inherit', env: { PATH: process.env.PATH, HOME: process.env.HOME,
      CAMPAIGN_ATOMIC_TEST_URL: 'postgresql://postgres:local-synthetic-only@127.0.0.1:15487/campaign_phase7_test' },
  })
  const code = await new Promise(resolve => child.on('exit', resolve))
  if (code !== 0) resultCode = Number(code) || 1
  // A physical restart verifies the durable authorization survived process loss.
  await pg.stop(); await pg.start()
  const client = pg.getPgClient(); await client.connect()
  const databases = await client.query("select datname from pg_database where datname = 'campaign_phase7_test'")
  if (databases.rowCount !== 1) throw new Error('Restart lost database')
  await client.end()
  // Test suite writes its expected final snapshot and verifies it via a fresh process.
  const check = spawn(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/qa/campaign-atomic-recovery-restart.ts'], {
    stdio: 'inherit', env: { PATH: process.env.PATH, HOME: process.env.HOME,
      CAMPAIGN_ATOMIC_TEST_URL: 'postgresql://postgres:local-synthetic-only@127.0.0.1:15487/campaign_phase7_test' },
  })
  if (await new Promise(resolve => check.on('exit', resolve)) !== 0) resultCode = 1
  console.log('Disposable PostgreSQL data:', directory)
} finally { await pg.stop().catch(() => {}) }

process.exit(resultCode)
