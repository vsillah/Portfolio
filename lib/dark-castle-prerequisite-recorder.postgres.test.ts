import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const id = 'c12378f2-36de-4bf7-8c5d-0ce754e727eb'
const reviewer = '33333333-3333-4333-8333-333333333333'
const source = '2026-10-27T20:14:59.293829Z'
const version = 'sha256:4b4126fe2388687c899530cdb9ee973e744d9e0ebfd2b6378ac6b3702000342a'
const description = 'Approved description'
const hashes = { script_sha256: '982e17676e9125f201506cb59e38f3b813828bfe13681292bf5c23ba48ef83e0', storyboard_sha256: '9294ec46df24122577de4b4253f30709f50abb546ad3412be5e74bee75f82043', master_sha256: '2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36', thumbnail_sha256: '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0', description_sha256: createHash('sha256').update(description).digest('hex') }
const fingerprints = { source: 'b7384cb6b3ce6a08ce5f', voice: 'd71bc6374af17869a07f', framework: 'dc30eae3d2e4d2f0ee91', privacy: '00638b5286ff8faf8263', visual: 'cb1ccd18ba7c66e3d4a7', challenger: '32b51b3bf5fb5b062950' }
const receipts = Object.entries(fingerprints).map(([kind, evidence_fingerprint]) => {
  const packet_id = `dark-castle-review-packet:${kind}:${evidence_fingerprint}`
  return { kind, packet_id, evidence_fingerprint, receipt_id: `${packet_id}:approved`, status: 'approved', reviewer_id: reviewer, source_content_updated_at: source, artifact_hashes: hashes,
    ...(kind === 'visual' ? { asset_sha256: `sha256:${hashes.thumbnail_sha256}`, asset_path: '/review-assets/social-content/dark-castle-youtube-master-2026-10-29/03-accidental-success-v2.png' } : {}) }
})
const migration = readFileSync(path.join(process.cwd(), 'supabase/migrations/20261101180000_record_dark_castle_prerequisite_receipts.sql'), 'utf8')
  .replaceAll('224f7d07a4d55a9de3d22028ce81a76312fe64e52f06bcf38c440da89a90817d', hashes.description_sha256)
const context = { content_version: version,
  youtube_description_receipt: { receipt_id: 'youtube-description:dark-castle:sha256:224f7d07a4d55a9d', social_content_id: id, content_version: version, human_qa_status: 'pending', description_sha256: hashes.description_sha256, evidence_input_fingerprint: 'fnv1a:07f944bb' },
  description_evidence_reconciliation_receipt: { receipt_id: 'youtube-description-evidence-reconciliation:fnv1a:07f944bb', social_content_id: id, content_version: version, status: 'passed', evidence_input_fingerprint: 'fnv1a:07f944bb' } }

