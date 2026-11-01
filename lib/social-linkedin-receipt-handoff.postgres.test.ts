import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const contentId = '563d3ee1-e5b9-41bb-89f3-9273ea017272'
const actorId = '33333333-3333-4333-8333-333333333333'
const privacyId = 'e935496a-e026-494a-9ab2-c9ae78d56060'
const version = '2026-11-01T01:00:00Z'
const assetHash = 'sha256:88f26176acb339f10373dc39637e91ca8235f5cc3075f39ff737b97672a86091'
const assetPath = '/review-assets/social-content/dark-castle-linkedin.png'
const candidate = { post_text: 'Approved copy', cta_text: 'Review the product', cta_url: null, image_url: assetPath, visual_sha256: assetHash }
const receipts = (receiptVersion: string) => Object.fromEntries(['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'].map(key => [key, {
  receipt_id: key === 'visual' ? `visual:${assetHash}` : `${key}:receipt`, status: 'approved', content_updated_at: receiptVersion,
}]))
const rag = {
  current_gate: 'platform_submission', latest_internal_decision: 'approve', latest_internal_decision_command: 'approve_privacy',
  latest_internal_decision_receipt_id: privacyId, approved_visual_sha256: assetHash, copy_review_candidate_projection: candidate,
}
const schema = `
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY);
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TABLE public.social_content_queue (
    id UUID PRIMARY KEY, status TEXT, platform TEXT, updated_at TIMESTAMPTZ, rag_context JSONB,
    post_text TEXT, cta_text TEXT, cta_url TEXT, image_url TEXT, hashtags TEXT[],
    scheduled_for TIMESTAMPTZ, published_at TIMESTAMPTZ, platform_post_id TEXT
  );
  CREATE TABLE public.social_content_publishes (content_id UUID, status TEXT);
  CREATE TABLE public.social_content_decision_receipts (
    id UUID PRIMARY KEY, social_content_id UUID, decision TEXT, current_gate TEXT,
    next_internal_gate TEXT, command_name TEXT, receipt_bundle JSONB, candidate_projection JSONB,
    content_updated_at TIMESTAMPTZ, created_at TIMESTAMPTZ
  );
  CREATE TABLE public.agent_work_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT, objective TEXT, status TEXT,
    priority TEXT, owner_agent_key TEXT, source_type TEXT, source_id TEXT, source_label TEXT,
    metadata JSONB, idempotency_key TEXT UNIQUE, validation_summary TEXT, blocker_summary TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), owner_runtime TEXT, source_run_id UUID,
    active_run_id UUID, overlap_group TEXT, approval_id UUID
  );
  CREATE TABLE public.agent_runs (
    id UUID PRIMARY KEY, agent_key TEXT, runtime TEXT, kind TEXT, title TEXT, status TEXT,
    subject_type TEXT, subject_id TEXT, subject_label TEXT, current_step TEXT,
    trigger_source TEXT, triggered_by_user_id UUID, metadata JSONB,
    idempotency_key TEXT UNIQUE, updated_at TIMESTAMPTZ
  );
  CREATE TABLE public.agent_approvals (
    id UUID PRIMARY KEY, run_id UUID, approval_type TEXT, status TEXT,
    requested_by_agent_key TEXT, metadata JSONB
  );
`
const migration = readFileSync('supabase/migrations/20261101101235_create_receipt_backed_linkedin_handoff.sql', 'utf8')
const repairMigration = readFileSync('supabase/migrations/20261101103938_repair_receipt_backed_linkedin_handoff_queue_shape.sql', 'utf8')
const reviewMigration = readFileSync('supabase/migrations/20261101113227_linkedin_handoff_internal_review.sql', 'utf8')
const reviewBindingRepair = readFileSync('supabase/migrations/20261101121934_repair_linkedin_handoff_review_timestamp_binding.sql', 'utf8')
const finalReviewMigration = readFileSync('supabase/migrations/20261101132203_prepare_linkedin_platform_submission_review.sql', 'utf8')
const stages = [
  ['22222222-2222-4222-8222-222222222222', 'copy_review', 'visual_review', 'approve_copy', '2026-11-01T00:10:00Z'],
  ['44444444-4444-4444-8444-444444444444', 'visual_review', 'asset_packet', 'approve_visual_review', '2026-11-01T00:20:00Z'],
  ['55555555-5555-4555-8555-555555555555', 'asset_packet', 'privacy', 'approve_asset_packet', '2026-11-01T00:30:00Z'],
  [privacyId, 'privacy', 'platform_submission', 'approve_privacy', '2026-11-01T00:40:00Z'],
]
async function fixture(stagingOldFunction = false) {
  const db = new PGlite()
  await db.exec(schema)
  await db.exec(stagingOldFunction
    ? migration.replace('OR v_item.platform_post_id IS NOT NULL', 'OR v_item.platform_post_id IS NOT NULL OR v_item.platform_post_url IS NOT NULL')
    : migration)
  await db.exec(repairMigration)
  await db.exec(reviewMigration)
  await db.exec(reviewBindingRepair)
  await db.exec(finalReviewMigration)
  await db.query('INSERT INTO auth.users (id) VALUES ($1::uuid)', [actorId])
  await db.query(`INSERT INTO public.social_content_queue
    (id, status, platform, updated_at, rag_context, post_text, cta_text, image_url, hashtags)
    VALUES ($1::uuid, 'approved', 'linkedin', $2::timestamptz, $3::jsonb, $4, $5, $6, ARRAY['chess'])`,
    [contentId, version, JSON.stringify(rag), candidate.post_text, candidate.cta_text, assetPath])
  for (const [id, gate, next, command, created] of stages) {
    await db.query(`INSERT INTO public.social_content_decision_receipts
      (id, social_content_id, decision, current_gate, next_internal_gate, command_name, receipt_bundle, candidate_projection, content_updated_at, created_at)
      VALUES ($1::uuid, $2::uuid, 'approve', $3, $4, $5, $6::jsonb, $7::jsonb, $8::timestamptz, $9::timestamptz)`,
      [id, contentId, gate, next, command, JSON.stringify(receipts(created)), JSON.stringify(candidate), created, created])
  }
  return db
}
async function handoff(db: PGlite, expected = version, receipt = privacyId) {
  const result = await db.query<{ result: { handoff: Record<string, any>; idempotent_replay: boolean } }>(
    'SELECT public.create_receipt_backed_linkedin_handoff($1::uuid, $2::timestamptz, $3::uuid, $4::uuid) AS result',
    [contentId, expected, receipt, actorId])
  return result.rows[0].result
}

