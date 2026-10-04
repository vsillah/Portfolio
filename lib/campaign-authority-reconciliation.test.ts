// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { approvalIdentity } from './campaign-release-activation'
import { emptyExecutionState } from './campaign-release-execution'
import {
  campaignActionKeys, campaignSourceFingerprint, canonicalReleaseValue,
  decideCampaignRelease, releaseHash, type ReleaseRecord,
} from './campaign-release-manifest'
import { fixture } from './campaign-release-test-fixture'

const migrationName = '20261004100212_campaign_authority_reconciliation.sql'
const readMigration = (name: string) => readFileSync(`supabase/migrations/${name}`, 'utf8')
const repair = readMigration(migrationName)
const phase6 = readMigration('20261003233618_campaign_atomic_sandbox_authority.sql')
const helpers = ['campaign_authority_json(jsonb)', 'campaign_authority_hash(jsonb)', 'campaign_authority_keys(jsonb,text)']
const authorize = 'campaign_authorize_sandbox_intent(jsonb)'
const commit = 'campaign_execution_commit(bigint,jsonb)'
const roles = ['anon', 'authenticated', 'service_role', 'campaign_repair_unrelated'] as const
const rootUrl = process.env.CAMPAIGN_RECONCILIATION_TEST_URL
const modes = ['skipped_phase6', 'full_sequence'] as const
const id = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`

function approvedFixture() {
  const now = Date.now(), manifest = fixture()
  manifest.createdAt = new Date(now - 60000).toISOString()
  manifest.expiresAt = new Date(now + 3600000).toISOString()
  manifest.actions[0].scheduledFor = new Date(now - 30000).toISOString()
  manifest.actions[0].evidenceExpiresAt = new Date(now + 3600000).toISOString()
  manifest.spendCapCents = 100; manifest.actions[0].maxSpendCents = 50
  const source = { id: manifest.actions[0].source.id, body: 'synthetic evidence', evidence: { approved: true } }
  manifest.actions[0].source.fingerprint = campaignSourceFingerprint(source)
  const pending: ReleaseRecord = { manifest, hash: releaseHash(manifest), state: 'pending', version: 1, audit: [] }
  const record = decideCampaignRelease(pending, pending.hash, 'approve', 'portfolio:synthetic', new Date(now))
  const state = emptyExecutionState()
  state.releases[manifest.releaseId] = record
  state.approvalBindings = { [manifest.releaseId]: { ...approvalIdentity(record, new Date(now)), status: 'bound', executionEnabled: false, checkedAt: new Date(now).toISOString() } }
  const request = { releaseId: manifest.releaseId, hash: record.hash, approvalVersion: 2, actionId: manifest.actions[0].id,
    owner: 'synthetic-repair-worker', journalVersion: 0, requestId: id(9), dependencyDigest: releaseHash({}),
    record, auditHash: releaseHash(record.audit), ...campaignActionKeys(manifest, manifest.actions[0].id) }
  return { state, record, source, request }
}

// This contract runs without PostgreSQL too. Pin copied helper source and the
// exact scope so a future edit cannot accidentally replay the Phase 6 mutators.
describe('reconciliation migration scope', () => {
  it('copies only the original three helper definitions and explicit ACL repairs', () => {
    const original = phase6.slice(phase6.indexOf('create function public.campaign_authority_json'), phase6.indexOf('-- SECURITY DEFINER')).trim()
      .replaceAll('create function public.', 'create or replace function public.')
    expect(repair).toContain(original)
    const sql = repair.replace(/--[^\n]*/g, '')
    expect([...sql.matchAll(/create or replace function public\.([a-z_]+)/g)].map(x => x[1])).toEqual([
      'campaign_authority_json', 'campaign_authority_hash', 'campaign_authority_keys',
    ])
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|drop|alter)\s|create\s+(?:role|table|schema)/i)
    expect(sql).not.toMatch(/(?:create|replace) function public\.(?:campaign_authorize_sandbox_intent|campaign_execution_commit)/)
    expect(sql).toMatch(/^\s*begin;/); expect(sql.trim()).toMatch(/commit;$/)
  })
})

describe.skipIf(!rootUrl).each(modes)('real PostgreSQL repair: %s', mode => {
  let admin: Client, baselineRows: Record<string, unknown>, protectedBodies: unknown
  async function rows() {
    const tables = (await admin.query(`select n.nspname as schema,t.relname from pg_class t join pg_namespace n on n.oid=t.relnamespace
      where t.relkind in ('r','p') and (n.nspname='campaign_verifier' or (n.nspname='public' and
      (t.relname like 'campaign_%' or t.relname in ('agent_runs','social_content_queue','outreach_queue','video_generation_jobs',
        'attraction_campaigns','social_content_calendar_items','contact_submissions'))))
      order by n.nspname,t.relname`)).rows
    const snapshot: Record<string, unknown> = {}
    for (const table of tables) {
      // Names are catalog-sourced, but quote identifiers rather than interpolate raw.
      const quote = (s: string) => `"${s.replaceAll('"', '""')}"`
      snapshot[`${table.schema}.${table.relname}`] = (await admin.query(`select to_jsonb(t) as row from ${quote(table.schema)}.${quote(table.relname)} t order by to_jsonb(t)::text`)).rows
    }
    return snapshot
  }
  async function bodies() {
    return (await admin.query(`select p.oid::text, p.proname, md5(p.prosrc) as body_md5,
      md5(pg_get_functiondef(p.oid)) as definition_md5, pg_get_functiondef(p.oid) as definition, p.prosecdef,p.provolatile,p.proisstrict,p.proconfig,p.proowner::text
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('campaign_authorize_sandbox_intent','campaign_execution_commit') order by p.proname`)).rows
  }
  async function privileges(signature: string) {
    const result: Record<string, boolean> = {}
    for (const role of roles) result[role] = (await admin.query('select has_function_privilege($1,$2,\'EXECUTE\') as allowed', [role, `public.${signature}`])).rows[0].allowed
    return result
  }
  async function asRole(role: typeof roles[number], sql: string, args: unknown[] = []) {
    await admin.query(`set role ${role}`)
    try { return await admin.query(sql, args) } finally { await admin.query('reset role') }
  }
  async function seed() {
    const x = approvedFixture()
    await admin.query('update campaign_execution_journal set version=0,state=$1', [x.state])
    await admin.query('insert into agent_runs(id,kind,metadata) values($1,\'campaign_release_manifest\',$2)', [x.record.manifest.releaseId, x.record])
    await admin.query('insert into social_content_queue(id,body,evidence) values($1,$2,$3)', [x.source.id, x.source.body, x.source.evidence])
    return x
  }
  beforeAll(async () => {
    if (!rootUrl || new URL(rootUrl).hostname !== '127.0.0.1' || new URL(rootUrl).pathname !== '/postgres') throw Error('Disposable local database only')
    const url = new URL(rootUrl); url.pathname = `/campaign_repair_${mode}`
    admin = new Client({ connectionString: url.toString() }); await admin.connect()
    await admin.query(`create table public.agent_runs(id uuid primary key,kind text,metadata jsonb);
      create table public.social_content_queue(id uuid primary key,body text,evidence jsonb,updated_at timestamptz);
      create table public.outreach_queue(like public.social_content_queue including all);
      create table public.video_generation_jobs(like public.social_content_queue including all);
      create table public.attraction_campaigns(like public.social_content_queue including all);
      create table public.social_content_calendar_items(like public.social_content_queue including all);
      create table public.contact_submissions(like public.social_content_queue including all);`)
    for (const name of ['20261003104423_campaign_execution_journal.sql', '20261003130200_campaign_execution_journal_service_role_grants.sql']) await admin.query(readMigration(name))
    if (mode === 'full_sequence') await admin.query(phase6)
    for (const name of ['20261004001737_campaign_atomic_recovery.sql', '20261004005627_campaign_provider_certification.sql',
      '20261004011705_campaign_provider_receipt_adoption.sql', '20261004021121_campaign_provider_verifier_bridge.sql',
      '20261004025253_campaign_verifier_provisioning_events.sql']) await admin.query(readMigration(name))
    baselineRows = await rows(); protectedBodies = await bodies()
    // The Captain hash is md5(pg_get_functiondef), not md5(prosrc).
    console.log(mode, (await bodies()).map(({proname,body_md5,definition_md5})=>({proname,body_md5,definition_md5})))
    expect((await bodies()).find(row => row.proname === 'campaign_authorize_sandbox_intent')?.definition_md5).toBe('ced09628b28bf79fe539dd65a795390e')
  })
  afterAll(async () => { await admin?.query('rollback'); await admin?.query('reset role'); await admin?.end() })

  it('reproduces the skipped-helper/public-authorize state without modifying the fixture to manufacture exposure', async () => {
    for (const signature of helpers) {
      const row = (await admin.query('select to_regprocedure($1)::text as function', [`public.${signature}`])).rows[0]
      expect(row.function === null).toBe(mode === 'skipped_phase6')
    }
    const acl = (await admin.query('select proacl from pg_proc where oid=$1::regprocedure', [`public.${authorize}`])).rows[0].proacl
    expect(acl === null).toBe(mode === 'skipped_phase6')
    expect(await privileges(authorize)).toEqual(Object.fromEntries(roles.map(role => [role, mode === 'skipped_phase6' || role === 'service_role'])))
    expect(await privileges(commit)).toEqual(Object.fromEntries(roles.map(role => [role, role === 'service_role'])))
    if (mode === 'skipped_phase6') {
      await expect(asRole('anon', 'select campaign_authorize_sandbox_intent($1)', [{}])).rejects.toThrow('Invalid authority request')
      await admin.query('begin')
      try {
        const x = await seed()
        await admin.query('set local role service_role')
        await expect(admin.query('select campaign_authorize_sandbox_intent($1)', [x.request])).rejects.toThrow(/campaign_authority_hash.*does not exist/)
      } finally { await admin.query('rollback') }
    }
    expect(await rows()).toEqual(baselineRows)
  })
  it('reconciles without changing current authorization/commit definitions or any row', async () => {
    await admin.query(repair)
    expect(await bodies()).toEqual(protectedBodies)
    expect(await rows()).toEqual(baselineRows)
    // All business/evidence tables remain empty; the pre-existing singleton stays.
    for (const [table, value] of Object.entries(await rows())) if (table !== 'public.campaign_execution_journal') expect(value).toEqual([])
  })
  it('matches original helper definitions and canonical JSON/hash/action-key semantics', async () => {
    for (const signature of helpers) {
      const name = signature.split('(')[0]
      const original = phase6.match(new RegExp(`create function public\\.${name}\\([^]*?as \\$\\$([^]*?)\\$\\$;`))?.[1]
      expect(original).toBeDefined()
      const row = (await admin.query('select prosrc,prosecdef,provolatile,proisstrict,proconfig from pg_proc where oid=$1::regprocedure', [`public.${signature}`])).rows[0]
      expect(row.prosrc).toBe(original); expect(row).toMatchObject({ prosecdef: false, provolatile: 'i', proisstrict: true, proconfig: ['search_path=""'] })
    }
    for (const value of [{ z: [null, true, 1.5, 'line\n"quoted"'], a: { b: -2, a: 'é' } }, [], {}, null]) {
      const result = (await admin.query('select campaign_authority_json($1) as json,campaign_authority_hash($1) as hash', [JSON.stringify(value)])).rows[0]
      expect(result).toEqual({ json: canonicalReleaseValue(value), hash: releaseHash(value) })
    }
    const manifest = fixture()
    for (const recipients of [[], [{ address: ' A@EXAMPLE.invalid ' }]]) {
      if (recipients.length) {
        manifest.class = 'relationship_outreach_batch'; manifest.actions[0].provider = 'gmail'
        manifest.actions[0].operation = 'send'; manifest.actions[0].source.table = 'outreach_queue'
        manifest.actions[0].expectedReceipt = 'gmail_message_id'
      }
      manifest.actions[0].recipients = recipients.map(r => ({ ...r, consentEvidenceId: 'synthetic', suppressionEvidenceId: 'synthetic' }))
      const result = (await admin.query('select campaign_authority_keys($1,$2) as keys', [manifest.actions[0], releaseHash(manifest)])).rows[0].keys
      expect(result).toEqual(campaignActionKeys(manifest, manifest.actions[0].id))
    }
  })
  it('denies helper execution for API/PUBLIC roles and permits only service-role authorization/commit', async () => {
    for (const signature of helpers) expect(await privileges(signature)).toEqual(Object.fromEntries(roles.map(role => [role, false])))
    for (const signature of [authorize, commit]) expect(await privileges(signature)).toEqual(Object.fromEntries(roles.map(role => [role, role === 'service_role'])))
    const publicGrants = (await admin.query(`select count(*)::int as n from pg_proc p,
      lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=any($1::regprocedure[]) and a.grantee=0 and a.privilege_type='EXECUTE'`,
    [[...helpers, authorize, commit].map(s => `public.${s}`)])).rows[0].n
    expect(publicGrants).toBe(0)
    for (const role of roles) {
      for (const [sql, args] of [
        ['select campaign_authority_json($1)', [{}]], ['select campaign_authority_hash($1)', [{}]],
        ['select campaign_authority_keys($1,$2)', [{}, 'synthetic']],
      ] as const) await expect(asRole(role, sql, [...args])).rejects.toThrow('permission denied')
      if (role !== 'service_role') {
        await expect(asRole(role, 'select campaign_authorize_sandbox_intent($1)', [{}])).rejects.toThrow('permission denied')
        await expect(asRole(role, 'select campaign_execution_commit($1,$2)', [0, {}])).rejects.toThrow('permission denied')
      }
    }
    await expect(asRole('service_role', 'select campaign_authorize_sandbox_intent($1)', [{}])).rejects.toThrow('Invalid authority request')
    await expect(asRole('service_role', 'select campaign_execution_commit($1,$2)', [0, {}])).rejects.toThrow('Invalid campaign execution state')
  })
  it('retains disabled exact authorization replay and the newer commit protection, with all semantic writes rolled back', async () => {
    await admin.query('begin')
    try {
      const x = await seed()
      await admin.query('set local role service_role')
      const result = (await admin.query('select campaign_authorize_sandbox_intent($1) as result', [x.request])).rows[0].result
      expect(result).toMatchObject({ protocol: 'campaign-atomic-sandbox/v1', providerEnabled: false,
        attempt: { state: 'claimed', version: 1, reservedCents: 50, dispatchIntent: { mode: 'disabled', status: 'prepared' } } })
      expect((await admin.query('select campaign_authorize_sandbox_intent($1) as result', [x.request])).rows[0].result).toEqual(result)
      const journal = (await admin.query('select state from campaign_execution_journal')).rows[0].state
      expect(journal.ledger).toHaveLength(1)
      const next = structuredClone(journal); next.version++; next.releases[id(88)] = { synthetic: true }
      expect((await admin.query('select campaign_execution_commit($1,$2) as ok', [1, next])).rows[0].ok).toBe(true)
      const changed = structuredClone(next); changed.version++; delete changed.attempts[result.attempt.deliveryKey]
      await expect(admin.query('select campaign_execution_commit($1,$2)', [2, changed])).rejects.toThrow('Atomic attempts are immutable to legacy CAS')
    } finally { await admin.query('rollback') }
    expect(await rows()).toEqual(baselineRows); expect(await bodies()).toEqual(protectedBodies)
  })
  it('is idempotent across repeated repair and reasserts ACL drift without body or row drift', async () => {
    const repaired = await bodies()
    const helperBodies = (await admin.query('select oid::text,md5(prosrc) as hash,proacl::text from pg_proc where oid=any($1::regprocedure[]) order by oid', [helpers.map(s => `public.${s}`)])).rows
    await admin.query(repair)
    expect(await bodies()).toEqual(repaired)
    expect((await admin.query('select oid::text,md5(prosrc) as hash,proacl::text from pg_proc where oid=any($1::regprocedure[]) order by oid', [helpers.map(s => `public.${s}`)])).rows).toEqual(helperBodies)
    await admin.query('grant execute on function campaign_authority_json(jsonb),campaign_authorize_sandbox_intent(jsonb),campaign_execution_commit(bigint,jsonb) to public')
    await admin.query(repair)
    expect(await privileges(helpers[0])).toEqual(Object.fromEntries(roles.map(role => [role, false])))
    expect(await privileges(authorize)).toEqual(Object.fromEntries(roles.map(role => [role, role === 'service_role'])))
    expect(await privileges(commit)).toEqual(Object.fromEntries(roles.map(role => [role, role === 'service_role'])))
    expect(await bodies()).toEqual(repaired); expect(await rows()).toEqual(baselineRows)
    // Hash copied source as an extra audit link; never hash credential values.
    console.log(`${mode}: preserved authorize definition md5 ced09628b28bf79fe539dd65a795390e; helper source sha256 ${createHash('sha256').update(phase6.slice(phase6.indexOf('create function public.campaign_authority_json'), phase6.indexOf('-- SECURITY DEFINER'))).digest('hex')}; zero persisted semantic-test rows.`)
  })
})
