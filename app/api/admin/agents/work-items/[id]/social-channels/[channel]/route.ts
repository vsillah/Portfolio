import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentWorkItem, updateAgentWorkItemMetadata } from '@/lib/agent-work-items'
import {
  isSocialContentIntelligenceChannel,
  normalizeSocialChannelLanes,
  type SocialChannelReviewDraftPacket,
  type SocialChannelLaneStatus,
} from '@/lib/social-content-intelligence'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function hasReviewDraft(lane: Record<string, unknown>) {
  const draftPacket = asRecord(lane.draft_packet)
  const fields = asRecord(draftPacket.fields)
  return Object.keys(fields).length > 0
}

function draftApprovalStatus(status: SocialChannelLaneStatus) {
  if (status === 'approved' || status === 'blocked') return status
  return 'in_review'
}

function stampDraftPacketDecision(input: {
  draftPacket: unknown
  status: SocialChannelLaneStatus
  decisionNote: string | null
  decidedAt: string
}) {
  const draftPacket = asRecord(input.draftPacket)
  if (!Object.keys(draftPacket).length) return input.draftPacket as SocialChannelReviewDraftPacket | null | undefined

  return {
    ...draftPacket,
    approval_status: draftApprovalStatus(input.status),
    decision_note: input.decisionNote,
    decided_at: input.decidedAt,
  } as SocialChannelReviewDraftPacket
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; channel: string } },
) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  if (!isSocialContentIntelligenceChannel(params.channel)) {
    return NextResponse.json({ error: 'Invalid social content channel' }, { status: 400 })
  }

  const body = asRecord(await request.json().catch(() => ({})))
  const status = asString(body.status)
  if (status && ![
    'not_started',
    'selected',
    'draft_ready',
    'in_review',
    'approved',
    'blocked',
  ].includes(status)) {
    return NextResponse.json({ error: 'Invalid channel status' }, { status: 400 })
  }
  const nextStatus = status as SocialChannelLaneStatus | ''

  try {
    const workItem = await getAgentWorkItem(params.id)
    if (!workItem) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }

    const lanes = normalizeSocialChannelLanes(workItem.metadata?.channel_lanes)
    if (nextStatus === 'approved'
      && (params.channel === 'linkedin' || params.channel === 'youtube_shorts')
      && !hasReviewDraft(lanes[params.channel])
    ) {
      return NextResponse.json(
        { error: 'Prepare the LinkedIn and YouTube review drafts before approving this channel lane' },
        { status: 400 },
      )
    }

    const decidedAt = new Date().toISOString()
    const nextLaneStatus = nextStatus || lanes[params.channel].status
    const decisionNote = asString(body.decision_note) || lanes[params.channel].decision_note || null

    lanes[params.channel] = {
      ...lanes[params.channel],
      ...asRecord(body.patch),
      status: nextLaneStatus,
      decision_note: decisionNote,
      draft_packet: stampDraftPacketDecision({
        draftPacket: lanes[params.channel].draft_packet,
        status: nextLaneStatus,
        decisionNote,
        decidedAt,
      }),
      updated_at: decidedAt,
    }

    const updated = await updateAgentWorkItemMetadata({
      id: workItem.id,
      metadata: {
        ...(workItem.metadata ?? {}),
        channel_lanes: lanes,
      },
      note: `${lanes[params.channel].label} lane updated by ${authResult.user.email ?? authResult.user.id}.`,
    })

    return NextResponse.json({
      success: true,
      work_item: updated,
      lane: lanes[params.channel],
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  } catch (error) {
    console.error('[social-channel-lane] update failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update social channel lane' },
      { status: 500 },
    )
  }
}
