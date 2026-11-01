import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const itemId = '11111111-1111-4111-8111-111111111111'
const copyReceiptId = '22222222-2222-4222-8222-222222222222'
const actorId = '33333333-3333-4333-8333-333333333333'
const wrongRunId = '44444444-4444-4444-8444-444444444444'
const itemVersion = '2026-10-31T20:55:13Z'
const receiptVersion = '2026-10-31T14:17:04Z'
const assetHash = `sha256:${'a'.repeat(64)}`
const assetPath = '/review-assets/social-content/visual.png'
const candidate = {
  post_text: 'Approved copy', cta_text: 'Approved CTA', cta_url: 'https://example.com/scorecard',
  image_url: assetPath, visual_sha256: assetHash, external_execution: false,
}
const receipts = Object.fromEntries(
  ['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'].map(key => [key, {
    status: 'approved', receipt_id: key === 'visual' ? `visual:fixture:${assetHash}` : `${key}:fixture`,
    content_updated_at: receiptVersion,
  }]),
)
const rag = {
  current_gate: 'visual_review', latest_internal_decision_receipt_id: copyReceiptId,
  latest_internal_decision: 'approve', copy_review_candidate_projection: candidate,
  approved_visual_sha256: assetHash,
}
const schema = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TABLE public.social_content_queue (
    id UUID PRIMARY KEY, updated_at TIMESTAMPTZ NOT NULL, rag_context JSONB,
    post_text TEXT, cta_text TEXT, cta_url TEXT, image_url TEXT
  );
  CREATE FUNCTION public.set_social_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
  CREATE TRIGGER set_social_updated_at BEFORE UPDATE ON public.social_content_queue
    FOR EACH ROW EXECUTE FUNCTION public.set_social_updated_at();
  CREATE TABLE public.social_content_decision_receipts (
    id UUID PRIMARY KEY, social_content_id UUID, decision TEXT, next_internal_gate TEXT,
    current_gate TEXT, command_name TEXT, receipt_bundle JSONB, candidate_projection JSONB,
    content_updated_at TIMESTAMPTZ
  );
  CREATE TABLE public.agent_runs (
    id UUID PRIMARY KEY, agent_key TEXT, runtime TEXT, kind TEXT, title TEXT,
    status TEXT, subject_type TEXT, subject_id TEXT, subject_label TEXT,
    current_step TEXT, trigger_source TEXT, triggered_by_user_id UUID,
    metadata JSONB, idempotency_key TEXT, updated_at TIMESTAMPTZ
  );
  CREATE TABLE public.agent_approvals (
    id UUID PRIMARY KEY, run_id UUID, approval_type TEXT, status TEXT,
    requested_by_agent_key TEXT, metadata JSONB
  );
  CREATE TABLE public.agent_work_items (
    id UUID PRIMARY KEY, title TEXT, objective TEXT, status TEXT, priority TEXT,
    owner_agent_key TEXT, owner_runtime TEXT, source_type TEXT, source_id TEXT,
    source_label TEXT, source_run_id UUID, active_run_id UUID, overlap_group TEXT,
    validation_summary TEXT, approval_id UUID, metadata JSONB,
    idempotency_key TEXT UNIQUE, updated_at TIMESTAMPTZ
  );
`

const migration = readFileSync(path.join(
  process.cwd(), 'supabase/migrations/20261101001807_bind_visual_packet_replay_approval_run.sql',
), 'utf8')

async function prepare(db: PGlite, version: string) {
  const result = await db.query<{ packet: { work_item_id: string; approval_id: string; run_id: string; content_updated_at: string; idempotent_replay: boolean } }>(
    'SELECT public.prepare_social_content_stage_review($1::uuid, $2::timestamptz, $3::text, $4::uuid, $5::text) AS packet',
    [itemId, version, 'visual_review', actorId, `social-stage-review:${itemId}:visual_review:${version}`],
  )
  return result.rows[0].packet
}

describe('visual review packet replay in PostgreSQL', () => {
  it('prepares and replays a valid packet, then rejects a pending approval bound to another run', async () => {
    const db = new PGlite()
    try {
      await db.exec(schema)
      await db.exec(migration)
      await db.query(
        `INSERT INTO public.social_content_queue
         (id, updated_at, rag_context, post_text, cta_text, cta_url, image_url)
         VALUES ($1::uuid, $2::timestamptz, $3::jsonb, $4, $5, $6, $7)`,
        [itemId, itemVersion, JSON.stringify(rag), candidate.post_text, candidate.cta_text, candidate.cta_url, assetPath],
      )
      await db.query(
        `INSERT INTO public.social_content_decision_receipts
         (id, social_content_id, decision, next_internal_gate, current_gate, command_name,
          receipt_bundle, candidate_projection, content_updated_at)
         VALUES ($1::uuid, $2::uuid, 'approve', 'visual_review', 'copy_review', 'approve_copy',
                 $3::jsonb, $4::jsonb, $5::timestamptz)`,
        [copyReceiptId, itemId, JSON.stringify(receipts), JSON.stringify(candidate), receiptVersion],
      )

      const first = await prepare(db, itemVersion)
      expect(first.idempotent_replay).toBe(false)
      const validReplay = await prepare(db, first.content_updated_at)
      expect(validReplay).toMatchObject({
        work_item_id: first.work_item_id,
        approval_id: first.approval_id,
        run_id: first.run_id,
        idempotent_replay: true,
      })

      await db.query('UPDATE public.agent_approvals SET run_id = $1::uuid WHERE id = $2::uuid', [wrongRunId, first.approval_id])
      await expect(prepare(db, first.content_updated_at)).rejects.toThrow('Existing review packet identity or version mismatch')
      await expect(prepare(db, itemVersion)).rejects.toThrow('Existing review packet identity or version mismatch')
      const works = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.agent_work_items')
      expect(works.rows[0].count).toBe('1')
    } finally {
      await db.close()
    }
  })
})
