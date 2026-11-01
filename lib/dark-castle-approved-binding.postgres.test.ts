import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const id = 'c12378f2-36de-4bf7-8c5d-0ce754e727eb'
const calendarId = '7b1b202c-eb24-4724-bc8e-313b07546884'
const actor = '33333333-3333-4333-8333-333333333333'
const version = '2000-01-01T00:00:00Z'
const contentVersion = 'sha256:4b4126fe2388687c899530cdb9ee973e744d9e0ebfd2b6378ac6b3702000342a'
const descriptionId = 'youtube-description:dark-castle:sha256:224f7d07a4d55a9d'
const evidenceId = 'youtube-description-evidence-reconciliation:fnv1a:07f944bb'
const selectionId = 'human-qa:dark-castle-youtube-master:thumbnail-selection:20261030:v1'
const masterHash = '2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36'
const thumbnailHash = '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0'
const description = 'Approved description'
const descriptionHash = 'c487f264b607fae1c48a728e861db9daa1c8737021c7b97d5c965bb96e5fad68'
const migration = readFileSync(path.join(process.cwd(), 'supabase/migrations/20261101145513_bind_dark_castle_youtube_copy_review.sql'), 'utf8')
const schema = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TABLE public.social_content_queue (
    id UUID PRIMARY KEY, updated_at TIMESTAMPTZ NOT NULL, rag_context JSONB NOT NULL,
    platform TEXT, status TEXT, youtube_title TEXT, youtube_description TEXT,
    video_url TEXT, image_url TEXT, post_text TEXT, cta_text TEXT, cta_url TEXT
  );
  CREATE FUNCTION public.set_social_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
  CREATE TRIGGER set_social_updated_at BEFORE UPDATE ON public.social_content_queue
    FOR EACH ROW EXECUTE FUNCTION public.set_social_updated_at();
  CREATE TABLE public.social_content_calendar_items (
    id UUID PRIMARY KEY, social_content_id UUID, due_status TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  );
  CREATE TABLE public.agent_runs (
    id UUID PRIMARY KEY, agent_key TEXT, runtime TEXT, kind TEXT, title TEXT,
    status TEXT, subject_type TEXT, subject_id TEXT, subject_label TEXT,
    current_step TEXT, trigger_source TEXT, triggered_by_user_id UUID,
    metadata JSONB, idempotency_key TEXT UNIQUE, updated_at TIMESTAMPTZ
  );
  CREATE TABLE public.agent_approvals (
    id UUID PRIMARY KEY, run_id UUID, approval_type TEXT, status TEXT,
    requested_by_agent_key TEXT, metadata JSONB
  );
  CREATE TABLE public.agent_work_items (
    id UUID PRIMARY KEY, title TEXT, objective TEXT, status TEXT, priority TEXT,
    owner_agent_key TEXT, owner_runtime TEXT, source_type TEXT, source_id TEXT,
    source_label TEXT, source_run_id UUID, active_run_id UUID,
    overlap_group TEXT, validation_summary TEXT, approval_id UUID, metadata JSONB,
    idempotency_key TEXT UNIQUE, updated_at TIMESTAMPTZ
  );
