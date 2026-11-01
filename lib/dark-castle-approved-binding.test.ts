import { describe, expect, it } from 'vitest'
import { inspectDarkCastleApprovedBinding, type ApprovedArtifactIdentity } from './dark-castle-approved-binding'
import { DARK_CASTLE_COPY_CALENDAR_ID, DARK_CASTLE_COPY_CONTENT_ID } from './dark-castle-copy-review-binding'

const updated = '2026-11-01T14:00:00Z'
const approved: ApprovedArtifactIdentity = { contentVersion: 'content-v1', masterSha256: 'master-hash', masterPath: '/master.mp4',
  thumbnailSha256: 'thumbnail-hash', thumbnailPath: '/thumb.png', thumbnailDirection: 'C', selectionReceiptId: 'selection-1',
  descriptionReceiptId: 'description-1', evidenceReceiptId: 'evidence-1' }
const calendar = () => [{ id: DARK_CASTLE_COPY_CALENDAR_ID, social_content_id: DARK_CASTLE_COPY_CONTENT_ID, due_status: 'due_soon' }]
const receipts = () => Object.fromEntries(['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'].map(key => [key,
  { receipt_id: `${key}-1`, status: 'approved', content_updated_at: updated }]))
const item = () => ({ id: DARK_CASTLE_COPY_CONTENT_ID, updated_at: updated, platform: 'youtube', status: 'draft',
  video_url: null as string | null, image_url: null as string | null, description_sha256: 'description-hash', rag_context: {
    content_version: 'content-v1', copy_review_evidence_receipts: receipts(),
    youtube_description_receipt: { receipt_id: 'description-1', social_content_id: DARK_CASTLE_COPY_CONTENT_ID,
      content_version: 'content-v1', description_sha256: 'description-hash', evidence_input_fingerprint: 'fingerprint-1' },
    description_evidence_reconciliation_receipt: { receipt_id: 'evidence-1', social_content_id: DARK_CASTLE_COPY_CONTENT_ID,
      content_version: 'content-v1', status: 'passed', evidence_input_fingerprint: 'fingerprint-1' },
  } as Record<string, unknown> })
const inspect = (candidate = item(), linked = calendar(), identity = approved) => inspectDarkCastleApprovedBinding(candidate, linked, identity)

describe('approved Dark Castle binding readiness', () => {
  it('accepts exact source receipts and an exact packet replay candidate', () => {
    expect(inspect()).toMatchObject({ ready: true, packetPrepared: false, externalExecution: false })
    const candidate = item()
    candidate.video_url = approved.masterPath; candidate.image_url = approved.thumbnailPath
    candidate.rag_context.dark_castle_master_binding = { path: approved.masterPath, sha256: approved.masterSha256 }
    candidate.rag_context.dark_castle_thumbnail_binding = { path: approved.thumbnailPath, sha256: approved.thumbnailSha256, direction: 'C' }
    candidate.rag_context.mobile_decision_review = { content_id: candidate.id, content_updated_at: updated, current_gate: 'copy_review',
      source_content_updated_at: updated, source_receipts: receipts(), work_item_id: 'work', approval_id: 'approval', run_id: 'run' }
    expect(inspect(candidate)).toMatchObject({ ready: true, packetPrepared: true })
  })

  it('blocks stale, wrong-record, wrong-media, and wrong-direction identities', () => {
    const wrong = item(); wrong.id = 'another-record'
    expect(inspect(wrong).ready).toBe(false)
    const stale = item(); stale.updated_at = '2026-11-01T15:00:00Z'
    expect(inspect(stale).ready).toBe(false)
    const media = item(); media.video_url = '/other.mp4'
    expect(inspect(media).ready).toBe(false)
    expect(inspect(item(), calendar(), { ...approved, thumbnailDirection: 'B' }).ready).toBe(false)
    const wrongHash = item(); wrongHash.rag_context.dark_castle_master_binding = { path: approved.masterPath, sha256: 'other-hash' }
    expect(inspect(wrongHash).ready).toBe(false)
  })

  it('blocks missing description or evidence receipts and duplicate or pending source identities', () => {
    const missing = item(); delete missing.rag_context.youtube_description_receipt
    expect(inspect(missing).ready).toBe(false)
    const evidence = item(); delete evidence.rag_context.description_evidence_reconciliation_receipt
    expect(inspect(evidence).ready).toBe(false)
    const duplicate = item(); (duplicate.rag_context.copy_review_evidence_receipts as Record<string, { receipt_id: string }>).voice.receipt_id = 'source-1'
    expect(inspect(duplicate).ready).toBe(false)
    const pending = item(); (pending.rag_context.copy_review_evidence_receipts as Record<string, { status: string }>).visual.status = 'pending'
    expect(inspect(pending).ready).toBe(false)
    const absent = item(); delete absent.rag_context.copy_review_evidence_receipts
    expect(inspect(absent).ready).toBe(false)
  })

  it('blocks ambiguous calendar identity and malformed replay packet', () => {
    expect(inspect(item(), [...calendar(), ...calendar()]).ready).toBe(false)
    const replay = item(); replay.rag_context.mobile_decision_review = { work_item_id: 'work' }
    expect(inspect(replay).ready).toBe(false)
  })
})
