import { describe, expect, it, vi } from 'vitest'
import { readVerifiedSocialContentDecisionReceipt } from '@/lib/social-content-recorded-decision'

const CONTENT_ID = '11111111-1111-4111-8111-111111111111'
const APPROVAL_ID = '22222222-2222-4222-8222-222222222222'
const RUN_ID = '33333333-3333-4333-8333-333333333333'
const WORK_ITEM_ID = '44444444-4444-4444-8444-444444444444'
const RECEIPT_ID = '55555555-5555-4555-8555-555555555555'
const REVIEWED_VERSION = '2026-10-12T18:30:00.000Z'

function item() {
  const evidenceReceipt = (key: string) => ({
    receipt_id: `${key}-receipt`,
    status: 'approved',
    content_updated_at: REVIEWED_VERSION,
  })
  return {
    id: CONTENT_ID,
    updated_at: '2026-10-12T18:31:00.000Z',
    rag_context: {
      current_gate: 'asset_packet',
      latest_internal_decision_receipt_id: RECEIPT_ID,
      latest_internal_decision: 'approve',
      mobile_decision_review: {
        version: 'social-content-decision-review/v1',
        approval_id: APPROVAL_ID,
        run_id: RUN_ID,
        work_item_id: WORK_ITEM_ID,
        content_id: CONTENT_ID,
        content_updated_at: REVIEWED_VERSION,
        current_gate: 'copy_review',
        next_gate: 'asset_packet',
        receipts: {
          source: evidenceReceipt('source'),
          voice: evidenceReceipt('voice'),
          framework: evidenceReceipt('framework'),
          privacy: evidenceReceipt('privacy'),
          visual: evidenceReceipt('visual'),
          challenger: evidenceReceipt('challenger'),
        },
        candidate_projection: null,
      },
    },
  }
}

function receiptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RECEIPT_ID,
    social_content_id: CONTENT_ID,
    agent_run_id: RUN_ID,
    agent_approval_id: APPROVAL_ID,
    agent_work_item_id: WORK_ITEM_ID,
    content_updated_at: REVIEWED_VERSION,
    decision: 'approve',
    current_gate: 'copy_review',
    next_internal_gate: 'asset_packet',
    ...overrides,
  }
}

function reader(result: { data: unknown; error?: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  return { client: { from }, from, select, eq, maybeSingle }
}

describe('recorded Social Content decision receipt read model', () => {
  it('projects a recorded decision only after every immutable row binding matches', async () => {
    const mocks = reader({ data: receiptRow(), error: null })

    const receipt = await readVerifiedSocialContentDecisionReceipt(mocks.client, item() as never)

    expect(receipt).toEqual({
      receipt_id: RECEIPT_ID,
      decision: 'approve',
      reviewed_content_updated_at: REVIEWED_VERSION,
      next_gate: 'asset_packet',
      verified: true,
      artifact_manifest_snapshot: null,
    })
    expect(mocks.from).toHaveBeenCalledWith('social_content_decision_receipts')
    expect(mocks.eq).toHaveBeenCalledWith('id', RECEIPT_ID)
  })

  it('fails closed when the immutable receipt row is missing', async () => {
    const mocks = reader({ data: null, error: null })

    await expect(readVerifiedSocialContentDecisionReceipt(mocks.client, item() as never)).resolves.toBeNull()
  })

  it.each([
    ['social_content_id', '99999999-9999-4999-8999-999999999999'],
    ['agent_approval_id', '99999999-9999-4999-8999-999999999999'],
    ['content_updated_at', '2026-10-12T18:29:00.000Z'],
    ['decision', 'request_revision'],
    ['next_internal_gate', 'visual_review'],
  ])('fails closed when immutable receipt %s does not match', async (field, value) => {
    const mocks = reader({ data: receiptRow({ [field]: value }), error: null })

    await expect(readVerifiedSocialContentDecisionReceipt(mocks.client, item() as never)).resolves.toBeNull()
  })

  it('does not query the receipt table without complete recorded-decision metadata', async () => {
    const candidate = item()
    delete (candidate.rag_context as Record<string, unknown>).latest_internal_decision_receipt_id
    const mocks = reader({ data: receiptRow(), error: null })

    await expect(readVerifiedSocialContentDecisionReceipt(mocks.client, candidate as never)).resolves.toBeNull()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('preserves and verifies the artifact manifest snapshot after content advances', async () => {
    const candidate = item()
    const snapshot = {
      manifest_id: 'artifact-manifest:social:v1',
      manifest_hash: `sha256:${'a'.repeat(64)}`,
      content_version: REVIEWED_VERSION,
    }
    ;(candidate.rag_context.mobile_decision_review as Record<string, unknown>).candidate_projection = {
      artifact_evidence_manifest: snapshot,
    }
    const mocks = reader({ data: receiptRow({ candidate_projection: { artifact_evidence_manifest: snapshot } }), error: null })

    await expect(readVerifiedSocialContentDecisionReceipt(mocks.client, candidate as never)).resolves.toMatchObject({
      artifact_manifest_snapshot: snapshot,
      verified: true,
    })
  })

  it('fails closed when the immutable manifest hash differs from the reviewed packet', async () => {
    const candidate = item()
    const snapshot = {
      manifest_id: 'artifact-manifest:social:v1',
      manifest_hash: `sha256:${'a'.repeat(64)}`,
      content_version: REVIEWED_VERSION,
    }
    ;(candidate.rag_context.mobile_decision_review as Record<string, unknown>).candidate_projection = {
      artifact_evidence_manifest: snapshot,
    }
    const mocks = reader({ data: receiptRow({ candidate_projection: { artifact_evidence_manifest: { ...snapshot, manifest_hash: `sha256:${'b'.repeat(64)}` } } }), error: null })

    await expect(readVerifiedSocialContentDecisionReceipt(mocks.client, candidate as never)).resolves.toBeNull()
  })
})