`
const receipts = () => Object.fromEntries(['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'].map(key => [key,
  { receipt_id: `${key}-approved`, status: 'approved', content_updated_at: version }]))
const context = () => ({ content_version: contentVersion,
  youtube_description_receipt: { receipt_id: descriptionId, social_content_id: id, content_version: contentVersion,
    description_sha256: descriptionHash, human_qa_status: 'pending', evidence_input_fingerprint: 'fp' },
  description_evidence_reconciliation_receipt: { receipt_id: evidenceId, social_content_id: id, content_version: contentVersion,
    status: 'passed', evidence_input_fingerprint: 'fp' },
  copy_review_evidence_receipts: receipts(),
})

async function setup(rag = context()) {
  const db = new PGlite()
  await db.exec(schema)
  await db.exec(migration)
  await db.query(`INSERT INTO public.social_content_queue
    (id, updated_at, rag_context, platform, status, youtube_title, youtube_description, post_text)
    VALUES ($1::uuid,$2::timestamptz,$3::jsonb,'youtube','draft','Approved title',$4,'Approved copy')`,
    [id, version, JSON.stringify(rag), description])
  await db.query(`INSERT INTO public.social_content_calendar_items (id, social_content_id, due_status)
    VALUES ($1::uuid,$2::uuid,'due_soon')`, [calendarId, id])
  return db
}
const args = [id, version, actor, masterHash, thumbnailHash, 'C', selectionId, descriptionId, evidenceId]
async function bind(db: PGlite, input: unknown[] = args) {
  const result = await db.query<{ packet: { work_item_id: string; idempotent_replay: boolean } }>(
    'SELECT public.bind_dark_castle_youtube_copy_review($1::uuid,$2::timestamptz,$3::uuid,$4::text,$5::text,$6::text,$7::text,$8::text,$9::text) AS packet', input)
  return result.rows[0].packet
}
async function state(db: PGlite) {
  const result = await db.query<{ video_url: string | null; image_url: string | null; packet: unknown }>(
    "SELECT video_url, image_url, rag_context->'mobile_decision_review' AS packet FROM public.social_content_queue WHERE id=$1::uuid", [id])
  const count = await db.query<{ runs: number; approvals: number; work: number }>(`SELECT
    (SELECT count(*) FROM public.agent_runs)::int AS runs,
    (SELECT count(*) FROM public.agent_approvals)::int AS approvals,
    (SELECT count(*) FROM public.agent_work_items)::int AS work`)
  return { ...result.rows[0], ...count.rows[0] }
}

describe('atomic Dark Castle approved binding in PostgreSQL', () => {
  it('binds exact artifacts, creates one copy packet, and replays without duplicate identities', async () => {
    const db = await setup()
    try {
      const first = await bind(db)
      expect(first.idempotent_replay).toBe(false)
      const snapshot = await state(db)
      expect(snapshot).toMatchObject({ video_url: expect.stringContaining('dark-castle-youtube-master.mp4'),
        image_url: expect.stringContaining('03-accidental-success-v2.png'), runs: 1, approvals: 1, work: 1 })
      const second = await bind(db)
      expect(second).toMatchObject({ work_item_id: first.work_item_id, idempotent_replay: true })
      expect(await state(db)).toEqual(snapshot)
    } finally { await db.close() }
  })

  it.each([
    ['stale version', [id, '2001-01-01T00:00:00Z', ...args.slice(2)]],
    ['wrong record', ['11111111-1111-4111-8111-111111111111', ...args.slice(1)]],
    ['wrong master hash', [id, version, actor, 'wrong', ...args.slice(4)]],
    ['wrong thumbnail direction', [id, version, actor, masterHash, thumbnailHash, 'B', ...args.slice(6)]],
    ['wrong description receipt', [...args.slice(0, 7), 'wrong-description', evidenceId]],
    ['missing evidence receipt', args],
    ['missing copy source receipt', args],
    ['pending visual source receipt', args],
    ['duplicate source identity', args],
  ])('rolls back all writes for %s', async (caseName, input) => {
    const rag = context()
    if (caseName === 'missing evidence receipt') delete (rag as Partial<typeof rag>).description_evidence_reconciliation_receipt
    if (caseName === 'missing copy source receipt') delete (rag.copy_review_evidence_receipts as Partial<typeof rag.copy_review_evidence_receipts>).source
    if (caseName === 'pending visual source receipt') rag.copy_review_evidence_receipts.visual.status = 'pending'
    if (caseName === 'duplicate source identity') rag.copy_review_evidence_receipts.voice.receipt_id = 'source-approved'
    const db = await setup(rag)
    try {
      await expect(bind(db, input as unknown[])).rejects.toThrow()
      expect(await state(db)).toMatchObject({ video_url: null, image_url: null, packet: null, runs: 0, approvals: 0, work: 0 })
    } finally { await db.close() }
  })

  it('rolls back the media update when packet insertion fails afterward', async () => {
    const db = await setup()
    try {
      await db.query(`INSERT INTO public.agent_runs (id, idempotency_key)
        VALUES (gen_random_uuid(), 'social-copy-review:' || $1::text || ':' || $2::timestamptz::text || ':run')`, [id, version])
      await expect(bind(db)).rejects.toThrow()
      expect(await state(db)).toMatchObject({ video_url: null, image_url: null, packet: null,
        runs: 1, approvals: 0, work: 0 })
    } finally { await db.close() }
  })
})
