import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentWorkItem, updateAgentWorkItemMetadata } from '@/lib/agent-work-items'
import {
  buildLinkedInYoutubeReviewDrafts,
  normalizeSocialChannelLanes,
} from '@/lib/social-content-intelligence'

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
    const drafts = buildLinkedInYoutubeReviewDrafts({ insight, generatedAt: now })
    const lanes = normalizeSocialChannelLanes(metadata.channel_lanes)

    lanes.linkedin = {
      ...lanes.linkedin,
      status: 'in_review',
      draft_packet: drafts.linkedin,
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

    const updated = await updateAgentWorkItemMetadata({
      id: workItem.id,
      metadata: {
        ...metadata,
        channel_lanes: lanes,
        channel_review_workflow: {
          status: 'human_review_ready',
          prepared_channels: ['linkedin', 'youtube_shorts', 'instagram_reels', 'tiktok'],
          prepared_at: now,
          source_use_boundary: drafts.linkedin.source_use_boundary,
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