async function setup() {
  const db = new PGlite()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.social_content_queue (id uuid PRIMARY KEY, updated_at timestamptz NOT NULL, platform text, status text, rag_context jsonb, youtube_description text);
    CREATE FUNCTION public.set_social_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
    CREATE TRIGGER set_social_updated_at BEFORE UPDATE ON public.social_content_queue FOR EACH ROW EXECUTE FUNCTION public.set_social_updated_at();`)
  await db.exec(migration)
  await db.query('INSERT INTO public.social_content_queue VALUES ($1::uuid,$2::timestamptz,$3,$4,$5::jsonb,$6)', [id, source, 'youtube', 'draft', JSON.stringify(context), description])
  await db.exec('GRANT SELECT, UPDATE ON public.social_content_queue TO service_role; SET ROLE service_role;')
  return db
}
async function record(db: PGlite, input: unknown = receipts, expected = source, actor = reviewer) {
  const result = await db.query<{ result: { idempotent_replay: boolean; receipt_ids: string[] } }>(
    'SELECT public.record_dark_castle_prerequisite_receipts($1::uuid,$2::timestamptz,$3::uuid,$4::jsonb) result',
    [id, expected, actor, JSON.stringify(input)])
  return result.rows[0].result
}

describe('Dark Castle prerequisite receipt recorder in PostgreSQL', () => {
  it('records exactly six immutable rows and the matching projection, then replays without new rows', async () => {
    const db = await setup()
    try {
      const first = await record(db)
      expect(first.idempotent_replay).toBe(false)
      expect(first.receipt_ids).toHaveLength(6)
      expect((await record(db)).idempotent_replay).toBe(true)
      const rows = await db.query<{ count: string }>('SELECT count(*)::text count FROM public.dark_castle_prerequisite_receipts')
      expect(rows.rows[0].count).toBe('6')
      const projection = await db.query<{ bundle: Record<string, unknown> }>("SELECT rag_context -> 'copy_review_evidence_receipts' bundle FROM public.social_content_queue")
      expect(Object.keys(projection.rows[0].bundle)).toHaveLength(6)
      await db.exec('RESET ROLE')
      await expect(db.exec("UPDATE public.dark_castle_prerequisite_receipts SET receipt = '{}'::jsonb")).rejects.toThrow('immutable')
    } finally { await db.close() }
  })

  it.each([
    ['missing packet', receipts.slice(1)],
    ['duplicate identity', receipts.map((receipt, index) => index === 1 ? { ...receipt, receipt_id: receipts[0].receipt_id } : receipt)],
    ['wrong fingerprint', receipts.map((receipt, index) => index === 0 ? { ...receipt, evidence_fingerprint: 'wrong' } : receipt)],
    ['wrong hash', receipts.map((receipt, index) => index === 0 ? { ...receipt, artifact_hashes: { ...hashes, master_sha256: 'wrong' } } : receipt)],
  ])('rolls back completely for %s', async (_name, invalid) => {
    const db = await setup()
    try {
      await expect(record(db, invalid)).rejects.toThrow()
      const rows = await db.query<{ count: string; bundle: unknown }>("SELECT (SELECT count(*)::text FROM public.dark_castle_prerequisite_receipts) count, rag_context -> 'copy_review_evidence_receipts' bundle FROM public.social_content_queue")
      expect(rows.rows[0]).toMatchObject({ count: '0', bundle: null })
    } finally { await db.close() }
  })

  it('rejects stale timestamp, unauthorized role, and changed replay identity', async () => {
    const db = await setup()
    try {
      await expect(record(db, receipts, '2026-10-28T00:00:00Z')).rejects.toThrow('Wrong record or source timestamp')
      await db.exec('SET ROLE authenticated')
      await expect(record(db)).rejects.toThrow()
      await db.exec('SET ROLE service_role')
      await record(db)
      await expect(record(db, receipts, source, '44444444-4444-4444-8444-444444444444')).rejects.toThrow()
    } finally { await db.close() }
  })

  it('rolls back six inserts when canonical projection fails', async () => {
    const db = await setup()
    try {
      await db.exec(`RESET ROLE;
        CREATE FUNCTION public.reject_projection() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.rag_context ? 'copy_review_evidence_receipts' THEN RAISE EXCEPTION 'projection blocked'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_projection BEFORE UPDATE ON public.social_content_queue
          FOR EACH ROW EXECUTE FUNCTION public.reject_projection();
        SET ROLE service_role;`)
      await expect(record(db)).rejects.toThrow('projection blocked')
      const rows = await db.query<{ count: string }>('SELECT count(*)::text count FROM public.dark_castle_prerequisite_receipts')
      expect(rows.rows[0].count).toBe('0')
    } finally { await db.close() }
  })

  it('rejects a record changed after packet snapshot', async () => {
    const db = await setup()
    try {
      await db.query("UPDATE public.social_content_queue SET status = 'draft' WHERE id = $1::uuid", [id])
      await expect(record(db)).rejects.toThrow('Source content timestamp is stale')
    } finally { await db.close() }
  })

  it('enables RLS and reserves function and table access for the service role', async () => {
    const db = await setup()
    try {
      const grants = await db.query<{ rls_enabled: boolean; anon_select: boolean; anon_insert: boolean; authenticated_select: boolean; authenticated_insert: boolean; public_table_grants: boolean; authenticated_execute: boolean; anon_execute: boolean; public_execute: boolean; service_execute: boolean; service_select: boolean; service_insert: boolean; service_bypassrls: boolean }>(`SELECT
        (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.dark_castle_prerequisite_receipts'::regclass) rls_enabled,
        has_table_privilege('anon','public.dark_castle_prerequisite_receipts','SELECT') anon_select,
        has_table_privilege('anon','public.dark_castle_prerequisite_receipts','INSERT') anon_insert,
        has_table_privilege('authenticated','public.dark_castle_prerequisite_receipts','SELECT') authenticated_select,
        has_table_privilege('authenticated','public.dark_castle_prerequisite_receipts','INSERT') authenticated_insert,
        EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) a WHERE c.oid = 'public.dark_castle_prerequisite_receipts'::regclass AND a.grantee = 0) public_table_grants,
        has_function_privilege('authenticated','public.record_dark_castle_prerequisite_receipts(uuid,timestamptz,uuid,jsonb)','EXECUTE') authenticated_execute,
        has_function_privilege('anon','public.record_dark_castle_prerequisite_receipts(uuid,timestamptz,uuid,jsonb)','EXECUTE') anon_execute,
        EXISTS (SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) a WHERE p.oid = 'public.record_dark_castle_prerequisite_receipts(uuid,timestamptz,uuid,jsonb)'::regprocedure AND a.grantee = 0) public_execute,
        has_function_privilege('service_role','public.record_dark_castle_prerequisite_receipts(uuid,timestamptz,uuid,jsonb)','EXECUTE') service_execute,
        has_table_privilege('service_role','public.dark_castle_prerequisite_receipts','SELECT') service_select,
        has_table_privilege('service_role','public.dark_castle_prerequisite_receipts','INSERT') service_insert,
        (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role') service_bypassrls`)
      expect(grants.rows[0]).toEqual({ rls_enabled: true, anon_select: false, anon_insert: false,
        authenticated_select: false, authenticated_insert: false, public_table_grants: false,
        authenticated_execute: false, anon_execute: false, public_execute: false,
        service_execute: true, service_select: true, service_insert: true, service_bypassrls: true })
    } finally { await db.close() }
  })
})
