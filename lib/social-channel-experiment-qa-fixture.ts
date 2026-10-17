import {
  channelExperimentReviewForPacket,
  channelExperimentSocialContentRecord,
  type YouTubeExperimentReviewRecord,
} from '@/lib/channel-experiment-review'
import type { SocialContentItem } from '@/lib/social-content'

export const CHANNEL_EXPERIMENT_SOCIAL_DETAIL_FIXTURE = 'channel_experiment_social_detail_v1'
export const YOUTUBE_DESCRIPTION_COMPLETION_FIXTURE = 'youtube_description_completion_v1'
export const YOUTUBE_DESCRIPTION_COMPLETION_QA_ID = '939b01e3-d1af-42c8-805e-0379f09efd60'

export function isChannelExperimentSocialContentId(id: string): boolean {
  return channelExperimentSocialContentRecord(id) !== null
}

export function youtubeDescriptionCompletionQaFixture(id: string): SocialContentItem {
  if (id !== YOUTUBE_DESCRIPTION_COMPLETION_QA_ID) {
    throw new Error(`Unknown YouTube description completion fixture: ${id}`)
  }

  return {
    id,
    meeting_record_id: null,
    platform: 'youtube',
    status: 'draft',
    post_text: 'Jev kept walking into the same closed entrance. The fix was not a smarter model. The system changed the cadence, policy, and human handoffs around it.',
    cta_text: 'Where does your own agent workflow need a stronger harness?',
    cta_url: null,
    hashtags: [],
    image_url: null,
    image_prompt: 'Presenter left; looping game path and decision cadence right; large text: THE MODEL WASN\'T THE FIX',
    framework_visual_type: null,
    voiceover_url: null,
    voiceover_text: null,
    video_url: null,
    topic_extracted: 'Jev agent harness governance',
    hormozi_framework: null,
    rag_context: {
      source: 'human_qa_approved_jit_campaign_packet',
      channel: 'youtube',
      jit_score: 85,
      product_id: 'jev',
      campaign_title: 'Jev: The Model Won After the Harness Changed',
      stable_campaign_identity: 'campaign:jev:harness-owns-the-outcome:v1',
      jit_refresh_receipt_id: 'jit-refresh:next-week-primary-lanes:20261017T150819Z',
      storyboard: [
        'Open on the repeated closed-entrance loop',
        'Show Jev as the bounded decision component',
        'Animate one-second cadence slowing to six seconds',
        'Reveal harness, policy, and human layers',
        'Return to presenter for spoken CTA',
      ],
      thumbnail_direction: 'Presenter left; looping game path and decision cadence right; large text: THE MODEL WASN\'T THE FIX',
      product_sources: ['Approved Jev operator field guide'],
      claim_boundary: 'Attribute the Pokemon result and harness interventions. Do not imply the model completed the game autonomously or that public attention proves production reliability.',
      approval_boundary: 'Internal review only. Provider calls, rendering, upload, platform drafts, external scheduling, publishing, and external sends remain separately gated.',
      source_lineage: [
        'https://typesafe.ai/',
        'https://jev-plays-pokemon.standardagents.ai/',
        'https://arxiv.org/abs/2610.09188',
      ],
      description_outlier_evidence: {
        status: 'ready',
        release_readiness: 'ready',
        minimum_source_count: 3,
        minimum_outlier_score: 65,
        input_fingerprint: 'fnv1a:8eee8870',
        blockers: [],
        remediation_receipts: [],
        sources: [
          { source_title: 'A 9B router model just beat its own 27B predecessor', source_url: 'https://www.youtube.com/watch?v=lq1qETh0e0o' },
          { source_title: 'What is Jev? The AI Model That Decides, While LLMs Write', source_url: 'https://www.youtube.com/watch?v=voYpgIg0m0k' },
          { source_title: 'What Is JEV AI? The New AI Explained', source_url: 'https://www.youtube.com/watch?v=nxQwVT15KMw' },
        ],
      },
      description_evidence_release_gate: { status: 'ready' },
      side_effects: {
        render: false,
        upload: false,
        publish: false,
        schedule: false,
        external_send: false,
        provider_call: false,
        platform_draft: false,
      },
      qa_fixture: {
        kind: 'youtube_description_completion_review',
        read_only: true,
        reason: 'Privacy-safe read-only projection of the repaired Jev YouTube review state.',
      },
    },
    scheduled_for: null,
    published_at: null,
    platform_post_id: null,
    admin_notes: null,
    reviewed_by: null,
    target_platforms: ['youtube'],
    video_generation_method: 'none',
    youtube_title: 'The AI Won After the System Slowed It Down',
    youtube_description: [
      'The model kept choosing. The harness had to learn when to slow it down.',
      '',
      "This video breaks down how Jev's bounded decisions, a one-second cadence, and human-guided policy changes turned a repeated dead end into progress in Pokemon Red. I connect that experiment to the operating systems I build at AmaduTown: source receipts, explicit policy boundaries, and visible human ownership.",
      '',
      "You'll see:",
      '- where the model stalled',
      '- why the harness changed from one second to six',
      '- how tools, policy, and human review divided responsibility',
      '- what this means for teams building agentic products',
      '',
      "Jev's public experiment is the case study. The operating lesson is mine: the model can choose, but the system owns the outcome.",
      '',
      'Where does your own agent workflow need a stronger harness?',
      '',
      'Sources:',
      'https://jev-plays-pokemon.standardagents.ai/',
      'https://arxiv.org/abs/2610.09188',
    ].join('\n'),
    content_format: 'single_image',
    content_pillar: null,
    companion_post_text: null,
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    created_at: '2026-10-17T15:19:51.642Z',
    updated_at: '2026-10-17T15:57:57.679Z',
    publishes: [],
  }
}

