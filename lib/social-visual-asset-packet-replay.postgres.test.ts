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

type Receipt = {
  status: string
  receipt_id: string
  content_updated_at: string
  asset_path?: string
  asset_sha256?: string
}

type FixtureCandidate = {
  post_text: string
  cta_text: string
  cta_url: string
  image_url: string
  visual_sha256: string
  external_execution: boolean
  lead_magnet_receipt_id?: string
  artifact_evidence_manifest?: { id: string }
}

type Fixture = {
  candidate: FixtureCandidate
  receipts: Record<string, Receipt>
  rag: {
    current_gate: string
    latest_internal_decision_receipt_id: string
    latest_internal_decision: string
    copy_review_candidate_projection: FixtureCandidate
    approved_visual_sha256: string
    lead_magnet_receipt?: { receipt_id: string; status: string; url: string }
    artifact_evidence_manifest?: { id: string }
  }
  postText: string
  ctaText: string
  ctaUrl: string
  imageUrl: string
  commandName: string
  currentGate: string
  decision: string
  nextGate: string
  insertReceipt: boolean
  receiptBundle: unknown
}

function freshFixture(): Fixture {
  const nextCandidate = structuredClone(candidate) as FixtureCandidate
  const nextReceipts = structuredClone(receipts) as Record<string, Receipt>
  return {
    candidate: nextCandidate,
    receipts: nextReceipts,
    rag: {
      current_gate: 'visual_review',
      latest_internal_decision_receipt_id: copyReceiptId,
      latest_internal_decision: 'approve',
      copy_review_candidate_projection: nextCandidate,
      approved_visual_sha256: nextCandidate.visual_sha256,
    },
    postText: nextCandidate.post_text,
    ctaText: nextCandidate.cta_text,
    ctaUrl: nextCandidate.cta_url,
    imageUrl: nextCandidate.image_url,
    commandName: 'approve_copy',
    currentGate: 'copy_review',
    decision: 'approve',
    nextGate: 'visual_review',
    insertReceipt: true,
    receiptBundle: nextReceipts,
  }
}

async function reseed(db: PGlite, adjust?: (fixture: Fixture) => void) {
  const fixture = freshFixture()
  adjust?.(fixture)
  await db.exec('TRUNCATE public.agent_work_items, public.agent_approvals, public.agent_runs, public.social_content_decision_receipts, public.social_content_queue')
  await db.query(
    `INSERT INTO public.social_content_queue
     (id, updated_at, rag_context, post_text, cta_text, cta_url, image_url)
     VALUES ($1::uuid, $2::timestamptz, $3::jsonb, $4, $5, $6, $7)`,
    [itemId, itemVersion, JSON.stringify(fixture.rag), fixture.postText, fixture.ctaText, fixture.ctaUrl, fixture.imageUrl],
  )
  if (fixture.insertReceipt) {
    await db.query(
      `INSERT INTO public.social_content_decision_receipts
       (id, social_content_id, decision, next_internal_gate, current_gate, command_name,
        receipt_bundle, candidate_projection, content_updated_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::timestamptz)`,
      [
        copyReceiptId,
        itemId,
        fixture.decision,
        fixture.nextGate,
        fixture.currentGate,
        fixture.commandName,
        fixture.receiptBundle === null ? null : JSON.stringify(fixture.receiptBundle),
        JSON.stringify(fixture.candidate),
        receiptVersion,
      ],
    )
  }
}

async function openFixture(adjust?: (fixture: Fixture) => void) {
  const db = new PGlite()
  await db.exec(schema)
  await db.exec(migration)
  await reseed(db, adjust)
  return db
}

async function workItemCount(db: PGlite) {
  const works = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.agent_work_items')
  return works.rows[0].count
}

async function prepare(db: PGlite, version: string, gate = 'visual_review', idempotencyKey = `social-stage-review:${itemId}:${gate}:${version}`) {
  const result = await db.query<{ packet: { work_item_id: string; approval_id: string; run_id: string; content_updated_at: string; idempotent_replay: boolean } }>(
    'SELECT public.prepare_social_content_stage_review($1::uuid, $2::timestamptz, $3::text, $4::uuid, $5::text) AS packet',
    [itemId, version, gate, actorId, idempotencyKey],
  )
  return result.rows[0].packet
}

