// Optional disposable local runner. Install embedded-postgres outside the repo;
// pass its absolute module path as CAMPAIGN_TEST_POSTGRES_MODULE. No env files.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const modulePath = process.env.CAMPAIGN_TEST_POSTGRES_MODULE
if (!modulePath?.startsWith('/')) throw new Error('Absolute disposable embedded-postgres module path required')
const { default: Postgres } = await import(pathToFileURL(modulePath).href)
const directory = await mkdtemp(join(tmpdir(), 'campaign-atomic-pg-'))
const pg = new Postgres({ databaseDir: join(directory, 'data'), user: 'postgres', password: 'local-synthetic-only', port: 15488,
  persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} })
const { Client } = createRequire(import.meta.url)('pg')
async function evidence() {
  const client = new Client({ connectionString: 'postgresql://postgres:local-synthetic-only@127.0.0.1:15488/campaign_phase8_test' })
  await client.connect()
  try {
    const result = {}
    for (const table of ['campaign_execution_journal','campaign_provider_qualifications','campaign_provider_qualification_receipts','campaign_provider_certifications','campaign_provider_certification_revocations']) {
      result[table] = (await client.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows
    }
    return result
  } finally { await client.end() }
}
let resultCode = 0
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('campaign_phase8_test')
  const child = spawn(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', 'lib/campaign-release-provider-certification.test.ts'], {
    stdio: 'inherit', env: { PATH: process.env.PATH, HOME: process.env.HOME,
      CAMPAIGN_CERTIFICATION_TEST_URL: 'postgresql://postgres:local-synthetic-only@127.0.0.1:15488/campaign_phase8_test' },
  })
  const code = await new Promise(resolve => child.on('exit', resolve))
  if (code !== 0) resultCode = Number(code) || 1
  const before = await evidence()
  // A physical restart verifies the durable authorization survived process loss.
  await pg.stop(); await pg.start()
  const client = pg.getPgClient(); await client.connect()
  const databases = await client.query("select datname from pg_database where datname = 'campaign_phase8_test'")
  if (databases.rowCount !== 1) throw new Error('Restart lost database')
  await client.end()
  assert.deepEqual(await evidence(), before)
  console.log('Physical restart: journal and all qualification, receipt, certification and revocation rows identical.')
  console.log('Disposable PostgreSQL data:', directory)
} finally { await pg.stop().catch(() => {}) }

process.exit(resultCode)
