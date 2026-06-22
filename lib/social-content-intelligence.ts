import type { AgentWorkItem } from '@/lib/agent-work-items'
import type { TopicTriggerCandidate, TopicTriggerPacket } from '@/lib/social-topic-backlog'

export const SOCIAL_TOPIC_TRIGGER_SOURCE_TYPE = 'social_topic_trigger'

export const SOCIAL_CONTENT_INTELLIGENCE_CHANNELS = [
  'linkedin',
  'youtube_shorts',
  'instagram_reels',
  'thumbnail',
] as const

export type SocialContentIntelligenceChannel = (typeof SOCIAL_CONTENT_INTELLIGENCE_CHANNELS)[number]

export type SocialChannelLaneStatus =
  | 'not_started'
  | 'selected'
  | 'draft_ready'
  | 'in_review'
  | 'approved'
  | 'blocked'

export type SocialChannelLane = {
  status: SocialChannelLaneStatus
  label: string
  decision_note?: string | null
  selected_for_content_id?: string | null
  updated_at?: string | null
  required_inputs: string[]
}

export type SocialChannelLanes = Record<SocialContentIntelligenceChannel, SocialChannelLane>

export type SocialResearchPatternStatus =
  | 'usable_framework'
  | 'needs_brand_translation'
  | 'too_close_to_source'
  | 'not_relevant'

export type CreatorAssetScoreInput = {
  views?: number | null
  likes?: number | null
  comments?: number | null
  shares?: number | null
  follower_count?: number | null
  published_at?: string | null
  retrieved_at?: string | null
  strategic_fit?: number | null
  channel_relative_performance?: number | null
}

export type CreatorAssetScore = {
  outlier_score: number
  view_to_follower_ratio: number | null
  engagement_rate: number | null
  comment_density: number | null
  recency_score: number
  channel_relative_performance: number
  small_creator_outlier_boost: number
  strategic_fit: number
}

const CHANNEL_LABELS: Record<SocialContentIntelligenceChannel, string> = {
  linkedin: 'LinkedIn',
  youtube_shorts: 'YouTube Shorts',
  instagram_reels: 'Instagram Reels',
  thumbnail: 'Thumbnail',
}