function experimentOutline(record: YouTubeExperimentReviewRecord): string {
  return [
    record.variant.openingHook,
    '',
    ...record.variant.outline.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n')
}

export function channelExperimentSocialContentQaFixture(id: string): SocialContentItem {
  const binding = channelExperimentSocialContentRecord(id)
  if (!binding) throw new Error(`Unknown channel experiment Social Content fixture: ${id}`)
  const review = channelExperimentReviewForPacket(binding.packetId)
  if (!review) throw new Error(`Unknown channel experiment packet: ${binding.packetId}`)

  const sideEffects = {
    production_read: false,
    production_write: false,
    provider_generation: false,
    rendering: false,
    upload: false,
    platform_draft: false,
    schedule: false,
    publish: false,
    external_send: false,
  }

  if (binding.channel === 'linkedin') {
    const variant = review.linkedin.find(candidate => candidate.id === binding.variantId)
    if (!variant) throw new Error(`Unknown LinkedIn experiment variant: ${binding.variantId}`)
    return {
      id,
      meeting_record_id: null,
      platform: 'linkedin',
      status: 'draft',
      post_text: [variant.hook, '', ...variant.bodyStructure, '', variant.cta].join('\n\n'),
      cta_text: variant.cta,
      cta_url: null,
      hashtags: [],
      image_url: null,
      image_prompt: variant.visualBrief,
      framework_visual_type: null,
      voiceover_url: null,
      voiceover_text: null,
      video_url: null,
      topic_extracted: null,
      hormozi_framework: null,
      rag_context: {
        source: 'channel_experiment_linkedin_control_fixture',
        source_type: 'review_only_linkedin_control',
        source_packet: review.packetId,
        campaign_name: review.campaignTitle,
        platform: 'linkedin',
        approval_boundary: review.evidenceBoundary.join(' '),
        workflow_state: 'human_review_required',
        publish_gate: 'review_only',
        provider_actions_enabled: false,
        platform_draft_enabled: false,
        external_execution_enabled: false,
        experiment_variant: {
          variant_id: variant.id,
          variant_label: variant.label,
          hypothesis: variant.hypothesis,
          product_tie_in: variant.productTieIn,
          visual_brief: variant.visualBrief,
        },
        side_effects: sideEffects,
        qa_fixture: {
          kind: 'channel_experiment_linkedin_control',
          read_only: true,
          reason: 'Privacy-safe LinkedIn control fixture. Review only.',
          next_action: 'Verify this record still uses the ordinary LinkedIn review experience; all execution gates remain closed.',
        },
      },
      scheduled_for: null,
      published_at: null,
      platform_post_id: null,
      admin_notes: null,
      reviewed_by: null,
      target_platforms: ['linkedin'],
      video_generation_method: 'none',
      youtube_title: null,
      youtube_description: null,
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

  const variant = review.youtube.find(candidate => candidate.id === binding.variantId)
  if (!variant) throw new Error(`Unknown YouTube experiment variant: ${binding.variantId}`)
  const record: YouTubeExperimentReviewRecord = { review, variant }

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
      side_effects: sideEffects,
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
