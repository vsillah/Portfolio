import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const id = 'c12378f2-36de-4bf7-8c5d-0ce754e727eb'
const actor = '33333333-3333-4333-8333-333333333333'
const privacy = '865a4d78-90ba-420d-84ed-526c70dd720f'
const version = '2026-11-01T20:00:00Z'
const contentVersion = 'sha256:4b4126fe2388687c899530cdb9ee973e744d9e0ebfd2b6378ac6b3702000342a'
const master = '2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36'
const thumbnail = '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0'
const mediaPath = '/review-assets/social-content/dark-castle-youtube-master-2026-10-29/dark-castle-youtube-master.mp4'
const imagePath = '/review-assets/social-content/dark-castle-youtube-master-2026-10-29/03-accidental-success-v2.png'
const keys = ['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']
const migration = readFileSync('supabase/migrations/20261102003655_prepare_youtube_platform_submission_review.sql', 'utf8')
const bundle = Object.fromEntries(keys.map(kind => [kind, { receipt_id: `${kind}-receipt`, status: 'approved',
  social_content_id: id, content_version: contentVersion,
  packet_id: `${kind}-packet`, evidence_fingerprint: `${kind}-fingerprint` }]))
const candidate = {
  post_text: 'Approved copy', cta_text: null, cta_url: null,
  youtube_title: 'Approved title', youtube_description: 'Approved description',
  video_url: mediaPath, media_sha256: master, image_url: imagePath,
  visual_sha256: `sha256:${thumbnail}`, thumbnail_direction: 'C',
  thumbnail_selection_receipt_id: 'thumbnail-selection-receipt',
  description_receipt_id: 'description-receipt', evidence_receipt_id: 'evidence-receipt',
}
const rag = {
  current_gate: 'platform_submission', latest_internal_decision_receipt_id: privacy,
  latest_internal_decision: 'approve', latest_internal_decision_command: 'approve_privacy',
  content_version: contentVersion, approved_visual_sha256: `sha256:${thumbnail}`,
  copy_review_candidate_projection: candidate,
  dark_castle_master_binding: { social_content_id: id, content_version: contentVersion, path: mediaPath,
    sha256: master, description_receipt_id: 'description-receipt', evidence_receipt_id: 'evidence-receipt' },
  dark_castle_thumbnail_binding: { social_content_id: id, content_version: contentVersion, path: imagePath,
    sha256: thumbnail, direction: 'C', receipt_id: 'thumbnail-selection-receipt' },
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
    scheduled_for TIMESTAMPTZ, published_at TIMESTAMPTZ, platform_post_id TEXT);
  CREATE TABLE public.social_content_publishes (content_id UUID, status TEXT);
  CREATE TABLE public.social_content_decision_receipts (id UUID PRIMARY KEY, social_content_id UUID,
    current_gate TEXT, decision TEXT, command_name TEXT, next_internal_gate TEXT,
    candidate_projection JSONB, receipt_bundle JSONB);
  CREATE TABLE public.dark_castle_prerequisite_receipts (receipt_id TEXT PRIMARY KEY, kind TEXT,
    social_content_id UUID, content_version TEXT, packet_id TEXT, evidence_fingerprint TEXT,
    artifact_hashes JSONB, receipt JSONB);
  CREATE TABLE public.agent_runs (id UUID PRIMARY KEY, agent_key TEXT, runtime TEXT, kind TEXT,
    title TEXT, status TEXT, subject_type TEXT, subject_id TEXT, subject_label TEXT,
    current_step TEXT, trigger_source TEXT, triggered_by_user_id UUID, metadata JSONB,
    idempotency_key TEXT UNIQUE, updated_at TIMESTAMPTZ);
  CREATE TABLE public.agent_approvals (id UUID PRIMARY KEY, run_id UUID, approval_type TEXT,
    status TEXT, requested_by_agent_key TEXT, metadata JSONB);
  CREATE TABLE public.agent_work_items (id UUID PRIMARY KEY, title TEXT, objective TEXT,
    status TEXT, priority TEXT, owner_agent_key TEXT, owner_runtime TEXT, source_type TEXT,
    source_id TEXT, source_label TEXT, source_run_id UUID, active_run_id UUID,
    overlap_group TEXT, validation_summary TEXT, approval_id UUID, metadata JSONB,
    idempotency_key TEXT UNIQUE, updated_at TIMESTAMPTZ);
  CREATE FUNCTION public.set_social_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
  CREATE TRIGGER set_social_updated_at BEFORE UPDATE ON public.social_content_queue
    FOR EACH ROW EXECUTE FUNCTION public.set_social_updated_at();
  GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
