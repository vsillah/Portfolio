import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentWorkItem, updateAgentWorkItemMetadata } from '@/lib/agent-work-items'
import {
  buildLinkedInYoutubeReviewDrafts,
  buildSocialContentEnrichmentReceipt,
  enrichCampaignReviewInsight,
  normalizeSocialChannelLanes,
  socialChannelReviewPublicCopyFields,
} from '@/lib/social-content-intelligence'
import { validateSocialPublicCopyFields } from '@/lib/social-content-lifecycle'
import {
  SocialVideoAdaptationError,
  buildSocialVideoAdaptationPacket,
  type SocialVideoAdaptationInput,
  type SocialVideoAdaptationPacket,
} from '@/lib/social-video-adaptation'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function hasApprovedResearchPatterns(insight: Record<string, unknown>) {
  return Array.isArray(insight.approved_research_patterns)
    && insight.approved_research_patterns.some((pattern) => Object.keys(asRecord(pattern)).length > 0)
}

function requestedArtifactVideoAdaptation(metadata: Record<string, unknown>) {
  const request = asRecord(metadata.artifact_video_adaptation_request)
  return Object.keys(request).length ? request as unknown as SocialVideoAdaptationInput : null
}

function attachArtifactVideoAdaptation(
  drafts: ReturnType<typeof buildLinkedInYoutubeReviewDrafts>,
  packet: SocialVideoAdaptationPacket,
) {
  if (packet.targets.includes('youtube_long_form')) {
    drafts.youtube.fields.artifact_video_adaptation = packet
    drafts.youtube.fields.video_generation_bridge = packet.video_generation_bridge
  }
  if (packet.targets.includes('youtube_shorts')) {
    drafts.youtube_shorts.fields.artifact_video_adaptation = packet
    drafts.youtube_shorts.fields.video_generation_bridge = packet.video_generation_bridge
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const workItem = await getAgentWorkItem(params.id)
    if (!workItem) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }

    const metadata = workItem.metadata ?? {}
    const rawInsight = asRecord(metadata.insight)
    const { insight, synthesizedFields } = enrichCampaignReviewInsight({ insight: rawInsight, metadata })
    if (!Object.keys(rawInsight).length) {
      return NextResponse.json({ error: 'Social insight metadata is required' }, { status: 400 })
    }
    if (!hasApprovedResearchPatterns(insight)) {
      return NextResponse.json(
        { error: 'Link at least one approved research pattern before preparing channel review drafts' },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const drafts = buildLinkedInYoutubeReviewDrafts({
      insight,
      generatedAt: now,
      latestFeedback: asRecord(metadata.autoresearch_feedback_latest),
    })
    const copyQualityGate = validateSocialPublicCopyFields(socialChannelReviewPublicCopyFields(drafts))
    if (copyQualityGate.status === 'blocked') {
      return NextResponse.json({
        error: 'Channel review draft quality gate blocked internal instructions or non-audience copy.',
        current_gate: 'final_copy_quality',
        revision_state: 'revision_needed',
        recovery_action: copyQualityGate.recoveryAction,
        quality_gate: copyQualityGate,
      }, { status: 422 })
    }
    const enrichmentReceipt = buildSocialContentEnrichmentReceipt({
      insight,
      copyQualityGate,
      generatedAt: now,
      synthesizedCampaignFields: synthesizedFields,
    })
    if (enrichmentReceipt.status === 'blocked') {
      return NextResponse.json({
        error: 'Channel review draft enrichment gate is incomplete.',
        current_gate: 'content_enrichment',
        revision_state: 'revision_needed',
        blockers: enrichmentReceipt.blockers,
        enrichment_receipt: enrichmentReceipt,
      }, { status: 422 })
    }
    for (const draft of Object.values(drafts)) draft.enrichment_receipt = enrichmentReceipt
    let artifactVideoAdaptation: SocialVideoAdaptationPacket | null = null
    const adaptationRequest = requestedArtifactVideoAdaptation(metadata)
    if (adaptationRequest) {
      const currentLinkedInCopy = typeof drafts.linkedin.fields.post_text === 'string'
        ? drafts.linkedin.fields.post_text
        : ''
      if (adaptationRequest.source_channel_packet?.linkedin_copy !== currentLinkedInCopy) {
        return NextResponse.json({
          error: 'Artifact-to-video adaptation is stale for the current LinkedIn channel packet.',
          current_gate: 'artifact_video_adaptation',
          revision_state: 'revision_needed',
          blockers: ['Rebuild the adaptation from the current approved LinkedIn channel packet before Video Generation handoff.'],
        }, { status: 422 })
      }
      try {
        artifactVideoAdaptation = buildSocialVideoAdaptationPacket(adaptationRequest)
      } catch (error) {
        if (error instanceof SocialVideoAdaptationError) {
          return NextResponse.json({
            error: 'Artifact-to-video adaptation is incomplete.',
            current_gate: 'artifact_video_adaptation',
            revision_state: 'revision_needed',
            blockers: error.blockers,
          }, { status: 422 })
        }
        throw error
      }
      attachArtifactVideoAdaptation(drafts, artifactVideoAdaptation)
    }
    // Keep campaign lineage in review metadata, never in public copy fields.
    if (typeof metadata.calendar_item_id === 'string') {
      for (const draft of Object.values(drafts)) {
        Object.assign(draft.shared_source, {
          work_item_id: workItem.id,
          calendar_item_id: metadata.calendar_item_id,
          campaign_id: metadata.campaign_id ?? null,
          social_content_id: metadata.social_content_id ?? null,
          campaign_phase: metadata.campaign_phase ?? null,
          channel: metadata.channel ?? null,
        })
      }
    }
    const lanes = normalizeSocialChannelLanes(metadata.channel_lanes)

    lanes.linkedin = {
      ...lanes.linkedin,
      status: 'in_review',
      draft_packet: drafts.linkedin,
      decision_note: null,
      review_requested_at: now,
      updated_at: now,
    }
    lanes.youtube = {
      ...lanes.youtube,
      status: 'in_review',
      draft_packet: drafts.youtube,
      decision_note: null,
      review_requested_at: now,
      updated_at: now,
    }
    lanes.youtube_shorts = {
      ...lanes.youtube_shorts,
      status: 'in_review',
      draft_packet: drafts.youtube_shorts,
      decision_note: null,
      review_requested_at: now,
      updated_at: now,
    }
    lanes.instagram_reels = {
      ...lanes.instagram_reels,
      status: 'in_review',
      draft_packet: drafts.instagram_reels,
      decision_note: null,
      review_requested_at: now,
      updated_at: now,
    }
    lanes.tiktok = {
      ...lanes.tiktok,
      status: 'in_review',
      draft_packet: drafts.tiktok,
      decision_note: null,
      review_requested_at: now,
      updated_at: now,
    }
    lanes.x = {
      ...lanes.x,
      status: 'in_review',
      draft_packet: drafts.x,
      decision_note: null,
      review_requested_at: now,
      updated_at: now,
    }
    lanes.thumbnail = {
      ...lanes.thumbnail,
      status: 'in_review',
      draft_packet: drafts.thumbnail,
      decision_note: null,
      review_requested_at: now,
      updated_at: now,
    }

    const updated = await updateAgentWorkItemMetadata({
      id: workItem.id,
      metadata: {
        ...metadata,
        channel_lanes: lanes,
        channel_review_workflow: {
          status: 'human_review_ready',
          prepared_channels: ['linkedin', 'youtube', 'youtube_shorts', 'instagram_reels', 'tiktok', 'x', 'thumbnail'],
          prepared_at: now,
          source_use_boundary: drafts.linkedin.source_use_boundary,
          copy_quality_gate: {
            status: copyQualityGate.status,
            checked_fields: copyQualityGate.checkedFields,
            checked_at: now,
            ruleset: 'social-content-final-copy-quality',
          },
          visual_quality_gate: {
            standard_version: 'consulting_reference_v1',
            status: 'required_before_visual_human_review',
            evaluator: 'evaluateSocialVisualQualityCandidate',
            pass_to_human: false,
            blocker: 'A visual candidate must supply subject, source-binding, template-novelty, and responsive-legibility receipts before visual Human QA.',
          },
          enrichment_receipt: enrichmentReceipt,
          artifact_video_adaptation: artifactVideoAdaptation
            ? {
                status: artifactVideoAdaptation.status,
                adaptation_id: artifactVideoAdaptation.adaptation_id,
                targets: artifactVideoAdaptation.targets,
                video_generation_bridge: artifactVideoAdaptation.video_generation_bridge,
              }
            : null,
          side_effects: {
            provider_generation: false,
            upload: false,
            publish: false,
            schedule: false,
            external_post: false,
          },
        },
      },
      note: `Social channel review drafts prepared by ${authResult.user.email ?? authResult.user.id}.`,
    })

    return NextResponse.json({
      success: true,
      work_item: updated,
      drafts,
      artifact_video_adaptation: artifactVideoAdaptation,
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  } catch (error) {
    console.error('[social-channel-review-drafts] prepare failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to prepare channel review drafts' },
      { status: 500 },
    )
  }
}
