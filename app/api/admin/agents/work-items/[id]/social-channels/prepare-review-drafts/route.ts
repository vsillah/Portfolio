import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentWorkItem, updateAgentWorkItemMetadata } from '@/lib/agent-work-items'
import {
  buildLinkedInYoutubeReviewDrafts,
  normalizeSocialChannelLanes,
  socialChannelReviewPublicCopyFields,
} from '@/lib/social-content-intelligence'
import { validateSocialPublicCopyFields } from '@/lib/social-content-lifecycle'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function hasApprovedResearchPatterns(insight: Record<string, unknown>) {
  return Array.isArray(insight.approved_research_patterns)
    && insight.approved_research_patterns.some((pattern) => Object.keys(asRecord(pattern)).length > 0)
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
    const insight = asRecord(metadata.insight)
    if (!Object.keys(insight).length) {
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