const CHANNEL_INPUTS: Record<SocialContentIntelligenceChannel, string[]> = {
  linkedin: [
    'post text',
    'CTA',
    'CTA URL',
    'hashtags',
    'carousel or illustration mode',
    'screenshot routes',
    'references',
  ],
  youtube_shorts: [
    'hook',
    'first 30 seconds',
    'script',
    'target duration',
    'storyboard scenes',
    'b-roll hints/assets',
    'on-screen text',
    'caption',
    'render readiness',
  ],
  instagram_reels: [
    'hook',
    'script',
    'target duration',
    'storyboard scenes',
    'cover text',
    'caption',
    'hashtags',
    'b-roll assets',
    'safe-area notes',
    'export readiness',
  ],
  thumbnail: [
    'source thumbnail reference',
    'pattern explanation',
    'AmaduTown adaptation direction',
    'short thumbnail text',
    'face/photo/avatar choice',
    'brand colors/style',
    '2-3 variants',
    'approval state',
  ],
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function isSocialContentIntelligenceChannel(value: string | null | undefined): value is SocialContentIntelligenceChannel {
  return SOCIAL_CONTENT_INTELLIGENCE_CHANNELS.includes(value as SocialContentIntelligenceChannel)
}

export function socialChannelLabel(channel: SocialContentIntelligenceChannel) {
  return CHANNEL_LABELS[channel]
}

export function defaultSocialChannelLanes(status: SocialChannelLaneStatus = 'not_started'): SocialChannelLanes {
  return SOCIAL_CONTENT_INTELLIGENCE_CHANNELS.reduce((lanes, channel) => {
    lanes[channel] = {
      status,
      label: CHANNEL_LABELS[channel],
      required_inputs: CHANNEL_INPUTS[channel],
    }
    return lanes
  }, {} as SocialChannelLanes)
}

export function normalizeSocialChannelLanes(value: unknown): SocialChannelLanes {
  const record = asRecord(value)
  const defaults = defaultSocialChannelLanes()
  if (!record) return defaults

  for (const channel of SOCIAL_CONTENT_INTELLIGENCE_CHANNELS) {
    const lane = asRecord(record[channel])
    if (!lane) continue
    const status = asString(lane.status)
    defaults[channel] = {
      ...defaults[channel],
      ...lane,
      status: isSocialChannelLaneStatus(status) ? status : defaults[channel].status,
      label: asString(lane.label) || defaults[channel].label,
      required_inputs: asStringArray(lane.required_inputs).length
        ? asStringArray(lane.required_inputs)
        : defaults[channel].required_inputs,
      decision_note: asString(lane.decision_note) || null,
      selected_for_content_id: asString(lane.selected_for_content_id) || null,
      updated_at: asString(lane.updated_at) || null,
    }
  }

  return defaults
}

function isSocialChannelLaneStatus(value: string): value is SocialChannelLaneStatus {
  return [
    'not_started',
    'selected',
    'draft_ready',
    'in_review',
    'approved',
    'blocked',
  ].includes(value)
}

export function normalizePatternStatus(value: unknown): SocialResearchPatternStatus {
  if (
    value === 'usable_framework'
    || value === 'needs_brand_translation'
    || value === 'too_close_to_source'
    || value === 'not_relevant'
  ) {
    return value
  }
  return 'needs_brand_translation'
}

export function scoreCreatorAsset(input: CreatorAssetScoreInput): CreatorAssetScore {
  const views = input.views && input.views > 0 ? input.views : null
  const followers = input.follower_count && input.follower_count > 0 ? input.follower_count : null
  const likes = input.likes && input.likes > 0 ? input.likes : 0
  const comments = input.comments && input.comments > 0 ? input.comments : 0
  const shares = input.shares && input.shares > 0 ? input.shares : 0

  const viewToFollowerRatio = views && followers ? views / followers : null
  const engagementRate = views ? (likes + comments + shares) / views : null
  const commentDensity = views ? comments / views : null
  const channelRelativePerformance = clamp(input.channel_relative_performance ?? 1, 0, 5)
  const strategicFit = clamp(input.strategic_fit ?? 0.5, 0, 1)

  const retrievedAt = input.retrieved_at ? Date.parse(input.retrieved_at) : Date.now()
  const publishedAt = input.published_at ? Date.parse(input.published_at) : retrievedAt
  const ageDays = Number.isFinite(publishedAt)
    ? Math.max(0, (retrievedAt - publishedAt) / 86_400_000)
    : 30
  const recencyScore = clamp(1 - ageDays / 30, 0, 1)

  const smallCreatorOutlierBoost = followers && followers <= 100_000 && viewToFollowerRatio
    ? clamp((viewToFollowerRatio - 1) / 4, 0, 1)
    : 0

  const outlierScore = Math.round(100 * clamp(
    (clamp((viewToFollowerRatio ?? 0) / 3, 0, 1) * 0.22)
    + (clamp((engagementRate ?? 0) / 0.12, 0, 1) * 0.18)
    + (clamp((commentDensity ?? 0) / 0.03, 0, 1) * 0.12)
    + (recencyScore * 0.12)
    + (clamp(channelRelativePerformance / 3, 0, 1) * 0.16)
    + (smallCreatorOutlierBoost * 0.10)
    + (strategicFit * 0.10),
    0,
    1,
  ))

  return {
    outlier_score: outlierScore,
    view_to_follower_ratio: viewToFollowerRatio == null ? null : Number(viewToFollowerRatio.toFixed(4)),
    engagement_rate: engagementRate == null ? null : Number(engagementRate.toFixed(4)),
    comment_density: commentDensity == null ? null : Number(commentDensity.toFixed(4)),
    recency_score: Number(recencyScore.toFixed(4)),
    channel_relative_performance: Number(channelRelativePerformance.toFixed(4)),
    small_creator_outlier_boost: Number(smallCreatorOutlierBoost.toFixed(4)),
    strategic_fit: Number(strategicFit.toFixed(4)),
  }
}

export function socialInsightMetadataFromCandidate(input: {
  candidate: TopicTriggerCandidate
  packet: TopicTriggerPacket
  triggerSource: string
  researchPacketIds?: string[]
}) {
  const { candidate, packet, triggerSource } = input
  return {
    social_topic_trigger: true,
    insight_version: 'social_content_intelligence_v1',
    trigger_source: triggerSource,
    source_policy: packet.source_policy,
    source_counts: packet.source_counts,
    generated_at: packet.generated_at,
    generated_by: packet.generated_by,
    model: packet.model,
    provider: packet.provider,
    notes: packet.notes,
    privacy_boundary: packet.privacy_boundary,
    research_packet_ids: input.researchPacketIds ?? [],
    channel_lanes: defaultSocialChannelLanes(),
    insight: {
      candidate_id: candidate.id,
      title: candidate.title,
      triggering_event: candidate.triggering_event,
      source_type: candidate.source_type,
      source_label: candidate.source_label,
      source_ids: candidate.source_ids,
      why_vambah_can_speak: candidate.why_vambah_can_speak,
      brand_goal: candidate.brand_goal,
      content_angle: candidate.content_angle,
      suggested_hook: candidate.suggested_hook,
      audience: candidate.audience,
      sensitivity: candidate.sensitivity,
      evidence_summary: candidate.evidence_summary,
      claim_boundaries: candidate.claim_boundaries,
      approved_research_patterns: [],
    },
  }
}

export function isSocialTopicTriggerWorkItem(item: AgentWorkItem) {
  return item.source_type === SOCIAL_TOPIC_TRIGGER_SOURCE_TYPE || item.metadata?.social_topic_trigger === true
}

export function socialTopicBacklogItemFromWorkItem(item: AgentWorkItem) {
  const metadata = item.metadata ?? {}
  const insight = asRecord(metadata.insight) ?? {}
  const lanes = normalizeSocialChannelLanes(metadata.channel_lanes)
  const linkedinLane = lanes.linkedin
  return {
    id: item.id,
    agent_work_item_id: item.id,
    candidate_key: item.idempotency_key?.replace(/^social-topic-trigger:/, '') ?? item.id,
    title: asString(insight.title) || item.title,
    triggering_event: asString(insight.triggering_event),
    source_type: asString(insight.source_type) || item.source_type,
    source_label: asString(insight.source_label) || item.source_label,
    source_ids: asStringArray(insight.source_ids),
    why_vambah_can_speak: asString(insight.why_vambah_can_speak),
    brand_goal: asString(insight.brand_goal),
    content_angle: asString(insight.content_angle) || item.objective,
    suggested_hook: asString(insight.suggested_hook),
    audience: asString(insight.audience),
    sensitivity: asString(insight.sensitivity) || 'needs_review',
    evidence_summary: asString(insight.evidence_summary),
    claim_boundaries: asStringArray(insight.claim_boundaries),
    status: linkedinLane.status === 'selected' ? 'selected' : 'available',
    source_policy: asString(metadata.source_policy) || 'sanitized_summaries_only',
    source_counts: asRecord(metadata.source_counts) ?? {},
    generated_by: asString(metadata.generated_by) || null,
    generated_at: asString(metadata.generated_at) || item.created_at,
    last_seen_at: item.updated_at,
    channel_lanes: lanes,
    metadata,
  }
}

export function socialChannelLaneSummary(item: AgentWorkItem) {
  const lanes = normalizeSocialChannelLanes(item.metadata?.channel_lanes)
  return SOCIAL_CONTENT_INTELLIGENCE_CHANNELS.map((channel) => ({
    channel,
    label: CHANNEL_LABELS[channel],
    status: lanes[channel].status,
  }))
}

export function socialMetricsFromUnknown(value: unknown): CreatorAssetScoreInput {
  const record = asRecord(value) ?? {}
  return {
    views: numberOrNull(record.views),
    likes: numberOrNull(record.likes),
    comments: numberOrNull(record.comments),
    shares: numberOrNull(record.shares),
    follower_count: numberOrNull(record.follower_count ?? record.followers ?? record.subscriber_count),
    published_at: asString(record.published_at) || null,
    retrieved_at: asString(record.retrieved_at) || null,
    strategic_fit: numberOrNull(record.strategic_fit),
    channel_relative_performance: numberOrNull(record.channel_relative_performance),
  }
}
