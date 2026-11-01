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
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TABLE public.social_content_queue (
    id UUID PRIMARY KEY, status TEXT, platform TEXT, updated_at TIMESTAMPTZ, rag_context JSONB,
    post_text TEXT, cta_text TEXT, cta_url TEXT, image_url TEXT, hashtags TEXT[],
    scheduled_for TIMESTAMPTZ, published_at TIMESTAMPTZ, platform_post_id TEXT, platform_post_url TEXT
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
    metadata JSONB, idempotency_key TEXT UNIQUE
  );
`
const migration = readFileSync('supabase/migrations/20261101101235_create_receipt_backed_linkedin_handoff.sql', 'utf8')
const stages = [
  ['22222222-2222-4222-8222-222222222222', 'copy_review', 'visual_review', 'approve_copy', '2026-11-01T00:10:00Z'],
  ['44444444-4444-4444-8444-444444444444', 'visual_review', 'asset_packet', 'approve_visual_review', '2026-11-01T00:20:00Z'],
  ['55555555-5555-4555-8555-555555555555', 'asset_packet', 'privacy', 'approve_asset_packet', '2026-11-01T00:30:00Z'],
  [privacyId, 'privacy', 'platform_submission', 'approve_privacy', '2026-11-01T00:40:00Z'],
]
async function fixture() {
  const db = new PGlite()
  await db.exec(schema)
  await db.exec(migration)
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

describe('receipt-backed LinkedIn handoff in PostgreSQL', () => {
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
})