`
type Result = { work_item_id: string; approval_id: string; run_id: string; idempotent_replay: boolean; external_execution: boolean }
const key = `youtube-platform-submission-review:${id}:${privacy}:${contentVersion}:${version}`
const args = [id, version, privacy, contentVersion, master, thumbnail, 'C', actor, key]

async function setup() {
  const db = new PGlite()
  await db.exec(schema)
  await db.exec(migration)
  await db.query('INSERT INTO auth.users VALUES ($1::uuid)', [actor])
  await db.query(`INSERT INTO public.social_content_queue
    (id,platform,status,updated_at,rag_context,post_text,youtube_title,youtube_description,video_url,image_url)
    VALUES ($1::uuid,'youtube','draft',$2::timestamptz,$3::jsonb,$4,$5,$6,$7,$8)`,
    [id, version, JSON.stringify(rag), candidate.post_text, candidate.youtube_title,
      candidate.youtube_description, mediaPath, imagePath])
  await db.query(`INSERT INTO public.social_content_decision_receipts VALUES
    ($1::uuid,$2::uuid,'privacy','approve','approve_privacy','platform_submission',$3::jsonb,$4::jsonb)`,
    [privacy, id, JSON.stringify(candidate), JSON.stringify(bundle)])
  for (const kind of keys) {
    const row = { receipt_id: `${kind}-receipt`, status: 'approved', packet_id: `${kind}-packet`,
      evidence_fingerprint: `${kind}-fingerprint`, ...(kind === 'visual'
        ? { asset_sha256: `sha256:${thumbnail}`, asset_path: imagePath } : {}) }
    await db.query(`INSERT INTO public.dark_castle_prerequisite_receipts VALUES
      ($1,$2,$3::uuid,$4,$5,$6,$7::jsonb,$8::jsonb)`,
      [row.receipt_id, kind, id, contentVersion, row.packet_id, row.evidence_fingerprint,
        JSON.stringify({ master_sha256: master, thumbnail_sha256: thumbnail }), JSON.stringify(row)])
  }
  return db
}
async function call(db: PGlite, input: unknown[] = args) {
  const result = await db.query<{ result: Result }>(`SELECT public.prepare_youtube_platform_submission_review(
    $1::uuid,$2::timestamptz,$3::uuid,$4::text,$5::text,$6::text,$7::text,$8::uuid,$9::text) result`, input)
  return result.rows[0].result
}
async function counts(db: PGlite) {
  const result = await db.query<{ runs: number; approvals: number; work: number; publishes: number }>(`
    SELECT (SELECT count(*) FROM public.agent_runs)::int runs,
      (SELECT count(*) FROM public.agent_approvals)::int approvals,
      (SELECT count(*) FROM public.agent_work_items)::int work,
      (SELECT count(*) FROM public.social_content_publishes)::int publishes`)
  return result.rows[0]
}

describe('YouTube final platform-submission preparation in PostgreSQL', () => {
  it('is SECURITY INVOKER and service-role-only', async () => {
    const db = await setup()
    try {
      const privileges = await db.query<{ security_definer: boolean; anon: boolean; authenticated: boolean; service: boolean }>(`
        SELECT p.prosecdef security_definer,
          has_function_privilege('anon','public.prepare_youtube_platform_submission_review(uuid,timestamptz,uuid,text,text,text,text,uuid,text)','EXECUTE') anon,
          has_function_privilege('authenticated','public.prepare_youtube_platform_submission_review(uuid,timestamptz,uuid,text,text,text,text,uuid,text)','EXECUTE') authenticated,
          has_function_privilege('service_role','public.prepare_youtube_platform_submission_review(uuid,timestamptz,uuid,text,text,text,text,uuid,text)','EXECUTE') service
        FROM pg_proc p WHERE p.oid = 'public.prepare_youtube_platform_submission_review(uuid,timestamptz,uuid,text,text,text,text,uuid,text)'::regprocedure`)
      expect(privileges.rows[0]).toEqual({ security_definer: false, anon: false, authenticated: false, service: true })
      await expect(call(db)).rejects.toThrow('Service role required')
      await db.exec('SET ROLE service_role')
      expect((await call(db)).external_execution).toBe(false)
    } finally { await db.close() }
  })

  it('requires the API-verified operator identity', async () => {
    const db = await setup()
    try {
      await db.exec('SET ROLE service_role')
      await expect(call(db, [...args.slice(0, 7), null, key])).rejects.toThrow('Authenticated operator identity')
      expect(await counts(db)).toMatchObject({ runs: 0, approvals: 0, work: 0 })
    } finally { await db.close() }
  })

  it('creates one version-bound packet, replays exactly, and preserves content and media', async () => {
    const db = await setup()
    try {
      await db.exec('SET ROLE service_role')
      const first = await call(db)
      const second = await call(db)
      expect(first).toMatchObject({ idempotent_replay: false, external_execution: false })
      expect(second).toMatchObject({ work_item_id: first.work_item_id, approval_id: first.approval_id,
        run_id: first.run_id, idempotent_replay: true })
      expect(await counts(db)).toEqual({ runs: 1, approvals: 1, work: 1, publishes: 0 })
      const row = await db.query<{ post_text: string; video_url: string; image_url: string; packet: any }>(
        "SELECT post_text,video_url,image_url,rag_context->'mobile_decision_review' packet FROM public.social_content_queue")
      expect(row.rows[0]).toMatchObject({ post_text: candidate.post_text, video_url: mediaPath, image_url: imagePath,
        packet: { platform: 'youtube', privacy_decision_receipt_id: privacy, master_sha256: master,
          thumbnail_sha256: thumbnail, thumbnail_direction: 'C', source_receipts: bundle,
          candidate_projection: candidate, external_execution: false } })
    } finally { await db.close() }
  })

  it('ignores six historical receipts for another content version', async () => {
    const db = await setup()
    try {
      await db.query(`INSERT INTO public.dark_castle_prerequisite_receipts
        (receipt_id,kind,social_content_id,content_version,packet_id,evidence_fingerprint,artifact_hashes,receipt)
        SELECT receipt_id || '-historical',kind,social_content_id,$1,packet_id || '-historical',
          evidence_fingerprint,artifact_hashes,receipt
        FROM public.dark_castle_prerequisite_receipts`, [`sha256:${'f'.repeat(64)}`])
      await db.exec('SET ROLE service_role')
      expect(await call(db)).toMatchObject({ idempotent_replay: false, external_execution: false })
      expect(await counts(db)).toEqual({ runs: 1, approvals: 1, work: 1, publishes: 0 })
    } finally { await db.close() }
  })

  it('rejects an extra prerequisite identity for the current content version', async () => {
    const db = await setup()
    try {
      await db.query(`INSERT INTO public.dark_castle_prerequisite_receipts
        (receipt_id,kind,social_content_id,content_version,packet_id,evidence_fingerprint,artifact_hashes,receipt)
        SELECT 'source-extra',kind,social_content_id,content_version,'source-extra-packet',
          evidence_fingerprint,artifact_hashes,receipt
        FROM public.dark_castle_prerequisite_receipts WHERE kind='source'`)
      await db.exec('SET ROLE service_role')
      await expect(call(db)).rejects.toThrow('Exactly six unique immutable prerequisites required')
      expect(await counts(db)).toMatchObject({ runs: 0, approvals: 0, work: 0 })
    } finally { await db.close() }
  })

  it.each([
    ['stale version', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET post_text='Changed'")],
    ['wrong channel', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET platform='linkedin'")],
    ['wrong receipt', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET rag_context=jsonb_set(rag_context,'{latest_internal_decision_receipt_id}','\"11111111-1111-4111-8111-111111111111\"')")],
    ['wrong master', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET rag_context=jsonb_set(rag_context,'{dark_castle_master_binding,sha256}','\"wrong\"')")],
    ['wrong thumbnail', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET rag_context=jsonb_set(rag_context,'{dark_castle_thumbnail_binding,sha256}','\"wrong\"')")],
    ['wrong direction', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET rag_context=jsonb_set(rag_context,'{dark_castle_thumbnail_binding,direction}','\"B\"')")],
    ['duplicate prerequisite', async (db: PGlite) => db.query("UPDATE public.social_content_decision_receipts SET receipt_bundle=jsonb_set(receipt_bundle,'{voice,receipt_id}','\"source-receipt\"')")],
    ['missing prerequisite', async (db: PGlite) => db.query("DELETE FROM public.dark_castle_prerequisite_receipts WHERE kind='voice'")],
    ['immutable identity mismatch', async (db: PGlite) => db.query("UPDATE public.dark_castle_prerequisite_receipts SET receipt=jsonb_set(receipt,'{packet_id}','\"other-packet\"') WHERE kind='source'")],
    ['duplicate privacy decision', async (db: PGlite) => db.query(`INSERT INTO public.social_content_decision_receipts SELECT
      '11111111-1111-4111-8111-111111111111'::uuid,social_content_id,current_gate,decision,command_name,
      next_internal_gate,candidate_projection,receipt_bundle FROM public.social_content_decision_receipts`)],
    ['candidate drift', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET youtube_title='Changed title'")],
    ['publication activity', async (db: PGlite) => db.query("INSERT INTO public.social_content_publishes VALUES ($1::uuid,'draft')", [id])],
  ])('fails closed and rolls back for %s', async (_label, mutate) => {
    const db = await setup()
    try {
      await mutate(db)
      await db.exec('SET ROLE service_role')
      await expect(call(db)).rejects.toThrow()
      expect(await counts(db)).toMatchObject({ runs: 0, approvals: 0, work: 0 })
    } finally { await db.close() }
  })

  it('rolls back run, approval, and queue update if work insertion fails', async () => {
    const db = await setup()
    try {
      await db.exec(`CREATE FUNCTION public.fail_final_work() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'work insert failed'; END $$;
        CREATE TRIGGER fail_final_work BEFORE INSERT ON public.agent_work_items
          FOR EACH ROW EXECUTE FUNCTION public.fail_final_work();`)
      await db.exec('SET ROLE service_role')
      await expect(call(db)).rejects.toThrow('work insert failed')
      expect(await counts(db)).toMatchObject({ runs: 0, approvals: 0, work: 0 })
      const row = await db.query<{ updated_at: string; packet: unknown }>(
        "SELECT updated_at::text,rag_context->'mobile_decision_review' packet FROM public.social_content_queue")
      expect(new Date(row.rows[0].updated_at).toISOString()).toBe(new Date(version).toISOString())
      expect(row.rows[0].packet).toEqual({ current_gate: 'privacy' })
    } finally { await db.close() }
  })

  it('rejects replay when provider activity appears after preparation', async () => {
    const db = await setup()
    try {
      await db.exec('SET ROLE service_role')
      await call(db)
      await db.query("INSERT INTO public.social_content_publishes VALUES ($1::uuid,'draft')", [id])
      await expect(call(db)).rejects.toThrow('Provider or publication activity')
      expect(await counts(db)).toMatchObject({ runs: 1, approvals: 1, work: 1, publishes: 1 })
    } finally { await db.close() }
  })

  it('rejects a replay with another operator or changed idempotency identity', async () => {
    const db = await setup()
    try {
      const other = '44444444-4444-4444-8444-444444444444'
      await db.query('INSERT INTO auth.users VALUES ($1::uuid)', [other])
      await db.exec('SET ROLE service_role')
      await call(db)
      await expect(call(db, [...args.slice(0, 7), other, key])).rejects.toThrow('identity mismatched')
      await expect(call(db, [...args.slice(0, 8), `${key}:changed`])).rejects.toThrow('identity mismatched')
      expect(await counts(db)).toMatchObject({ runs: 1, approvals: 1, work: 1 })
    } finally { await db.close() }
  })

  it('has no provider or publication mutation path', () => {
    expect(migration).not.toMatch(/net\.http|http_post|storage\.objects|INSERT INTO public\.social_content_publishes|UPDATE public\.social_content_publishes/i)
  })
})
