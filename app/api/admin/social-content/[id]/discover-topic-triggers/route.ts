import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  discoverSocialTopicCandidates,
  fetchSocialContentTopicContext,
  saveTopicTriggerPacketToSocialContent,
  upsertSocialTopicBacklog,
} from '@/lib/social-topic-backlog'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const row = await fetchSocialContentTopicContext(params.id)
    if (!row) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    const ragContext = asRecord(row.rag_context) ?? {}
    if (ragContext.source !== 'agent_ops_social_outreach_goal') {
      return NextResponse.json({ error: 'Topic discovery is only available for Agent Ops social pilot drafts' }, { status: 400 })
    }

    const { packet } = await discoverSocialTopicCandidates({
      row,
      actorId: authResult.user.id,
      operation: 'social_content_topic_trigger_discovery',
    })
    const updated = await saveTopicTriggerPacketToSocialContent(row, packet)
    let backlogItems: unknown[] = []
    let backlogWarning: string | null = null
    try {
      backlogItems = await upsertSocialTopicBacklog(packet, 'manual_social_content_detail')
    } catch (backlogError) {
      backlogWarning = backlogError instanceof Error
        ? backlogError.message
        : 'Topic backlog write failed'
      console.warn('[discover-topic-triggers] topic backlog write skipped:', backlogWarning)
    }

    return NextResponse.json({
      success: true,
      item: updated,
      topic_trigger_packet: packet,
      backlog_items: backlogItems,
      backlog_warning: backlogWarning,
    })
  } catch (error) {
    console.error('[discover-topic-triggers] error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('No sanctioned source summaries') ? 409 : message.includes('invalid JSON') || message.includes('usable candidates') ? 502 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
