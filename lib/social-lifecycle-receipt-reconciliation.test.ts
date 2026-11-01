import { describe, expect, it } from 'vitest'
import { deriveSocialContentLifecycleProjection, hasReceiptBackedLinkedInVisualApproval } from './social-content-lifecycle'
import { socialLifecycleReconciliationQaFixture } from './social-lifecycle-reconciliation-qa-fixture'

const version = '2026-11-01T13:36:14.476215+00:00'
const priorVersion = '2026-11-01T10:06:10.853247+00:00'
const hash = `sha256:${'8'.repeat(64)}`
const image = '/review-assets/social-content/dark-castle.png'
const source = 'review-prep:dark-castle-linkedin:b4442c963c109c06'
const receipts = (contentVersion: string) => ({
  source: { receipt_id: source, status: 'approved', content_updated_at: contentVersion },
  visual: { receipt_id: `visual:dark-castle:${hash}`, status: 'approved', content_updated_at: contentVersion },
  privacy: { receipt_id: 'privacy:dark-castle:approved', status: 'passed', content_updated_at: contentVersion },
})
const candidate = { post_text: 'A player opens with e4.', cta_text: 'What helps the next decision?', cta_url: '', image_url: image, visual_sha256: hash }
const item = () => ({
  id: '563d3ee1-e5b9-41bb-89f3-9273ea017272',
  platform: 'linkedin' as const,
  status: 'approved' as const,
  post_text: candidate.post_text,
  cta_text: candidate.cta_text,
  cta_url: candidate.cta_url,
  image_url: image,
  target_platforms: ['linkedin' as const],
  publishes: [{ status: 'pending' as const }],
  rag_context: {
    source_packet: 'approved-source-packet', platform: 'linkedin', approval_boundary: 'internal review',
    current_gate: 'platform_submission', approved_visual_sha256: hash,
    copy_review_candidate_projection: candidate,
    // The old visual_assets key is intentionally missing: this is the reproduced stale projection.
    section_gate_reviews: {
      visual_review: { status: 'approved', decision_receipt_id: 'visual-decision' },
      asset_packet: { status: 'approved', decision_receipt_id: 'asset-decision' },
      privacy: { status: 'approved', decision_receipt_id: 'privacy-decision' },
    },
    mobile_decision_review: { content_updated_at: version, receipts: receipts(version) },
    linkedin_draft_handoff: {
      version: 'linkedin_draft_handoff_v2', social_content_id: '563d3ee1-e5b9-41bb-89f3-9273ea017272',
      external_execution: false, candidate_projection: candidate,
      evidence_receipts: receipts(priorVersion), privacy_decision_receipt_id: 'privacy-decision',
      canonical_decision_lineage: {
        copy_receipt_id: 'copy-decision', visual_review_receipt_id: 'visual-decision',
        asset_packet_receipt_id: 'asset-decision', privacy_receipt_id: 'privacy-decision',
      },
    },
    latest_internal_decision_receipt_id: 'submit-decision',
    platform_submission_gate: { status: 'approved', platforms: ['linkedin'], decision_receipt_id: 'submit-decision', context_reconciliation_receipt: source },
  },
})

describe('receipt-backed LinkedIn lifecycle reconciliation', () => {
  it('renders the read-only QA fixture with the same receipt-backed truth', () => {
    const fixture = socialLifecycleReconciliationQaFixture()
    expect(hasReceiptBackedLinkedInVisualApproval(fixture)).toBe(true)
    expect(fixture.publishes[0].status).toBe('pending')
    expect(deriveSocialContentLifecycleProjection({ item: fixture }).steps.submit.state).toBe('approved')
  })
  it('keeps Context, Visuals, Draft, and Submit consistent while the publish row is pending', () => {
    const current = item()
    expect(hasReceiptBackedLinkedInVisualApproval(current)).toBe(true)
    const projection = deriveSocialContentLifecycleProjection({ item: current })
    expect(Object.values(projection.steps).map((step) => step.state)).toEqual([
      'approved', 'approved', 'approved', 'approved', 'approved', 'pending',
    ])
    expect(projection.mismatches).toEqual([])
    expect(current.publishes).toEqual([{ status: 'pending' }])
    expect(current.rag_context.mobile_decision_review.receipts.source.receipt_id).toBe(source)
  })

  it.each([
    ['missing visual decision', (current: ReturnType<typeof item>) => { delete (current.rag_context.section_gate_reviews as Record<string, unknown>).visual_review }],
    ['mismatched asset decision', (current: ReturnType<typeof item>) => { current.rag_context.section_gate_reviews.asset_packet.decision_receipt_id = 'other' }],
    ['duplicate decision', (current: ReturnType<typeof item>) => { current.rag_context.section_gate_reviews.privacy.decision_receipt_id = 'asset-decision'; current.rag_context.linkedin_draft_handoff.canonical_decision_lineage.privacy_receipt_id = 'asset-decision'; current.rag_context.linkedin_draft_handoff.privacy_decision_receipt_id = 'asset-decision' }],
    ['stale visual receipt', (current: ReturnType<typeof item>) => { current.rag_context.mobile_decision_review.receipts.visual.content_updated_at = '2026-10-01T00:00:00Z' }],
    ['mismatched source receipt', (current: ReturnType<typeof item>) => { current.rag_context.mobile_decision_review.receipts.source.receipt_id = 'other-source' }],
    ['mismatched source reconciliation', (current: ReturnType<typeof item>) => { current.rag_context.platform_submission_gate.context_reconciliation_receipt = 'other-source' }],
    ['mismatched asset hash', (current: ReturnType<typeof item>) => { current.rag_context.copy_review_candidate_projection.visual_sha256 = `sha256:${'0'.repeat(64)}` }],
  ])('fails closed for %s', (_label, alter) => {
    const current = item()
    alter(current)
    expect(hasReceiptBackedLinkedInVisualApproval(current)).toBe(false)
    const projection = deriveSocialContentLifecycleProjection({ item: current })
    expect(projection.steps.visuals.state).not.toBe('approved')
    expect(projection.steps.submit.state).toBe('blocked')
    expect(projection.steps.submit.mismatch?.missingStep).toBe('visuals')
  })
})