async function reviewHandoff(db: PGlite, workItemId: string, createdAt: string) {
  const result = await db.query<{ result: { id: string; decision: string; next_internal_gate: string; external_execution: boolean } }>(
    `SELECT public.record_social_linkedin_handoff_decision(
      $1::uuid, $2::uuid, $3::uuid, $4::timestamptz, 'approve', $5::uuid, NULL,
      $6
    ) AS result`,
    [contentId, workItemId, privacyId, createdAt, actorId,
      `linkedin-handoff-review:${workItemId}:${privacyId}:approve`]
  )
  return result.rows[0].result
}

async function prepareFinalReview(db: PGlite, expected: string, receiptId: string) {
  const result = await db.query<{ result: { work_item_id: string; approval_id: string; run_id: string; idempotent_replay: boolean; external_execution: boolean } }>(
    `SELECT public.prepare_linkedin_platform_submission_review(
      $1::uuid, $2::timestamptz, $3::uuid, $4::uuid, $5
    ) AS result`,
    [contentId, expected, receiptId, actorId, `social-platform-submission-review:${contentId}:${receiptId}:${expected}`],
  )
  return result.rows[0].result
}

describe('receipt-backed LinkedIn handoff in PostgreSQL', () => {
  it('replaces the function already installed on staging before a real-schema call', async () => {
    const db = await fixture(true)
    try {
      const result = await handoff(db)
      expect(result.handoff.external_account_draft_created).toBe(false)
      expect(result.idempotent_replay).toBe(false)
    } finally { await db.close() }
  })
  it('creates one internal handoff and replays the exact version without another work item', async () => {
    const db = await fixture()
    try {
      const first = await handoff(db)
      expect(first.idempotent_replay).toBe(false)
      expect(first.handoff).toMatchObject({ version: 'linkedin_draft_handoff_v2', external_account_draft_created: false,
        external_execution: false, privacy_decision_receipt_id: privacyId, approved_visual_sha256: assetHash,
        candidate_projection: candidate })
      const replay = await handoff(db)
      expect(replay.idempotent_replay).toBe(true)
      expect(replay.handoff.work_item.id).toBe(first.handoff.work_item.id)
      const count = await db.query<{ count: string }>('SELECT count(*)::text AS count FROM public.agent_work_items')
      expect(count.rows[0].count).toBe('1')
      await expect(handoff(db, '2026-11-01T02:00:00Z')).rejects.toThrow('another version')
    } finally { await db.close() }
  })

  it.each([
    ['stale version', async (db: PGlite) => db.query('UPDATE public.social_content_queue SET updated_at = $1 WHERE id = $2', ['2026-11-01T02:00:00Z', contentId])],
    ['wrong channel', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET platform = 'youtube'")],
    ['privacy receipt mismatch', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET rag_context = jsonb_set(rag_context, '{latest_internal_decision_receipt_id}', '" + '"66666666-6666-4666-8666-666666666666"' + "')")],
    ['visual mismatch', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET rag_context = jsonb_set(rag_context, '{approved_visual_sha256}', '" + '"sha256:' + '0'.repeat(64) + '"' + "')")],
    ['ambiguous lineage', async (db: PGlite) => db.query(`INSERT INTO public.social_content_decision_receipts SELECT '77777777-7777-4777-8777-777777777777'::uuid, social_content_id, decision, current_gate, next_internal_gate, command_name, receipt_bundle, candidate_projection, content_updated_at, created_at FROM public.social_content_decision_receipts WHERE current_gate = 'visual_review'`)],
    ['publication evidence', async (db: PGlite) => db.query("INSERT INTO public.social_content_publishes VALUES ($1, 'draft')", [contentId])],
    ['queue provider identity', async (db: PGlite) => db.query("UPDATE public.social_content_queue SET platform_post_id = 'provider-post-1'")],
    ['missing receipt', async (db: PGlite) => db.query("UPDATE public.social_content_decision_receipts SET receipt_bundle = receipt_bundle - 'privacy' WHERE current_gate = 'privacy'")],
    ['receipt visual mismatch', async (db: PGlite) => db.query("UPDATE public.social_content_decision_receipts SET receipt_bundle = jsonb_set(receipt_bundle, '{visual,receipt_id}', '" + '"visual:wrong"' + "') WHERE current_gate = 'privacy'")],
    ['duplicate work item', async (db: PGlite) => db.query("INSERT INTO public.agent_work_items (source_type, source_id, idempotency_key) VALUES ('social_content_linkedin_draft_handoff', $1, 'other')", [contentId])],
    ['out of order', async (db: PGlite) => db.query("UPDATE public.social_content_decision_receipts SET created_at = '2026-11-01T00:05:00Z' WHERE current_gate = 'asset_packet'")],
  ])('fails closed for %s', async (_name, mutate) => {
    const db = await fixture()
    try {
      await mutate(db)
      await expect(handoff(db)).rejects.toThrow()
      const count = await db.query<{ count: string }>('SELECT count(*)::text AS count FROM public.agent_work_items')
      expect(count.rows[0].count).toBe(_name === 'duplicate work item' ? '1' : '0')
    } finally { await db.close() }
  })

  it('contains no provider or external action path', () => {
    expect(migration).not.toMatch(/net\.http|http_post|storage\.objects|INSERT INTO public\.social_content_publishes|UPDATE public\.social_content_publishes/i)
    expect(migration).toContain("'external_account_draft_created', false")
  })

  it('rejects provider evidence that appears after the handoff on replay', async () => {
    const db = await fixture()
    try {
      await handoff(db)
      await db.query("INSERT INTO public.social_content_publishes VALUES ($1, 'draft')", [contentId])
      await expect(handoff(db)).rejects.toThrow('provider or publication evidence')
    } finally { await db.close() }
  })

  it('records the exact internal decision when persisted row versions match but the packet clock differs', async () => {
    const db = await fixture()
    try {
      const prepared = await handoff(db)
      const workItemId = prepared.handoff.work_item.id as string
      const createdAt = prepared.handoff.created_at as string
      const persistedAt = '2026-11-01T11:10:52.302227Z'
      expect(new Date(createdAt).toISOString()).not.toBe(new Date(persistedAt).toISOString())
      await db.query('UPDATE public.social_content_queue SET updated_at = $1::timestamptz WHERE id = $2::uuid', [persistedAt, contentId])
      await db.query('UPDATE public.agent_work_items SET updated_at = $1::timestamptz WHERE id = $2::uuid', [persistedAt, workItemId])

      const decision = await reviewHandoff(db, workItemId, createdAt)
      expect(decision).toMatchObject({ decision: 'approve', next_internal_gate: 'final_platform_submission_readiness', external_execution: false })
      const rows = await db.query<{ status: string; receipt: string; publishes: string }>(`
        SELECT w.status, w.metadata->>'handoff_review_receipt_id' AS receipt,
          (SELECT count(*)::text FROM public.social_content_publishes) AS publishes
        FROM public.agent_work_items w WHERE w.id = $1::uuid`, [workItemId])
      expect(rows.rows[0]).toMatchObject({ status: 'blocked', receipt: decision.id, publishes: '0' })
    } finally { await db.close() }
  })

  it('still rejects a queue version that no longer matches its bound handoff work item', async () => {
    const db = await fixture()
    try {
      const prepared = await handoff(db)
      const workItemId = prepared.handoff.work_item.id as string
      await db.query("UPDATE public.social_content_queue SET updated_at = '2026-11-01T12:00:00Z' WHERE id = $1::uuid", [contentId])
      await db.query("UPDATE public.agent_work_items SET updated_at = '2026-11-01T11:00:00Z' WHERE id = $1::uuid", [workItemId])
      await expect(reviewHandoff(db, workItemId, prepared.handoff.created_at as string)).rejects.toThrow('stale')
      const count = await db.query<{ count: string }>('SELECT count(*)::text AS count FROM public.social_linkedin_handoff_decisions')
      expect(count.rows[0].count).toBe('0')
    } finally { await db.close() }
  })

  it('prepares and replays exactly one final platform-submission Decision Queue packet', async () => {
    const db = await fixture()
    try {
      const prepared = await handoff(db)
      const handoffWorkId = prepared.handoff.work_item.id as string
      await db.query("UPDATE public.social_content_queue SET updated_at = '2026-11-01T11:10:52.302227Z' WHERE id = $1::uuid", [contentId])
      await db.query("UPDATE public.agent_work_items SET updated_at = '2026-11-01T11:10:52.302227Z' WHERE id = $1::uuid", [handoffWorkId])
      const decision = await reviewHandoff(db, handoffWorkId, prepared.handoff.created_at as string)
      const state = await db.query<{ updated_at: string }>('SELECT updated_at::text FROM public.social_content_queue WHERE id = $1::uuid', [contentId])
      const first = await prepareFinalReview(db, state.rows[0].updated_at, decision.id)
      expect(first).toMatchObject({ idempotent_replay: false, external_execution: false })
      const live = await db.query<{ updated_at: string }>('SELECT updated_at::text FROM public.social_content_queue WHERE id = $1::uuid', [contentId])
      const replay = await prepareFinalReview(db, live.rows[0].updated_at, decision.id)
      expect(replay).toMatchObject({ work_item_id: first.work_item_id, approval_id: first.approval_id, run_id: first.run_id, idempotent_replay: true })
      const rows = await db.query<{ reviews: string; publishes: string }>(`
        SELECT count(*) FILTER (WHERE source_type = 'social_content_internal_review')::text AS reviews,
          (SELECT count(*)::text FROM public.social_content_publishes) AS publishes
        FROM public.agent_work_items`)
      expect(rows.rows[0]).toEqual({ reviews: '1', publishes: '0' })
    } finally { await db.close() }
  })

  it('fails final preparation closed for a mismatched handoff receipt or provider evidence', async () => {
    const db = await fixture()
    try {
      const prepared = await handoff(db)
      const handoffWorkId = prepared.handoff.work_item.id as string
      await db.query("UPDATE public.social_content_queue SET updated_at = '2026-11-01T11:10:52.302227Z' WHERE id = $1::uuid", [contentId])
      await db.query("UPDATE public.agent_work_items SET updated_at = '2026-11-01T11:10:52.302227Z' WHERE id = $1::uuid", [handoffWorkId])
      const decision = await reviewHandoff(db, handoffWorkId, prepared.handoff.created_at as string)
      const state = await db.query<{ updated_at: string }>('SELECT updated_at::text FROM public.social_content_queue WHERE id = $1::uuid', [contentId])
      await expect(prepareFinalReview(db, state.rows[0].updated_at, privacyId)).rejects.toThrow()
      await db.query("INSERT INTO public.social_content_publishes VALUES ($1::uuid, 'pending')", [contentId])
      await expect(prepareFinalReview(db, state.rows[0].updated_at, decision.id)).rejects.toThrow('provider or publication evidence')
    } finally { await db.close() }
  })

  it('contains no provider, upload, or publish-row mutation path', () => {
    expect(finalReviewMigration).not.toMatch(/net\.http|http_post|storage\.objects|INSERT INTO public\.social_content_publishes|UPDATE public\.social_content_publishes/i)
    expect(finalReviewMigration).toContain("'external_execution', false")
    expect(finalReviewMigration).toContain('SECURITY INVOKER')
  })
})
