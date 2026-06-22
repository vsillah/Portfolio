import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  getAgentWorkItem,
  listAgentWorkItems,
  updateAgentWorkItemMetadata,
} from '@/lib/agent-work-items'
import {
  normalizeSocialChannelLanes,
  socialTopicBacklogItemFromWorkItem,
  SOCIAL_TOPIC_TRIGGER_SOURCE_TYPE,
} from '@/lib/social-content-intelligence'
import { runSocialTopicBacklogDiscovery } from '@/lib/social-topic-backlog'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isMissingBacklogTable(error: unknown) {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : null
  const message = error instanceof Error
    ? error.message
    : typeof record?.message === 'string'
      ? record.message
      : String(error ?? '')
  return message.includes('social_topic_backlog') && (
    message.includes('does not exist')
    || message.includes('Could not find the table')
    || message.includes('schema cache')
  )
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'available'
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '8', 10), 1), 24)

    const workItems = await listAgentWorkItems({
      sourceType: SOCIAL_TOPIC_TRIGGER_SOURCE_TYPE,
      limit,
    })
    const mappedItems = workItems
      .map(socialTopicBacklogItemFromWorkItem)
      .filter((item) => status === 'all' || item.status === status)

    if (mappedItems.length > 0) {
      return NextResponse.json({
        items: mappedItems,
        source: 'agent_work_items',
      })
    }

    const { data, error } = await supabaseAdmin
      .from('social_topic_backlog')
      .select('*')
      .eq('status', status)
      .order('last_seen_at', { ascending: false })
      .limit(limit)

    if (error) {
      if (isMissingBacklogTable(error)) {
        return NextResponse.json({
          items: [],
          unavailable: true,
          error: 'Social topic backlog migration has not been applied yet',
        })
      }
      throw new Error(error.message)
    }

    return NextResponse.json({ items: data ?? [] })
  } catch (error) {
    console.error('[social-topic-backlog] list failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch social topic backlog' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const result = await runSocialTopicBacklogDiscovery({
      actorId: authResult.user.id,
      triggerSource: 'manual_admin_social_topic_backlog',
    })

    return NextResponse.json({
      success: true,
      items: result.backlogItems,
      source_counts: result.sourceCounts,
      candidate_count: result.packet.candidates.length,
      side_effects: {
        provider_generation: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  } catch (error) {
    console.error('[social-topic-backlog] refresh failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh social topic backlog' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json().catch(() => ({})) as {
      id?: string
      content_id?: string
      status?: string
    }
    if (!body.id) {
      return NextResponse.json({ error: 'Topic backlog id is required' }, { status: 400 })
    }

    const nextStatus = body.status || 'selected'
    if (!['available', 'selected', 'used', 'dismissed', 'archived'].includes(nextStatus)) {
      return NextResponse.json({ error: 'Invalid topic backlog status' }, { status: 400 })
    }

    const update: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    }
    if (body.content_id) {
      update.selected_for_content_id = body.content_id
      update.selected_at = new Date().toISOString()
    }

    const workItem = await getAgentWorkItem(body.id)
    if (workItem?.source_type === SOCIAL_TOPIC_TRIGGER_SOURCE_TYPE || workItem?.metadata?.social_topic_trigger === true) {
      const lanes = normalizeSocialChannelLanes(workItem.metadata?.channel_lanes)
      lanes.linkedin = {
        ...lanes.linkedin,
        status: nextStatus === 'selected' || nextStatus === 'used' ? 'selected' : 'not_started',
        selected_for_content_id: body.content_id ?? lanes.linkedin.selected_for_content_id ?? null,
        updated_at: new Date().toISOString(),
      }
      const updated = await updateAgentWorkItemMetadata({
        id: workItem.id,
        metadata: {
          ...(workItem.metadata ?? {}),
          channel_lanes: lanes,
          selected_for_social_content_id: body.content_id ?? null,
          social_topic_backlog_status: nextStatus,
        },
        note: `LinkedIn lane marked ${nextStatus} from Social Content topic picker.`,
      })
      return NextResponse.json({
        success: true,
        item: socialTopicBacklogItemFromWorkItem(updated),
        source: 'agent_work_items',
      })
    }

    const { data, error } = await supabaseAdmin
      .from('social_topic_backlog')
      .update(update)
      .eq('id', body.id)
      .select('*')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true, item: data })
  } catch (error) {
    console.error('[social-topic-backlog] update failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update social topic backlog item' },
      { status: 500 },
    )
  }
}
