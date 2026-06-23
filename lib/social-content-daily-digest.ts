import { listAgentWorkItems, type AgentWorkItem } from '@/lib/agent-work-items'
import {
  normalizeSocialChannelLanes,
  SOCIAL_CONTENT_INTELLIGENCE_CHANNELS,
  SOCIAL_TOPIC_TRIGGER_SOURCE_TYPE,
  socialChannelLabel,
  type SocialContentIntelligenceChannel,
} from '@/lib/social-content-intelligence'
import { supabaseAdmin } from '@/lib/supabase'

type ResearchPacketRow = Record<string, unknown>

export type SocialContentDailyDigest = {
  generated_at: string
  lookback_days: number
  retrieval_window_start: string
  summary: {
    new_research_packets: number
    usable_patterns: number
    shaka_insights: number
    blocked_or_sensitive_items: number
  }
  strongest_patterns: Array<{
    packet_id: string
    title: string
    source_url: string
    platform: string
    creator: string | null
    outlier_score: number
    pattern_status: string
    hook_structure: string | null
    promise_value: string | null
    thumbnail_pattern: string | null
  }>
  recommended_insights: Array<{
    work_item_id: string
    title: string
    status: string
    priority: string
    triggering_event: string | null
    why_vambah_can_speak: string | null
    audience: string | null
    sensitivity: string
  }>
  suggested_channel_lanes: Array<{
    work_item_id: string
    insight_title: string
    channel: SocialContentIntelligenceChannel
    label: string
    status: string
    required_inputs: string[]
  }>
  thumbnail_opportunities: Array<{
    packet_id: string
    title: string
    source_url: string
    platform: string
    creator: string | null
    outlier_score: number
    pattern_status: string
    hook_structure: string | null
    promise_value: string | null
    thumbnail_pattern: string | null
  }>
  blocked_or_sensitive_items: Array<{
    type: string
    id: string
    title: string
    reason: string
  }>
  governance: Record<string, string>
  side_effects: {
    provider_generation: false
    upload: false
    publish: false
    schedule: false
    external_post: false
    apify_run: false
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function isBlockedPattern(packet: ResearchPacketRow) {
  const status = asString(packet.status)
  const patternStatus = asString(packet.pattern_status)
  return status === 'rejected'
    || status === 'archived'
    || patternStatus === 'too_close_to_source'
    || patternStatus === 'not_relevant'
}

function packetTitle(packet: ResearchPacketRow) {
  return asString(packet.title)
    || asString(packet.caption)
    || asString(packet.creator_name)
    || asString(packet.source_url)
    || 'Untitled research packet'
}

function compactPattern(packet: ResearchPacketRow) {
  const pattern = asRecord(packet.pattern_packet)
  return {
    packet_id: asString(packet.id),
    title: packetTitle(packet),
    source_url: asString(packet.source_url),
    platform: asString(packet.platform) || 'other',
    creator: asString(packet.creator_name) || asString(packet.creator_handle) || null,
    outlier_score: asNumber(packet.outlier_score),
    pattern_status: asString(packet.pattern_status) || 'needs_brand_translation',
    hook_structure: asString(pattern.hook_structure) || asString(packet.hook_transcript) || null,
    promise_value: asString(pattern.promise_value) || null,
    thumbnail_pattern: asString(pattern.thumbnail_pattern) || null,
  }
}

function insightFor(item: AgentWorkItem) {
  const insight = asRecord(item.metadata?.insight)
  return {
    work_item_id: item.id,
    title: asString(insight.title) || item.title,
    status: item.status,
    priority: item.priority,
    triggering_event: asString(insight.triggering_event) || null,
    why_vambah_can_speak: asString(insight.why_vambah_can_speak) || null,
    audience: asString(insight.audience) || null,
    sensitivity: asString(insight.sensitivity) || 'needs_review',
  }
}

function laneSuggestions(items: AgentWorkItem[]) {
  return SOCIAL_CONTENT_INTELLIGENCE_CHANNELS.flatMap((channel: SocialContentIntelligenceChannel) => {
    return items
      .map((item) => {
        const lanes = normalizeSocialChannelLanes(item.metadata?.channel_lanes)
        const lane = lanes[channel]
        if (lane.status === 'approved') return null
        return {
          work_item_id: item.id,
          insight_title: insightFor(item).title,
          channel,
          label: socialChannelLabel(channel),
          status: lane.status,
          required_inputs: lane.required_inputs.slice(0, 4),
        }
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .slice(0, 4)
  })
}

export async function buildSocialContentDailyDigest(input: {
  lookbackDays?: number
  limit?: number
} = {}): Promise<SocialContentDailyDigest> {
  const lookbackDays = Math.min(Math.max(input.lookbackDays ?? 5, 1), 30)
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 25)
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString()

  const [{ data: packetData, error: packetError }, workItems] = await Promise.all([
    supabaseAdmin
      .from('social_content_research_packets')
      .select('id, source_url, platform, creator_name, creator_handle, title, caption, hook_transcript, thumbnail_url, outlier_score, pattern_status, pattern_packet, privacy_notes, retrieved_at, status')
      .gte('retrieved_at', since)
      .order('outlier_score', { ascending: false })
      .order('retrieved_at', { ascending: false })
      .limit(limit),
    listAgentWorkItems({
      sourceType: SOCIAL_TOPIC_TRIGGER_SOURCE_TYPE,
      limit,
    }),
  ])

  if (packetError) throw new Error(packetError.message)

  const packets = ((packetData ?? []) as unknown[]).map((packet) => asRecord(packet))
  const usablePackets = packets.filter((packet) => !isBlockedPattern(packet))
  const blockedPackets = packets.filter(isBlockedPattern)
  const insights = workItems.map(insightFor)
  const sensitiveInsights = insights.filter((insight) => insight.sensitivity !== 'public_safe' && insight.sensitivity !== 'low')

  return {
    generated_at: new Date().toISOString(),
    lookback_days: lookbackDays,
    retrieval_window_start: since,
    summary: {
      new_research_packets: packets.length,
      usable_patterns: usablePackets.length,
      shaka_insights: workItems.length,
      blocked_or_sensitive_items: blockedPackets.length + sensitiveInsights.length,
    },
    strongest_patterns: usablePackets.slice(0, 5).map(compactPattern),
    recommended_insights: insights.slice(0, 5),
    suggested_channel_lanes: laneSuggestions(workItems).slice(0, 8),
    thumbnail_opportunities: usablePackets
      .filter((packet) => asString(packet.thumbnail_url) || asString(asRecord(packet.pattern_packet).thumbnail_pattern))
      .slice(0, 4)
      .map(compactPattern),
    blocked_or_sensitive_items: [
      ...blockedPackets.slice(0, 4).map((packet) => ({
        type: 'research_packet',
        id: asString(packet.id),
        title: packetTitle(packet),
        reason: asString(packet.pattern_status) || asString(packet.status) || 'blocked',
      })),
      ...sensitiveInsights.slice(0, 4).map((insight) => ({
        type: 'shaka_insight',
        id: insight.work_item_id,
        title: insight.title,
        reason: insight.sensitivity,
      })),
    ],
    governance: {
      schedule_activation: 'approval_required',
      apify_collection: 'approval_required',
      drafting: 'approval_required',
      media_generation: 'approval_required',
      uploads: 'approval_required',
      publishing: 'approval_required',
    },
    side_effects: {
      provider_generation: false,
      upload: false,
      publish: false,
      schedule: false,
      external_post: false,
      apify_run: false,
    },
  }
}
