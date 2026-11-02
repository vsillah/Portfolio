import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const contentId = 'c12378f2-36de-4bf7-8c5d-0ce754e727eb'
const operatorId = '33333333-3333-4333-8333-333333333333'
const privacyId = '865a4d78-90ba-420d-84ed-526c70dd720f'
const approvedAt = '2026-11-02T02:20:00Z'
const beforePreparation = '2026-11-02T02:25:00Z'
const master = '2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36'
const thumbnail = '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0'
const contentVersion = `sha256:${'a'.repeat(64)}`
const video = '/review-assets/final-master.mp4'
const image = '/review-assets/direction-c.png'
const kinds = ['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']
const preparation = readFileSync('supabase/migrations/20261102003655_prepare_youtube_platform_submission_review.sql', 'utf8')
const repair = readFileSync('supabase/migrations/20261102040000_reconcile_youtube_final_receipt_versions.sql', 'utf8')
const bundle = Object.fromEntries(kinds.map(kind => [kind, {
  receipt_id: `${kind}-receipt`, status: 'approved', social_content_id: contentId,
  content_updated_at: approvedAt, content_version: contentVersion,
  packet_id: `${kind}-packet`, evidence_fingerprint: `${kind}-fingerprint`,
}]))
const candidate = {
  post_text: 'Approved copy', cta_text: null, cta_url: null,
  youtube_title: 'Approved title', youtube_description: 'Approved description',
  video_url: video, media_sha256: master, image_url: image,
  visual_sha256: `sha256:${thumbnail}`, thumbnail_direction: 'C',
  thumbnail_selection_receipt_id: 'thumbnail-selection-receipt',
  description_receipt_id: 'description-receipt', evidence_receipt_id: 'evidence-receipt',
}
const rag = {
  current_gate: 'platform_submission', latest_internal_decision_receipt_id: privacyId,
  latest_internal_decision: 'approve', latest_internal_decision_command: 'approve_privacy',
  content_version: contentVersion, approved_visual_sha256: `sha256:${thumbnail}`,
  copy_review_candidate_projection: candidate,
  dark_castle_master_binding: { social_content_id: contentId, content_version: contentVersion,
    path: video, sha256: master, description_receipt_id: 'description-receipt', evidence_receipt_id: 'evidence-receipt' },
  dark_castle_thumbnail_binding: { social_content_id: contentId, content_version: contentVersion,
    path: image, sha256: thumbnail, direction: 'C', receipt_id: 'thumbnail-selection-receipt' },
  youtube_description_receipt: { receipt_id: 'description-receipt' },
  description_evidence_reconciliation_receipt: { receipt_id: 'evidence-receipt' },
  mobile_decision_review: { current_gate: 'privacy' },
}
const schema = `
CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE auth.users (id UUID PRIMARY KEY);
CREATE TABLE public.social_content_queue (id UUID PRIMARY KEY, platform TEXT, status TEXT,
  updated_at TIMESTAMPTZ, rag_context JSONB, post_text TEXT, cta_text TEXT, cta_url TEXT,
  youtube_title TEXT, youtube_description TEXT, video_url TEXT, image_url TEXT,
  scheduled_for TIMESTAMPTZ, published_at TIMESTAMPTZ, platform_post_id TEXT, reviewed_by UUID);
CREATE TABLE public.social_content_publishes (content_id UUID, status TEXT);
CREATE TABLE public.social_content_decision_receipts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_content_id UUID, agent_run_id UUID, agent_approval_id UUID, agent_work_item_id UUID,
  content_updated_at TIMESTAMPTZ, current_gate TEXT, decision TEXT, command_name TEXT,
  command_payload JSONB, next_internal_gate TEXT, candidate_projection JSONB,
  receipt_bundle JSONB, decided_by_user_id UUID, idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT clock_timestamp());
CREATE TABLE public.dark_castle_prerequisite_receipts (receipt_id TEXT PRIMARY KEY, kind TEXT,
  social_content_id UUID, content_version TEXT, packet_id TEXT, evidence_fingerprint TEXT,
  artifact_hashes JSONB, receipt JSONB);
CREATE TABLE public.agent_runs (id UUID PRIMARY KEY, agent_key TEXT, runtime TEXT, kind TEXT,
  title TEXT, status TEXT, subject_type TEXT, subject_id TEXT, subject_label TEXT,
  current_step TEXT, trigger_source TEXT, triggered_by_user_id UUID, metadata JSONB,
  idempotency_key TEXT UNIQUE, updated_at TIMESTAMPTZ, error_message TEXT);
CREATE TABLE public.agent_approvals (id UUID PRIMARY KEY, run_id UUID, approval_type TEXT,
  status TEXT, requested_by_agent_key TEXT, metadata JSONB, decided_by_user_id UUID,
  decided_at TIMESTAMPTZ, decision_notes TEXT);
CREATE TABLE public.agent_work_items (id UUID PRIMARY KEY, title TEXT, objective TEXT,
  status TEXT, priority TEXT, owner_agent_key TEXT, owner_runtime TEXT, source_type TEXT,
  source_id TEXT, source_label TEXT, source_run_id UUID, active_run_id UUID,
  overlap_group TEXT, validation_summary TEXT, approval_id UUID, metadata JSONB,
  idempotency_key TEXT UNIQUE, updated_at TIMESTAMPTZ, blocker_summary TEXT);
CREATE TABLE public.agent_run_events (run_id UUID, event_type TEXT, severity TEXT,
  message TEXT, metadata JSONB, idempotency_key TEXT);
CREATE FUNCTION public.set_social_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER set_social_updated_at BEFORE UPDATE ON public.social_content_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_social_updated_at();
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
`