async function expectClosed(db: PGlite, message: string, adjust?: (fixture: Fixture) => void, version = itemVersion, gate = 'visual_review', idempotencyKey?: string) {
  await reseed(db, adjust)
  await expect(prepare(db, version, gate, idempotencyKey)).rejects.toThrow(message)
  expect(await workItemCount(db)).toBe('0')
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
      expect(await workItemCount(db)).toBe('1')
    } finally {
      await db.close()
    }
  })

  it('rejects stage, copy, asset, and receipt drift before writing a packet', async () => {
    const db = new PGlite()
    try {
      await db.exec(schema)
      await db.exec(migration)
      await expectClosed(db, 'Social Content stage preparation is stale', undefined, '2020-01-01T00:00:00Z')
      await expectClosed(db, 'Social Content current gate does not match requested stage', undefined, itemVersion, 'asset_packet')
      await expectClosed(db, 'Review preparation idempotency key is required', undefined, itemVersion, 'visual_review', '   ')
      await expectClosed(db, 'Unsupported Social Content review stage', undefined, itemVersion, 'copy_review')
      await expectClosed(db, 'Exact approved prior copy decision receipt is required', (fixture) => {
        fixture.commandName = 'approve_visual'
      })
      await expectClosed(db, 'Exact approved prior-stage decision receipt is required', (fixture) => {
        fixture.insertReceipt = false
      })
      await expectClosed(db, 'Prior-stage receipt bundle is missing', (fixture) => {
        fixture.receiptBundle = []
      })
      await expectClosed(db, 'Current copy, CTA, visual, or candidate projection identity mismatch', (fixture) => {
        fixture.postText = 'Edited after approval'
      })
      await expectClosed(db, 'Safe exact visual asset hash and path are required', (fixture) => {
        const hash = `sha256:${'A'.repeat(64)}`
        fixture.candidate.visual_sha256 = hash
        fixture.rag.approved_visual_sha256 = hash
      })
      await expectClosed(db, 'Safe exact visual asset hash and path are required', (fixture) => {
        const unsafe = 'https://cdn.example.com/visual.png?download=1'
        fixture.candidate.image_url = unsafe
        fixture.imageUrl = unsafe
      })
      await expectClosed(db, 'An approved visual receipt is required', (fixture) => {
        fixture.receipts.visual.status = 'passed'
      })
      await expectClosed(db, 'An approved visual receipt is required', (fixture) => {
        fixture.receipts.visual.status = 'APPROVED'
      })
      await expectClosed(db, 'Approved visual receipt is not bound to the exact asset hash', (fixture) => {
        fixture.receipts.visual.receipt_id = 'visual:fixture:unbound'
      })
      await expectClosed(db, 'Approved visual receipt is not bound to the exact asset path', (fixture) => {
        fixture.receipts.visual.asset_path = '/review-assets/other.png'
      })
      await expectClosed(db, 'Lead-magnet receipt identity or URL mismatch', (fixture) => {
        fixture.candidate.lead_magnet_receipt_id = 'lead:1'
        fixture.rag.lead_magnet_receipt = {
          receipt_id: 'lead:1',
          status: 'approved',
          url: 'https://example.com/other',
        }
      })
      await expectClosed(db, 'Artifact lineage does not match the current candidate', (fixture) => {
        fixture.candidate.artifact_evidence_manifest = { id: 'manifest-current' }
        fixture.rag.artifact_evidence_manifest = { id: 'manifest-other' }
      })
      await expectClosed(db, 'Duplicate or ambiguous prior-stage receipt identity for voice', (fixture) => {
        fixture.receipts.voice.receipt_id = fixture.receipts.source.receipt_id
      })
      await expectClosed(db, 'Prior-stage framework receipt is missing, pending, malformed, or stale', (fixture) => {
        fixture.receipts.framework.receipt_id = '   '
      })
      await expectClosed(db, 'Prior-stage privacy receipt is missing, pending, malformed, or stale', (fixture) => {
        fixture.receipts.privacy.content_updated_at = '2020-01-01T00:00:00Z'
      })
    } finally {
      await db.close()
    }
  })

  it('rejects a later clock and a rewritten packet timestamp without creating another packet', async () => {
    const db = await openFixture()
    try {
      const first = await prepare(db, itemVersion)
      await expect(prepare(db, '2026-11-01T00:00:00Z')).rejects.toThrow('Social Content stage preparation is stale')
      await db.query(
        `UPDATE public.social_content_queue
         SET rag_context = jsonb_set(rag_context, '{mobile_decision_review,content_updated_at}', '"2020-01-01T00:00:00Z"'::jsonb)
         WHERE id = $1::uuid`,
        [itemId],
      )
      await expect(prepare(db, first.content_updated_at)).rejects.toThrow('Existing review packet is stale')
      expect(await workItemCount(db)).toBe('1')
    } finally {
      await db.close()
    }
  })
})
