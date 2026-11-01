import { SOCIAL_CAMPAIGN_REVIEW_IDS, socialCampaignReviewQaFixture } from './social-campaign-review-assets'

export const SOCIAL_LIFECYCLE_RECONCILIATION_QA_ID = '563d3ee1-e5b9-41bb-89f3-9273ea017272'
export const SOCIAL_LIFECYCLE_RECONCILIATION_QA_FIXTURE = 'social_lifecycle_reconciliation_v1'

/** Development-only, read-only projection of the recorded contradictory receipt shape. */
export function socialLifecycleReconciliationQaFixture() {
  const item = socialCampaignReviewQaFixture(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn)
  const version = '2026-11-01T13:36:14.476215+00:00'
  const handoffVersion = '2026-11-01T10:06:10.853247+00:00'
  const hash = 'sha256:88f26176acb339f10373dc39637e91ca8235f5cc3075f39ff737b97672a86091'
  const source = 'review-prep:dark-castle-linkedin:b4442c963c109c06'
  const candidate = {
    post_text: 'A player opens with e4. What helps them make the next decision?',
    cta_text: 'What helps someone understand their next move?', cta_url: null,
    image_url: item.image_url, visual_sha256: hash,
  }
  const receipts = (contentVersion: string) => ({
    source: { status: 'approved', receipt_id: source, content_updated_at: contentVersion },
    visual: { status: 'approved', receipt_id: `visual:dark-castle:${hash}`, content_updated_at: contentVersion },
    privacy: { status: 'passed', receipt_id: 'privacy:dark-castle:owned-public-gameplay:pr1136', content_updated_at: contentVersion },
  })
  return {
    ...item,
    id: SOCIAL_LIFECYCLE_RECONCILIATION_QA_ID,
    status: 'approved' as const,
    post_text: candidate.post_text,
    cta_text: candidate.cta_text,
    cta_url: candidate.cta_url,
    updated_at: '2026-11-01T13:53:40.901788+00:00',
    publishes: [{ id: '0a163b98-74e8-4365-af94-9545d574222b', content_id: SOCIAL_LIFECYCLE_RECONCILIATION_QA_ID,
      platform: 'linkedin' as const, status: 'pending' as const, platform_post_id: null, platform_post_url: null,
      published_at: null, error_message: null, created_at: version, updated_at: version }],
    rag_context: {
      source_packet: 'Synthetic approved source basis', platform: 'linkedin', approval_boundary: 'Read-only internal review.',
      current_gate: 'platform_submission', approved_visual_sha256: hash,
      copy_review_candidate_projection: candidate,
      mobile_decision_review: { content_updated_at: version, receipts: receipts(version) },
      section_gate_reviews: {
        visual_review: { status: 'approved', decision_receipt_id: '7cc04b96-dd49-48bd-8a81-cacdcc5b96b3' },
        asset_packet: { status: 'approved', decision_receipt_id: '08eab04c-6fe2-4f35-920d-1fb189178cc3' },
        privacy: { status: 'approved', decision_receipt_id: 'e935496a-e026-494a-9ab2-c9ae78d56060' },
      },
      linkedin_draft_handoff: {
        version: 'linkedin_draft_handoff_v2', social_content_id: SOCIAL_LIFECYCLE_RECONCILIATION_QA_ID,
        external_execution: false, candidate_projection: candidate, evidence_receipts: receipts(handoffVersion),
        privacy_decision_receipt_id: 'e935496a-e026-494a-9ab2-c9ae78d56060',
        canonical_decision_lineage: {
          copy_receipt_id: '36ff8a91-dcc7-471c-83a3-83ddcd4562f7',
          visual_review_receipt_id: '7cc04b96-dd49-48bd-8a81-cacdcc5b96b3',
          asset_packet_receipt_id: '08eab04c-6fe2-4f35-920d-1fb189178cc3',
          privacy_receipt_id: 'e935496a-e026-494a-9ab2-c9ae78d56060',
        },
      },
      latest_internal_decision_receipt_id: 'a0e4650a-afcb-4140-acf0-0181949e58e8',
      platform_submission_gate: { status: 'approved', platforms: ['linkedin'],
        decision_receipt_id: 'a0e4650a-afcb-4140-acf0-0181949e58e8', context_reconciliation_receipt: source },
      qa_fixture: { kind: SOCIAL_LIFECYCLE_RECONCILIATION_QA_FIXTURE, read_only: true,
        reason: 'Synthetic receipt projection. The production record, publish row, and provider are not connected.' },
    },
  }
}