async function setup() {
  const db = new PGlite()
  await db.exec(schema)
  await db.exec(preparation)
  await db.exec(repair)
  await db.query('INSERT INTO auth.users VALUES ($1::uuid)', [operatorId])
  await db.query(`INSERT INTO public.social_content_queue
    (id,platform,status,updated_at,rag_context,post_text,youtube_title,youtube_description,video_url,image_url)
    VALUES ($1::uuid,'youtube','draft',$2::timestamptz,$3::jsonb,$4,$5,$6,$7,$8)`,
  [contentId, beforePreparation, JSON.stringify(rag), candidate.post_text, candidate.youtube_title,
    candidate.youtube_description, video, image])
  await db.query(`INSERT INTO public.social_content_decision_receipts
    (id,social_content_id,content_updated_at,current_gate,decision,command_name,next_internal_gate,candidate_projection,receipt_bundle)
    VALUES ($1::uuid,$2::uuid,$3::timestamptz,'privacy','approve','approve_privacy','platform_submission',$4::jsonb,$5::jsonb)`,
  [privacyId, contentId, approvedAt, JSON.stringify(candidate), JSON.stringify(bundle)])
  for (const kind of kinds) {
    const receipt = { ...bundle[kind], ...(kind === 'visual'
      ? { asset_sha256: `sha256:${thumbnail}`, asset_path: image } : {}) }
    await db.query(`INSERT INTO public.dark_castle_prerequisite_receipts VALUES
      ($1,$2,$3::uuid,$4,$5,$6,$7::jsonb,$8::jsonb)`,
    [receipt.receipt_id, kind, contentId, contentVersion, receipt.packet_id,
      receipt.evidence_fingerprint, JSON.stringify({ master_sha256: master, thumbnail_sha256: thumbnail }), JSON.stringify(receipt)])
  }
  await db.exec('SET ROLE service_role')
  const prepared = await db.query<{ result: { approval_id: string; content_updated_at: string } }>(`
    SELECT public.prepare_youtube_platform_submission_review(
      $1::uuid,$2::timestamptz,$3::uuid,$4,$5,$6,$7,$8::uuid,$9) result`,
  [contentId, beforePreparation, privacyId, contentVersion, master, thumbnail, 'C', operatorId,
    `youtube-final:${contentId}:${privacyId}`])
  return { db, approvalId: prepared.rows[0].result.approval_id,
    preparedAt: prepared.rows[0].result.content_updated_at }
}
async function decide(db: PGlite, approvalId: string, preparedAt: string,
  key = 'final-decision-1', decision = 'approve') {
  const result = await db.query<{ result: any }>(`SELECT public.record_social_content_stage_decision(
    $1::uuid,$2::uuid,$3::timestamptz,$4,$5::uuid,$6,$7) result`,
  [contentId, approvalId, preparedAt, decision, operatorId, key,
    decision === 'approve' ? 'approve_platform_submission' : 'hold_platform_submission'])
  return result.rows[0].result
}
async function state(db: PGlite) {
  const result = await db.query<{ decisions: number; events: number; approval_status: string; gate_status: string | null }>(`
    SELECT (SELECT count(*) FROM public.social_content_decision_receipts WHERE current_gate='platform_submission')::int decisions,
      (SELECT count(*) FROM public.agent_run_events)::int events,
      (SELECT status FROM public.agent_approvals LIMIT 1) approval_status,
      (SELECT rag_context->'platform_submission_gate'->>'status' FROM public.social_content_queue) gate_status`)
  return result.rows[0]
}

