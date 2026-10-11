import type { SocialContentItem } from '@/lib/social-content'

export const TOPIC_SOURCE_COVERAGE_QA_ID = 'topic-source-coverage-qa'
export type TopicSourceCoverageQaState = 'ready' | 'blocked'

const SOURCE_COLLECTIONS = [
  { source_group: 'open_brain', status: 'ready', receipt_count: 2, blocker: null },
  { source_group: 'meeting_summaries', status: 'ready', receipt_count: 1, blocker: null },
  { source_group: 'owned_media_summaries', status: 'ready', receipt_count: 1, blocker: null },
  { source_group: 'app_prototypes', status: 'ready', receipt_count: 2, blocker: null },
  { source_group: 'amadutown_catalog', status: 'ready', receipt_count: 4, blocker: null },
] as const

const PRODUCT_COVERAGE = [
  { product_id: 'dark_castle_chess', label: 'Dark Castle Chess', status: 'ready', receipt_ids: ['receipt-dcc'], source_ids: ['app_prototype:dark-castle-chess'], blocker: null },
  { product_id: 'accelerated', label: 'Accelerated', status: 'ready', receipt_ids: ['receipt-accelerated'], source_ids: ['services:accelerated'], blocker: null },
  { product_id: 'agentified', label: 'Agentified', status: 'ready', receipt_ids: ['receipt-agentified'], source_ids: ['publications:agentified'], blocker: null },
] as const

const AGENTIFIED_RECEIPT = {
  receipt_id: 'source-receipt:agentified-publication',
  source_id: 'publications:agentified',
  source_kind: 'amadutown_book',
  approval_status: 'approved',
  approved_at: '2026-10-09T12:00:00.000Z',
  approved_by: 'public_catalog_state',
  privacy_classification: 'public_safe',
  provenance: 'public_catalog:publications:agentified',
  summary_sha256: 'a'.repeat(64),
  product_ids: ['agentified'],
  raw_content_included: false,
} as const

export function topicSourceCoverageQaFixtureEnabled() {
  if (process.env.VERCEL_ENV === 'production') return false

  return process.env.SOCIAL_TOPIC_SOURCE_COVERAGE_QA_FIXTURE === 'true'
    || process.env.VERCEL_ENV === 'preview'
    || process.env.NODE_ENV === 'development'
    || process.env.NODE_ENV === 'test'
}

export function isTopicSourceCoverageQaFixtureId(id: string | null | undefined) {
  return topicSourceCoverageQaFixtureEnabled() && id === TOPIC_SOURCE_COVERAGE_QA_ID
}

