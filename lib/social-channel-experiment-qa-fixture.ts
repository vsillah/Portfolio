import {
  channelExperimentReviewForSocialContentId,
  type YouTubeExperimentReviewRecord,
} from '@/lib/channel-experiment-review'
import type { SocialContentItem } from '@/lib/social-content'

export const CHANNEL_EXPERIMENT_SOCIAL_DETAIL_FIXTURE = 'channel_experiment_social_detail_v1'

export function isChannelExperimentSocialContentId(id: string): boolean {
  return channelExperimentReviewForSocialContentId(id) !== null
}

function experimentOutline(record: YouTubeExperimentReviewRecord): string {
  return [
    record.variant.openingHook,
    '',
    ...record.variant.outline.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n')
}

export function channelExperimentSocialContentQaFixture(id: string): SocialContentItem {
  const record = channelExperimentReviewForSocialContentId(id)
  if (!record) throw new Error(`Unknown channel experiment Social Content fixture: ${id}`)

  const { review, variant } = record
  return {
    id,
    meeting_record_id: null,
    platform: 'youtube',
    status: 'draft',
    post_text: experimentOutline(record),
    cta_text: variant.cta,
    cta_url: null,
    hashtags: [],
    image_url: null,
    image_prompt: variant.thumbnailConcept,
    framework_visual_type: null,
    voiceover_url: null,
    voiceover_text: experimentOutline(record),
    video_url: null,
    topic_extracted: null,
    hormozi_framework: null,
    rag_context: {
      source: 'channel_experiment_review_packet',
      source_type: 'review_only_youtube_experiment',
      source_packet: review.packetId,
      campaign_name: review.campaignTitle,
      platform: 'youtube',
      approval_boundary: review.evidenceBoundary.join(' '),
      workflow_state: 'human_review_required',
      publish_gate: 'review_only',
      provider_actions_enabled: false,
      platform_draft_enabled: false,
      external_execution_enabled: false,
      channel_experiment_review: {
        packet_id: review.packetId,
        campaign_title: review.campaignTitle,
        audience: review.audience,
        variant_id: variant.id,
        variant_label: variant.label,
        hypothesis: variant.hypothesis,
        title: variant.title,
        description: variant.description,
        opening_hook: variant.openingHook,
        outline: variant.outline,
        thumbnail_brief: variant.thumbnailConcept,
        cta: variant.cta,
        product_proof_requirements: [variant.productTieIn, ...variant.visualEvidence],
        evidence_lineage: review.evidenceLinks,
        approved_claims: review.approvedClaims,
        evidence_boundary: review.evidenceBoundary,
        formula: review.formula,
        scores: review.scores,
        missing_evidence: review.missingEvidence,
      },
      side_effects: {
        production_read: false,
        production_write: false,
        provider_generation: false,
        rendering: false,
        upload: false,
        platform_draft: false,
        schedule: false,
        publish: false,
        external_send: false,
      },
      qa_fixture: {
        kind: 'channel_experiment_social_detail_review',
        read_only: true,
        reason: 'Privacy-safe channel-native YouTube experiment fixture. Review only.',
        next_action: 'Review the YouTube concept and its evidence requirements. Return to the linked research packet for source decisions; all execution gates remain closed.',
      },
    },
    scheduled_for: null,
    published_at: null,
    platform_post_id: null,
    admin_notes: null,
    reviewed_by: null,
    target_platforms: ['youtube'],
    video_generation_method: 'none',
    youtube_title: variant.title,
    youtube_description: variant.description,
    content_format: 'single_image',
    content_pillar: null,
    companion_post_text: null,
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    created_at: '2026-10-16T12:00:00.000Z',
    updated_at: '2026-10-16T12:00:00.000Z',
    publishes: [],
  }
}
