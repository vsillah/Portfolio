import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentWorkItem, updateAgentWorkItemMetadata } from '@/lib/agent-work-items'
import {
  isSocialContentIntelligenceChannel,
  normalizeSocialChannelLanes,
  type SocialChannelLaneStatus,
} from '@/lib/social-content-intelligence'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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
    lanes[params.channel] = {
      ...lanes[params.channel],
      ...asRecord(body.patch),
      status: nextStatus || lanes[params.channel].status,
      decision_note: asString(body.decision_note) || lanes[params.channel].decision_note || null,
      updated_at: new Date().toISOString(),
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