export function topicSourceCoverageQaFixture(state: TopicSourceCoverageQaState = 'ready'): SocialContentItem {
  const blocked = state === 'blocked'
  const sourceCollections = SOURCE_COLLECTIONS.map((collection) => (
    blocked && collection.source_group === 'meeting_summaries'
      ? {
        ...collection,
        status: 'blocked',
        receipt_count: 0,
        blocker: '[source_collection_failed:meeting_summaries] Restore approved-summary read access and retry.',
      }
      : collection
  ))
  const products = PRODUCT_COVERAGE.map((product) => (
    blocked && product.product_id === 'agentified'
      ? {
        ...product,
        status: 'blocked',
        receipt_ids: [],
        source_ids: [],
        blocker: '[product_coverage_receipt_missing:agentified] Approve a privacy-safe Agentified summary.',
      }
      : product
  ))
  const blockers = blocked ? [
    '[source_collection_failed:meeting_summaries] Restore approved-summary read access and retry.',
    '[product_coverage_receipt_missing:agentified] Approve a privacy-safe Agentified summary.',
  ] : []
  const coverageReport = {
    version: 'social_topic_source_coverage_v1',
    status: blocked ? 'blocked' : 'ready',
    generated_at: '2026-10-09T12:00:00.000Z',
    source_receipt_count: blocked ? 9 : 10,
    source_kind_counts: {
      open_brain_conversation_proposal: 2,
      meeting_summary: blocked ? 0 : 1,
      owned_media_summary: 1,
      app_prototype: 2,
      amadutown_product: 2,
      amadutown_book: 1,
      amadutown_site_material: 1,
    },
    source_collections: sourceCollections,
    products,
    blockers,
  }
  const candidate = {
    id: 'topic-agentified-operating-lesson',
    title: 'Agentified: the operating lesson behind the product',
    triggering_event: 'An approved public book summary shows why accountable AI work needs visible source and decision boundaries.',
    source_type: 'portfolio_work',
    source_label: 'Agentified',
    source_ids: ['publications:agentified'],
    why_vambah_can_speak: 'The angle is grounded in an approved AmaduTown publication receipt.',
    brand_goal: 'Maintain recurring, evidence-backed Agentified coverage.',
    content_angle: 'Explain the operating choice behind accountable agent systems.',
    suggested_hook: 'An agent becomes useful when its authority is as visible as its output.',
    audience: 'Operators and product leaders',
    sensitivity: 'public_safe',
    evidence_summary: 'Approved public Agentified summary.',
    claim_boundaries: ['Verify performance claims before drafting.'],
    source_receipts: blocked ? [] : [AGENTIFIED_RECEIPT],
    product_ids: ['agentified'],
    priority_score: 70,
    priority_tier: 'medium',
    priority_reasons: ['Required product coverage: Agentified', 'Public-safe summary'],
    dedupe_fingerprint: 'b'.repeat(64),
  }

  return {
    id: TOPIC_SOURCE_COVERAGE_QA_ID,
    meeting_record_id: null,
    platform: 'linkedin',
    status: 'draft',
    post_text: 'An approved source is useful only when its boundary travels with the idea.',
    cta_text: null,
    cta_url: null,
    hashtags: ['AIProduct', 'AgentOperations', 'AmaduTownAdvisory'],
    image_url: null,
    image_prompt: null,
    framework_visual_type: null,
    voiceover_url: null,
    voiceover_text: null,
    video_url: null,
    topic_extracted: null,
    hormozi_framework: null,
    scheduled_for: null,
    published_at: null,
    platform_post_id: null,
    admin_notes: 'Synthetic preview-only topic source coverage fixture. No shared row exists.',
    reviewed_by: null,
    target_platforms: ['linkedin'],
    video_generation_method: 'none',
    youtube_title: null,
    youtube_description: null,
    content_format: 'text',
    content_pillar: 'technology_as_equalizer',
    companion_post_text: null,
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    publishes: [],
    created_at: '2026-10-09T12:00:00.000Z',
    updated_at: '2026-10-09T12:05:00.000Z',
    rag_context: {
      source: 'agent_ops_social_outreach_goal',
      source_type: 'synthetic_preview_fixture',
      goal_id: 'synthetic-topic-source-coverage',
      content_packet_id: 'synthetic-topic-source-coverage-packet',
      external_execution_enabled: false,
      approval_boundary: 'Synthetic preview review only. No provider, upload, scheduling, publishing, external send, or shared-data action is available.',
      qa_fixture: {
        id: TOPIC_SOURCE_COVERAGE_QA_ID,
        kind: 'topic_source_coverage_preview',
        read_only: true,
        preview_only: true,
        synthetic: true,
        reason: 'Synthetic preview-only source coverage report. Read-only.',
        next_action: 'Review the coverage report, source collections, product coverage, receipts, backlog candidates, blockers, and recovery actions.',
        capabilities: {
          save: false,
          approve: false,
          provider: false,
          upload: false,
          schedule: false,
          publish: false,
          external_execution: false,
        },
      },
      content_calibration: {
        status: blocked ? 'topic_source_coverage_blocked' : 'topic_triggers_ready',
        topic_trigger_packet: {
          version: 'social_topic_trigger_discovery_v2',
          status: 'review_ready',
          generated_at: '2026-10-09T12:00:00.000Z',
          generated_by: 'synthetic-preview',
          model: 'none',
          provider: 'fixture',
          source_policy: 'sanitized_summaries_only',
          source_counts: {
            meeting: blocked ? 0 : 1,
            shipped_feature: 2,
            client_safe_project: 0,
            chronicle_observation: 0,
            chatgpt_session: 0,
            open_brain: 2,
            portfolio_work: blocked ? 6 : 7,
          },
          source_receipts: blocked ? [] : [AGENTIFIED_RECEIPT],
          coverage_report: coverageReport,
          candidates: [candidate],
          notes: ['Synthetic preview fixture for governed topic source coverage.'],
          privacy_boundary: 'Review-only fixture using synthetic approved summaries and receipts. Raw conversations, transcripts, contact details, providers, publishing, and scheduling are excluded.',
        },
      },
    },
  } as unknown as SocialContentItem
}
