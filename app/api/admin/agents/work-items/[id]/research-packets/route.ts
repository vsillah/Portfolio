import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentWorkItem, updateAgentWorkItemMetadata } from '@/lib/agent-work-items'
import { isSocialTopicTriggerWorkItem } from '@/lib/social-content-intelligence'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    : []
}

function compactPattern(packet: Record<string, unknown>) {
  return {
    packet_id: asString(packet.id),
    source_url: asString(packet.source_url),
    platform: asString(packet.platform) || 'other',
    creator_name: asString(packet.creator_name) || null,
    creator_handle: asString(packet.creator_handle) || null,
    title: asString(packet.title) || null,
    outlier_score: typeof packet.outlier_score === 'number' ? packet.outlier_score : Number(packet.outlier_score ?? 0),
    pattern_status: asString(packet.pattern_status) || 'needs_brand_translation',
    pattern_packet: asRecord(packet.pattern_packet),
    privacy_notes: asString(packet.privacy_notes) || null,
    retrieved_at: asString(packet.retrieved_at) || null,
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

  const body = asRecord(await request.json().catch(() => ({})))
  const packetIds = Array.from(new Set(asStringArray(body.packet_ids)))
  if (packetIds.length === 0) {
    return NextResponse.json({ error: 'packet_ids are required' }, { status: 400 })
  }

  try {
    const workItem = await getAgentWorkItem(params.id)
    if (!workItem) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }
    if (!isSocialTopicTriggerWorkItem(workItem)) {
      return NextResponse.json({ error: 'Work item is not a social topic trigger' }, { status: 400 })
    }

    const { data: packets, error } = await supabaseAdmin
      .from('social_content_research_packets')
      .select('id, source_url, platform, creator_name, creator_handle, title, outlier_score, pattern_status, pattern_packet, privacy_notes, retrieved_at, status')
      .in('id', packetIds)

    if (error) throw new Error(error.message)
    const packetRows: Record<string, unknown>[] = ((packets ?? []) as unknown[]).map((packet) => asRecord(packet))
    if (packetRows.length !== packetIds.length) {
      return NextResponse.json({ error: 'One or more research packets were not found' }, { status: 404 })
    }

    const blockedPacket = packetRows.find((packet) => {
      const status = asString(packet.status)
      const patternStatus = asString(packet.pattern_status)
      return status === 'rejected'
        || status === 'archived'
        || patternStatus === 'too_close_to_source'
        || patternStatus === 'not_relevant'
    })
    if (blockedPacket) {
      return NextResponse.json(
        { error: 'Only usable or brand-translation research patterns can be linked to an insight' },
        { status: 400 },
      )
    }

    const metadata = workItem.metadata ?? {}
    const insight = asRecord(metadata.insight)
    const existingPatterns = Array.isArray(insight.approved_research_patterns)
      ? insight.approved_research_patterns.map((item) => asRecord(item))
      : []
    const nextPatterns = [
      ...existingPatterns.filter((item) => !packetIds.includes(asString(item.packet_id))),
      ...packetRows.map((packet) => compactPattern(packet)),
    ]
    const nextPacketIds = Array.from(new Set([
      ...asStringArray(metadata.research_packet_ids),
      ...packetIds,
    ]))

    const { error: packetUpdateError } = await supabaseAdmin
      .from('social_content_research_packets')
      .update({ status: 'approved' })
      .in('id', packetIds)
    if (packetUpdateError) throw new Error(packetUpdateError.message)

    const updated = await updateAgentWorkItemMetadata({
      id: workItem.id,
      metadata: {
        ...metadata,
        research_packet_ids: nextPacketIds,
        research_patterns_linked_at: new Date().toISOString(),
        research_patterns_linked_by: authResult.user.email ?? authResult.user.id,
        research_patterns_decision_note: asString(body.decision_note) || null,
        insight: {
          ...insight,
          approved_research_patterns: nextPatterns,
        },
      },
      note: `Linked ${packetIds.length} public research pattern(s) to social insight.`,
    })

    return NextResponse.json({
      success: true,
      work_item: updated,
      linked_packet_ids: nextPacketIds,
      approved_research_patterns: nextPatterns,
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  } catch (error) {
    console.error('[social-insight-research-packets] link failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to link research packets' },
      { status: 500 },
    )
  }
}
