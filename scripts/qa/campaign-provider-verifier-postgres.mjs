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
const pg = new Postgres({ databaseDir: join(directory, 'data'), user: 'postgres', password: 'local-synthetic-only', port: 15490,
  persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} })
const { Client } = createRequire(import.meta.url)('pg')
async function evidence() {
  const client = new Client({ connectionString: 'postgresql://postgres:local-synthetic-only@127.0.0.1:15490/campaign_phase10_test' })
  await client.connect()
  try {
    const result = {}
    for (const table of ['campaign_execution_journal','campaign_provider_qualifications','campaign_provider_qualification_receipts','campaign_provider_certifications','campaign_provider_certification_revocations','campaign_provider_attempt_bindings','campaign_provider_adoptions','campaign_provider_resource_claims','campaign_verifier.evidence','campaign_verifier.authorizations','campaign_verifier.identities','campaign_verifier.credential_references']) {
      result[table] = (await client.query(`select to_jsonb(t) row from ${table.includes('.') ? table : `public.${table}`} t order by to_jsonb(t)::text`)).rows
    }
    return result
  } finally { await client.end() }
}
let resultCode = 0
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('campaign_phase10_test')
  const child = spawn(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--reporter=verbose', 'lib/campaign-release-provider-verifier.test.ts'], {
    stdio: 'inherit', env: { PATH: process.env.PATH, HOME: process.env.HOME,
      CAMPAIGN_VERIFIER_TEST_URL: 'postgresql://postgres:local-synthetic-only@127.0.0.1:15490/campaign_phase10_test' },
  })
  const code = await new Promise(resolve => child.on('exit', resolve))
  if (code !== 0) resultCode = Number(code) || 1
  const before = await evidence()
  // A physical restart verifies the durable authorization survived process loss.
  await pg.stop(); await pg.start()
  const client = pg.getPgClient(); await client.connect()
  const databases = await client.query("select datname from pg_database where datname = 'campaign_phase10_test'")
  if (databases.rowCount !== 1) throw new Error('Restart lost database')
  await client.end()
  assert.deepEqual(await evidence(), before)
  const replay = new Client({ connectionString: 'postgresql://postgres:local-synthetic-only@127.0.0.1:15490/campaign_phase10_test' })
  await replay.connect()
  try {
    const rows = (await replay.query(`select a.request, r.request as observation from campaign_provider_adoptions a
      join campaign_provider_qualification_receipts r using(receipt_id)`)).rows
    assert.ok(rows.length > 0)
    const verifier = new Client({connectionString:'postgresql://synthetic_verifier:local-synthetic-only@127.0.0.1:15490/campaign_phase10_test'})
    await verifier.connect()
    try {
      for (const row of rows) {
        const o=row.observation
        const request={...row.request, observation:{scopeDigest:o.scopeDigest,resourceDigest:o.resourceDigest,evidenceDigest:o.evidenceDigest,
          observedAt:o.observedAt,status:o.outcome,spentCents:o.spentCents,readbackComplete:o.readbackComplete,noDeliveryProven:o.noDeliveryProven}}
        const saved=(await replay.query('select result from campaign_verifier.evidence where command_id=$1',[request.commandId])).rows[0].result
        assert.deepEqual((await verifier.query('select campaign_verifier.ingest($1) result',[request])).rows[0].result,saved)
      }
    } finally {await verifier.end()}
    assert.deepEqual(await evidence(),before)
  } finally { await replay.end() }
  console.log('Post-restart exact verifier retry: identical historical result, no additional ledger writes.')
  console.log('Physical restart: journal and all qualification, receipt, certification and revocation rows identical.')
  console.log('Disposable PostgreSQL data:', directory)
} finally { await pg.stop().catch(() => {}) }

process.exit(resultCode)
