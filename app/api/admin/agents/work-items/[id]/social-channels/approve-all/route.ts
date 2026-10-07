import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentWorkItem, updateAgentWorkItemMetadata } from '@/lib/agent-work-items'
import {
  SOCIAL_CONTENT_INTELLIGENCE_CHANNELS,
  normalizeSocialChannelLanes,
  type SocialChannelReviewDraftPacket,
} from '@/lib/social-content-intelligence'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function approvalBlocker(channel: string, lane: Record<string, unknown>) {
  const draftPacket = asRecord(lane.draft_packet)
  if (Object.keys(asRecord(draftPacket.fields)).length === 0) {
    return `${channel}: review draft is missing`
  }
  if (asString(asRecord(draftPacket.enrichment_receipt).status) !== 'passed') {
    return `${channel}: passing enrichment receipt is missing`
  }
  return null
}

export async function PATCH(
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

    const lanes = normalizeSocialChannelLanes(workItem.metadata?.channel_lanes)
    const blockers = SOCIAL_CONTENT_INTELLIGENCE_CHANNELS
      .map((channel) => approvalBlocker(channel, asRecord(lanes[channel])))
      .filter((blocker): blocker is string => Boolean(blocker))
    if (blockers.length) {
      return NextResponse.json({
        error: 'Every social channel lane must have a prepared draft and passing enrichment receipt before bulk approval.',
        blockers,
      }, { status: 409 })
    }

    const decidedAt = new Date().toISOString()
    for (const channel of SOCIAL_CONTENT_INTELLIGENCE_CHANNELS) {
      const lane = lanes[channel]
      const draftPacket = asRecord(lane.draft_packet)
      const decisionNote = lane.decision_note || null
      lanes[channel] = {
        ...lane,
        status: 'approved',
        decision_note: decisionNote,
        draft_packet: {
          ...draftPacket,
          approval_status: 'approved',
          decision_note: decisionNote,
          decided_at: decidedAt,
        } as SocialChannelReviewDraftPacket,
        updated_at: decidedAt,
      }
    }

    const updated = await updateAgentWorkItemMetadata({
      id: workItem.id,
      metadata: {
        ...(workItem.metadata ?? {}),
        channel_lanes: lanes,
      },
      note: `All social channel lanes approved by ${authResult.user.email ?? authResult.user.id}.`,
    })

    return NextResponse.json({
      success: true,
      work_item: updated,
      approved_channels: SOCIAL_CONTENT_INTELLIGENCE_CHANNELS,
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  } catch (error) {
    console.error('[social-channel-lanes] bulk approval failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve social channel lanes' },
      { status: 500 },
    )
  }
}