describe('YouTube final canonical decision timestamp reconciliation in PostgreSQL', () => {
  it('records once with the prepared packet timestamp while retaining approved prerequisite timestamps', async () => {
    const { db, approvalId, preparedAt } = await setup()
    try {
      expect(new Date(preparedAt).toISOString()).not.toBe(new Date(approvedAt).toISOString())
      const first = await decide(db, approvalId, preparedAt)
      const replay = await decide(db, approvalId, preparedAt)
      expect(first).toMatchObject({ decision: 'approve', idempotent_replay: false, external_execution: false })
      expect(replay).toMatchObject({ id: first.id, idempotent_replay: true })
      expect(await state(db)).toEqual({ decisions: 1, events: 1, approval_status: 'approved', gate_status: 'approved' })
      const persisted = await db.query<{ content_updated_at: string; receipt_bundle: any; candidate_projection: any }>(
        "SELECT content_updated_at,receipt_bundle,candidate_projection FROM public.social_content_decision_receipts WHERE current_gate='platform_submission'")
      expect(new Date(persisted.rows[0].content_updated_at).toISOString()).toBe(new Date(preparedAt).toISOString())
      expect(persisted.rows[0].receipt_bundle).toEqual(bundle)
      expect(persisted.rows[0].candidate_projection).toEqual(candidate)
    } finally { await db.close() }
  })

  it.each([
    ['stale queue version', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET post_text='Drift'")],
    ['wrong channel', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET platform='linkedin'")],
    ['missing immutable prerequisite', async (db: PGlite) => db.query("DELETE FROM public.dark_castle_prerequisite_receipts WHERE kind='source'")],
    ['duplicate immutable prerequisite', async (db: PGlite) => db.query(`INSERT INTO public.dark_castle_prerequisite_receipts
      SELECT 'source-extra',kind,social_content_id,content_version,'source-extra-packet',evidence_fingerprint,artifact_hashes,receipt
      FROM public.dark_castle_prerequisite_receipts WHERE kind='source'`)],
    ['mismatched immutable receipt', async (db: PGlite) => db.query(`UPDATE public.dark_castle_prerequisite_receipts
      SET receipt=jsonb_set(receipt,'{packet_id}',to_jsonb('wrong-packet'::text)) WHERE kind='source'`)],
    ['changed source timestamp', async (db: PGlite) => db.query(`UPDATE public.agent_approvals
      SET metadata=jsonb_set(metadata,'{review_packet,receipts,source,content_updated_at}',to_jsonb('2026-11-02T02:21:00Z'::text))`)],
    ['changed privacy identity', async (db: PGlite) => db.query(`UPDATE public.agent_approvals
      SET metadata=jsonb_set(metadata,'{review_packet,privacy_decision_receipt_id}',to_jsonb('11111111-1111-4111-8111-111111111111'::text))`)],
    ['changed master hash', async (db: PGlite) => db.query(`UPDATE public.agent_approvals
      SET metadata=jsonb_set(metadata,'{review_packet,master_sha256}',to_jsonb('bad'::text))`)],
    ['duplicate approved privacy identity', async (db: PGlite) => db.query(`INSERT INTO public.social_content_decision_receipts
      (id,social_content_id,content_updated_at,current_gate,decision,command_name,next_internal_gate,candidate_projection,receipt_bundle)
      SELECT '11111111-1111-4111-8111-111111111111'::uuid,social_content_id,content_updated_at,
        current_gate,decision,command_name,next_internal_gate,candidate_projection,receipt_bundle
      FROM public.social_content_decision_receipts WHERE id=$1::uuid`, [privacyId])],
  ])('fails closed and rolls back for %s', async (_name, mutate) => {
    const { db, approvalId, preparedAt } = await setup()
    try {
      await mutate(db)
      await expect(decide(db, approvalId, preparedAt)).rejects.toThrow()
      expect(await state(db)).toEqual({ decisions: 0, events: 0, approval_status: 'pending', gate_status: null })
    } finally { await db.close() }
  })

  it('rejects replay under a different approval identity', async () => {
    const { db, approvalId, preparedAt } = await setup()
    try {
      const first = await decide(db, approvalId, preparedAt)
      await expect(decide(db, '11111111-1111-4111-8111-111111111111', preparedAt)).rejects.toThrow('replay identity mismatched')
      expect((await state(db)).decisions).toBe(1)
      expect(first.id).toBeTruthy()
    } finally { await db.close() }
  })

  it('rolls back the entire decision when the event insert fails', async () => {
    const { db, approvalId, preparedAt } = await setup()
    try {
      await db.exec('RESET ROLE')
      await db.exec(`CREATE FUNCTION public.reject_final_event() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'event rejected'; END $$;
        CREATE TRIGGER reject_final_event BEFORE INSERT ON public.agent_run_events
          FOR EACH ROW EXECUTE FUNCTION public.reject_final_event();`)
      await db.exec('SET ROLE service_role')
      await expect(decide(db, approvalId, preparedAt)).rejects.toThrow('event rejected')
      expect(await state(db)).toEqual({ decisions: 0, events: 0, approval_status: 'pending', gate_status: null })
    } finally { await db.close() }
  })

  it('has no provider or external action path', () => {
    expect(repair).not.toMatch(/net\.http|http_post|storage\.objects|INSERT INTO public\.social_content_publishes|UPDATE public\.social_content_publishes/i)
  })
})
