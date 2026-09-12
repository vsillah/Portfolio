// Isolated PostgreSQL WASM validation; never connects to Supabase or a network DB.
// npm install --prefix /tmp/portfolio-sms-db-qa @electric-sql/pglite
// SMS_QA_PGLITE_MODULE=/tmp/portfolio-sms-db-qa/node_modules/@electric-sql/pglite/dist/index.js node scripts/validate-contact-sms-migration.mjs
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
const { PGlite } = await import(process.env.SMS_QA_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create table public.contact_submissions(id bigint primary key, phone text, unsubscribed boolean, do_not_contact boolean);
  insert into public.contact_submissions values (7, '+12025550199', true, true);`)
const migration = 'supabase/migrations/20260909154521_capture_contact_sms_consent.sql'
await db.exec(await readFile(migration, 'utf8'))
const checks = []
const check = (name) => checks.push({ name, passed: true })
const insert = `insert into public.contact_sms_consent_evidence
  (evidence_key,inquiry_id,submitted_phone,normalized_phone,affirmative_selection,program,scope,disclosure_version,disclosure_text,privacy_path,terms_path,source_route)
  values ('${'a'.repeat(64)}',7,'202-555-0123','+12025550123',true,'Synthetic program','Synthetic scope','synthetic-v1','Synthetic disclosure','/legal/privacy','/legal/terms#sms','/#contact')
  on conflict (evidence_key) do nothing`
for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`)
  for (const statement of ['select * from public.contact_sms_consent_evidence', insert, 'update public.contact_sms_consent_evidence set send_eligible=true', 'delete from public.contact_sms_consent_evidence']) {
    await assert.rejects(db.exec(statement), /permission denied/)
  }
  check(`${role}: select/insert/update/delete denied`)
  await db.exec('reset role')
}
await db.exec('set role service_role')
await db.exec(insert)
const first = (await db.query('select * from public.contact_sms_consent_evidence')).rows[0]
assert.equal(first.send_eligible, false)
assert.equal(first.capture_state, 'pending_verification')
assert.ok(first.captured_at)
check('service insert: server timestamp and pending/non-sendable defaults')
await db.exec(insert.replace('Synthetic disclosure', 'Changed disclosure'))
assert.deepEqual((await db.query('select * from public.contact_sms_consent_evidence')).rows, [first])
check('duplicate action retains original disclosure/timestamp, one row')
for (const statement of ['update public.contact_sms_consent_evidence set disclosure_text=\'changed\'', 'delete from public.contact_sms_consent_evidence', 'truncate public.contact_sms_consent_evidence']) {
  await assert.rejects(db.exec(statement), /permission denied/)
}
check('service update/delete/truncate denied')
await db.exec('reset role')
assert.equal((await db.query("select relrowsecurity from pg_class where relname='contact_sms_consent_evidence'")).rows[0].relrowsecurity, true)
check('RLS enabled')
assert.deepEqual((await db.query('select * from public.contact_submissions')).rows, [{ id: 7, phone: '+12025550199', unsubscribed: true, do_not_contact: true }])
check('suppressed inquiry phone and denial state unchanged')
await assert.rejects(db.exec("update public.contact_sms_consent_evidence set send_eligible=true"), /check constraint/)
check('send eligibility cannot be enabled even by table owner')
await assert.rejects(db.exec("update public.contact_sms_consent_evidence set affirmative_selection=false"), /check constraint/)
check('negative choice cannot overwrite affirmative evidence')
await db.close()
const receipt = { migration, runtime: 'isolated PGlite PostgreSQL; synthetic schema and data only', checks, externalRequests: [], remoteMigrationsApplied: false }
await writeFile('docs/qa/sms-consent-policy/migration-receipt.json', JSON.stringify(receipt, null, 2)+'\n')
console.log(JSON.stringify(receipt, null, 2))
