import type { AgentWorkItem } from '@/lib/agent-work-items'
import type { TopicTriggerCandidate, TopicTriggerPacket } from '@/lib/social-topic-backlog'

export const SOCIAL_TOPIC_TRIGGER_SOURCE_TYPE = 'social_topic_trigger'

export const SOCIAL_CONTENT_INTELLIGENCE_CHANNELS = [
  'linkedin',
  'youtube_shorts',
  'instagram_reels',
  'tiktok',
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
  draft_packet?: SocialChannelReviewDraftPacket | null
  review_requested_at?: string | null
  selected_for_content_id?: string | null
  updated_at?: string | null
  required_inputs: string[]
}

export type SocialChannelLanes = Record<SocialContentIntelligenceChannel, SocialChannelLane>

export type SocialChannelReviewDraftPacket = {
  channel: SocialContentIntelligenceChannel
  generated_at: string
  approval_status: 'in_review' | 'approved' | 'blocked'
  decision_note?: string | null
  decided_at?: string | null
  shared_source: {
    insight_title: string
    triggering_event: string
    content_angle: string
    evidence_summary: string
  }
  source_insight_title: string
  source_use_boundary: string
  fields: Record<string, unknown>
  source_research_patterns: Array<Record<string, unknown>>
  side_effects: {
    provider_generation: false
    upload: false
    publish: false
    schedule: false
    external_post: false
  }
}

export type LinkedInYoutubeReviewDrafts = {
  linkedin: SocialChannelReviewDraftPacket
  youtube_shorts: SocialChannelReviewDraftPacket
  instagram_reels: SocialChannelReviewDraftPacket
  tiktok: SocialChannelReviewDraftPacket
}

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

export type SocialResearchPlatform =
  | 'youtube'
  | 'youtube_shorts'
  | 'instagram'
  | 'instagram_reels'
  | 'tiktok'
  | 'x'
  | 'linkedin'
  | 'other'

export type SocialResearchActorKey =
  | 'youtube_transcript'
  | 'youtube_video'
  | 'instagram_post'
  | 'instagram_reel'
  | 'tiktok_video'

export type SocialResearchSource = {
  url: string
  platform?: SocialResearchPlatform | null
  actor_key?: SocialResearchActorKey | null
  label?: string | null
}

export type SocialResearchActorConfig = {
  key: SocialResearchActorKey
  label: string
  actor_id: string
  platform: SocialResearchPlatform
  default_input: Record<string, unknown>
}

export type SocialResearchPacketDraft = {
  source_url: string
  platform: SocialResearchPlatform
  creator_name?: string | null
  creator_handle?: string | null
  title?: string | null
  caption?: string | null
  thumbnail_url?: string | null
  hook_transcript?: string | null
  metrics: Record<string, unknown>
  actor_metadata: Record<string, unknown>
  pattern_packet: Record<string, unknown>
  pattern_status: SocialResearchPatternStatus
  privacy_notes?: string | null
  retrieved_at: string
}

export type SocialResearchEvidenceItem = {
  source_url: string
  platform?: SocialResearchPlatform | null
  creator_name?: string | null
  creator_handle?: string | null
  title?: string | null
  caption?: string | null
  thumbnail_url?: string | null
  hook_transcript?: string | null
  metrics?: Record<string, unknown> | null
  pattern_packet?: Record<string, unknown> | null
  pattern_status?: SocialResearchPatternStatus | null
  retrieval_method?: 'codex_browser' | 'manual_public_review' | 'public_page_fetch' | 'apify' | 'other'
  retrieval_notes?: string | null
}

const CHANNEL_LABELS: Record<SocialContentIntelligenceChannel, string> = {
  linkedin: 'LinkedIn',
  youtube_shorts: 'YouTube Shorts',
  instagram_reels: 'Instagram Reels',
  tiktok: 'TikTok',
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
  tiktok: [
    'hook',
    'script',
    'target duration',
    'storyboard scenes',
    'cover frame',
    'caption',
    'hashtags',
    'b-roll assets',
    'audio rights',
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

export const SOCIAL_RESEARCH_ACTORS: Record<SocialResearchActorKey, SocialResearchActorConfig> = {
  youtube_transcript: {
    key: 'youtube_transcript',
    label: 'YouTube transcript',
    actor_id: 'pintostudio/youtube-transcript-scraper',
    platform: 'youtube',
    default_input: {},
  },
  youtube_video: {
    key: 'youtube_video',
    label: 'YouTube video/channel data',
    actor_id: 'streamers/youtube-scraper',
    platform: 'youtube',
    default_input: { maxResults: 10 },
  },
  instagram_post: {
    key: 'instagram_post',
    label: 'Instagram post/reel data',
    actor_id: 'apify/instagram-post-scraper',
    platform: 'instagram',
    default_input: {},
  },
  instagram_reel: {
    key: 'instagram_reel',
    label: 'Instagram reels data',
    actor_id: 'apify/instagram-scraper',
    platform: 'instagram_reels',
    default_input: { resultsLimit: 10 },
  },
  tiktok_video: {
    key: 'tiktok_video',
    label: 'TikTok research later',
    actor_id: 'clockworks/tiktok-scraper',
    platform: 'tiktok',
    default_input: { resultsPerPage: 10 },
  },
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

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => Boolean(item))
    : []
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = asString(value).trim()
    if (text) return text
  }
  return ''
}

function truncate(value: string, maxLength: number) {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 3).trim()}...`
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
      draft_packet: asRecord(lane.draft_packet) as SocialChannelReviewDraftPacket | null,
      review_requested_at: asString(lane.review_requested_at) || null,
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

export function normalizeResearchPlatform(value: unknown): SocialResearchPlatform {
  if (
    value === 'youtube'
    || value === 'youtube_shorts'
    || value === 'instagram'
    || value === 'instagram_reels'
    || value === 'tiktok'
    || value === 'x'
    || value === 'linkedin'
    || value === 'other'
  ) {
    return value
  }
  return 'other'
}

export function normalizeResearchActorKey(value: unknown, sourceUrl = ''): SocialResearchActorKey {
  if (
    value === 'youtube_transcript'
    || value === 'youtube_video'
    || value === 'instagram_post'
    || value === 'instagram_reel'
    || value === 'tiktok_video'
  ) {
    return value
  }
  const url = sourceUrl.toLowerCase()
  if (url.includes('youtu')) return 'youtube_transcript'
  if (url.includes('instagram.com/reel')) return 'instagram_reel'
  if (url.includes('instagram.com')) return 'instagram_post'
  if (url.includes('tiktok.com')) return 'tiktok_video'
  return 'youtube_transcript'
}

export function apifyInputForResearchSource(source: SocialResearchSource, config: SocialResearchActorConfig) {
  const url = source.url
  if (config.key === 'youtube_transcript') {
    return {
      ...config.default_input,
      videoUrls: [url],
      urls: [url],
      url,
    }
  }
  if (config.key === 'youtube_video') {
    return {
      ...config.default_input,
      startUrls: [{ url }],
    }
  }
  if (config.key === 'instagram_post' || config.key === 'instagram_reel') {
    return {
      ...config.default_input,
      directUrls: [url],
      startUrls: [{ url }],
    }
  }
  return {
    ...config.default_input,
    startUrls: [url],
  }
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

export function extractHookTranscript(item: Record<string, unknown>) {
  const transcript = firstString(
    item.hook_transcript,
    item.transcript,
    item.text,
    item.description,
    item.caption,
  )
  return transcript ? truncate(transcript, 500) : null
}

export function extractReusablePattern(input: {
  title?: string | null
  caption?: string | null
  hookTranscript?: string | null
  thumbnailUrl?: string | null
}) {
  const title = input.title ?? ''
  const hook = input.hookTranscript ?? ''
  const caption = input.caption ?? ''
  const titleWords = title.split(/\s+/).filter(Boolean)
  const hookSentence = hook.split(/[.!?]/).map((part) => part.trim()).find(Boolean) ?? hook
  return {
    pain_point: caption || title
      ? truncate(caption || title, 180)
      : 'Needs analyst review.',
    hook_structure: hookSentence
      ? truncate(hookSentence, 180)
      : 'No first-30-second hook transcript available yet.',
    open_loop: hookSentence
      ? 'Review how the opening creates curiosity before the payoff.'
      : 'Needs hook review.',
    frame: 'Translate the creator outline into an AmaduTown operating frame before drafting.',
    tension_or_missed_opportunity: caption || title
      ? truncate(caption || title, 220)
      : 'Needs analyst review.',
    promise_value: titleWords.length >= 4
      ? truncate(titleWords.slice(0, 10).join(' '), 140)
      : 'Needs title/caption review.',
    proof_style: 'Review source for proof pattern only; do not copy claims or creator identity.',
    closing_question: 'Needs human review; adapt the closing question to Vambah voice.',
    title_pattern: title
      ? truncate(title.replace(/[A-Za-z0-9]+/g, '[word]'), 180)
      : 'No title pattern available.',
    thumbnail_pattern: input.thumbnailUrl
      ? 'Thumbnail reference captured; translate layout concept into AmaduTown brand style.'
      : 'No thumbnail reference captured.',
    pacing_visual_framing: 'Needs human pattern review from source evidence.',
    cta_style: 'Needs human pattern review from source evidence.',
    source_use_boundary: 'Reusable framework only. Final content must be rewritten in Vambah voice and AmaduTown brand style.',
  }
}

export function researchPacketDraftFromApifyItem(input: {
  source: SocialResearchSource
  config: SocialResearchActorConfig
  item: Record<string, unknown>
  actorRun: Record<string, unknown>
  retrievedAt: string
}): SocialResearchPacketDraft {
  const item = input.item
  const sourceUrl = firstString(item.url, item.videoUrl, item.inputUrl, item.shortUrl, input.source.url)
  const title = firstString(item.title, item.name)
  const caption = firstString(item.caption, item.description, item.text)
  const hookTranscript = extractHookTranscript(item)
  const thumbnailUrl = firstString(item.thumbnailUrl, item.thumbnail, item.displayUrl, item.imageUrl)
  const metrics = {
    views: numberOrNull(item.views) ?? numberOrNull(item.viewCount) ?? numberOrNull(item.playCount),
    likes: numberOrNull(item.likes) ?? numberOrNull(item.likeCount),
    comments: numberOrNull(item.comments) ?? numberOrNull(item.commentCount),
    shares: numberOrNull(item.shares) ?? numberOrNull(item.shareCount),
    follower_count: numberOrNull(item.followerCount) ?? numberOrNull(item.subscriberCount) ?? numberOrNull(item.followers),
    published_at: firstString(item.publishedAt, item.date, item.timestamp) || null,
    retrieved_at: input.retrievedAt,
  }
  const score = scoreCreatorAsset(socialMetricsFromUnknown(metrics))
  return {
    source_url: sourceUrl,
    platform: input.source.platform ?? input.config.platform,
    creator_name: firstString(item.creatorName, item.channelName, item.ownerFullName, item.authorName) || null,
    creator_handle: firstString(item.creatorHandle, item.channelHandle, item.username, item.authorMeta) || null,
    title: title || null,
    caption: caption || null,
    thumbnail_url: thumbnailUrl || null,
    hook_transcript: hookTranscript,
    metrics,
    actor_metadata: {
      actor_id: input.config.actor_id,
      actor_key: input.config.key,
      actor_label: input.config.label,
      run_id: firstString(input.actorRun.id, input.actorRun.runId) || null,
      dataset_id: firstString(input.actorRun.defaultDatasetId, input.actorRun.datasetId) || null,
      source_label: input.source.label ?? null,
      input_url: input.source.url,
      score_breakdown: score,
    },
    pattern_packet: extractReusablePattern({
      title,
      caption,
      hookTranscript,
      thumbnailUrl,
    }),
    pattern_status: 'needs_brand_translation',
    privacy_notes: 'Public creator research packet. Use patterns only; do not copy source script, title, thumbnail, or visual identity.',
    retrieved_at: input.retrievedAt,
  }
}

export function researchPacketDraftFromRecordedEvidence(input: {
  evidence: SocialResearchEvidenceItem
  retrievedAt: string
  actorLabel?: string | null
}): SocialResearchPacketDraft {
  const evidence = input.evidence
  const metrics = {
    ...(asRecord(evidence.metrics) ?? {}),
    retrieved_at: input.retrievedAt,
  }
  const hookTranscript = evidence.hook_transcript ? truncate(evidence.hook_transcript, 500) : null
  const patternPacket = asRecord(evidence.pattern_packet)
    ?? extractReusablePattern({
      title: evidence.title,
      caption: evidence.caption,
      hookTranscript,
      thumbnailUrl: evidence.thumbnail_url,
    })
  return {
    source_url: evidence.source_url,
    platform: normalizeResearchPlatform(evidence.platform),
    creator_name: evidence.creator_name ?? null,
    creator_handle: evidence.creator_handle ?? null,
    title: evidence.title ?? null,
    caption: evidence.caption ?? null,
    thumbnail_url: evidence.thumbnail_url ?? null,
    hook_transcript: hookTranscript,
    metrics,
    actor_metadata: {
      provider: 'free_recorded_evidence',
      retrieval_method: evidence.retrieval_method ?? 'codex_browser',
      retrieval_notes: evidence.retrieval_notes ?? null,
      actor_label: input.actorLabel ?? null,
      source_url: evidence.source_url,
      cost_usd: 0,
    },
    pattern_packet: patternPacket,
    pattern_status: normalizePatternStatus(evidence.pattern_status),
    privacy_notes: 'Free public research packet. Use patterns only; do not copy source script, title, thumbnail, or visual identity.',
    retrieved_at: input.retrievedAt,
  }
}

function compactResearchPattern(pattern: Record<string, unknown>) {
  const patternPacket = asRecord(pattern.pattern_packet) ?? {}
  return {
    source_url: firstString(pattern.source_url) || null,
    platform: firstString(pattern.platform) || null,
    creator: firstString(pattern.creator_name, pattern.creator_handle) || null,
    pattern_status: firstString(pattern.pattern_status) || null,
    hook_structure: firstString(patternPacket.hook_structure) || null,
    promise_value: firstString(patternPacket.promise_value) || null,
    thumbnail_pattern: firstString(patternPacket.thumbnail_pattern) || null,
    source_use_boundary: firstString(patternPacket.source_use_boundary)
      || 'Use reusable frameworks only; do not copy creator scripts, titles, thumbnails, or visual identity.',
  }
}

function reviewDraftSideEffects(): SocialChannelReviewDraftPacket['side_effects'] {
  return {
    provider_generation: false,
    upload: false,
    publish: false,
    schedule: false,
    external_post: false,
  }
}

export function buildLinkedInYoutubeReviewDrafts(input: {
  insight: Record<string, unknown>
  generatedAt?: string
}): LinkedInYoutubeReviewDrafts {
  const insight = input.insight
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const title = firstString(insight.title, 'Untitled Shaka insight')
  const triggeringEvent = firstString(insight.triggering_event, title)
  const whyVambahCanSpeak = firstString(
    insight.why_vambah_can_speak,
    'Vambah is close enough to the work to explain what changed, what remains bounded, and what still needs review.',
  )
  const evidenceSummary = firstString(insight.evidence_summary, 'Evidence summary pending.')
  const contentAngle = firstString(
    insight.content_angle,
    'AI should reduce burden only when evidence, ownership, and approval gates are visible.',
  )
  const hook = firstString(insight.suggested_hook, contentAngle)
  const claimBoundaries = asStringArray(insight.claim_boundaries)
  const patterns = asRecordArray(insight.approved_research_patterns).map(compactResearchPattern)
  const patternHook = firstString(...patterns.map((pattern) => pattern.hook_structure))
  const patternPromise = firstString(...patterns.map((pattern) => pattern.promise_value))
  const sourceBoundary = 'Drafts are generated for human review only. Public research patterns are framework inputs, not source copy.'
  const sharedSource = {
    insight_title: title,
    triggering_event: triggeringEvent,
    content_angle: contentAngle,
    evidence_summary: evidenceSummary,
  }

  const linkedinPostText = [
    triggeringEvent,
    '',
    contentAngle,
    '',
    `That matters because ${whyVambahCanSpeak}`,
    '',
    evidenceSummary,
    '',
    'The practical test is simple: can the system show what the draft is based on, who touched it, and what still needs review before it reaches the public?',
    '',
    patternPromise ? `The outside pattern I want to adapt: ${patternPromise}` : '',
  ].filter((line) => line !== '').join('\n')

  const youtubeHook = hook.length <= 120 ? hook : truncate(hook, 120)
  const firstThirtySeconds = [
    youtubeHook,
    `I noticed this through ${triggeringEvent.toLowerCase()}.`,
    'The lesson was not that AI can create more content.',
    'The lesson was that trust gets built when every risky output has evidence, ownership, and a visible approval gate.',
  ].join(' ')
  const shortScript = [
    `Opening: ${youtubeHook}`,
    `Trigger: ${triggeringEvent}`,
    `Authority: ${whyVambahCanSpeak}`,
    `Point: ${contentAngle}`,
    `Proof: ${evidenceSummary}`,
    patternHook ? `Pattern to adapt: ${patternHook}` : 'Pattern to adapt: use the approved research packet without copying source language.',
    'Close: AI earns trust when the handoff is visible before the output goes public.',
  ]
  const storyboardScenes = [
    'Face-to-camera hook with the triggering event.',
    'Screen capture of the review gate or backlog surface.',
    'B-roll showing evidence, owner, and approval status.',
    'Closing frame with the principle and AmaduTown branding.',
  ]
  const bRollHints = [
    'Content Intelligence dashboard',
    'Agentic Dashboard Backlog',
    'Social Content approval gates',
  ]
  const onScreenText = [
    'AI output needs receipts.',
    'Every risky action needs a gate.',
    'Trust is an operating layer.',
  ]

  return {
    linkedin: {
      channel: 'linkedin',
      generated_at: generatedAt,
      approval_status: 'in_review',
      shared_source: sharedSource,
      source_insight_title: title,
      source_use_boundary: sourceBoundary,
      fields: {
        post_text: linkedinPostText,
        cta: 'Where have you seen AI create more work because the approval path was never designed?',
        cta_url: null,
        hashtags: ['#AIProduct', '#ProductManagement', '#AmaduTownAdvisory', '#TechForGood'],
        visual_mode: 'carousel_or_framework_illustration_review',
        screenshot_routes: ['/admin/agents/content-intelligence', '/admin/agents/coordination'],
        references: [
          evidenceSummary,
          ...patterns.map((pattern) => pattern.source_url).filter(Boolean),
        ],
        claim_boundaries: claimBoundaries,
      },
      source_research_patterns: patterns,
      side_effects: reviewDraftSideEffects(),
    },
    youtube_shorts: {
      channel: 'youtube_shorts',
      generated_at: generatedAt,
      approval_status: 'in_review',
      shared_source: sharedSource,
      source_insight_title: title,
      source_use_boundary: sourceBoundary,
      fields: {
        hook: youtubeHook,
        first_30_seconds: firstThirtySeconds,
        script: shortScript,
        target_duration_seconds: 45,
        storyboard_scenes: storyboardScenes,
        b_roll_hints: bRollHints,
        on_screen_text: onScreenText,
        caption: contentAngle,
        render_readiness: 'pending_human_approval',
        claim_boundaries: claimBoundaries,
      },
      source_research_patterns: patterns,
      side_effects: reviewDraftSideEffects(),
    },
    instagram_reels: {
      channel: 'instagram_reels',
      generated_at: generatedAt,
      approval_status: 'in_review',
      shared_source: sharedSource,
      source_insight_title: title,
      source_use_boundary: sourceBoundary,
      fields: {
        hook: youtubeHook,
        script: shortScript,
        target_duration_seconds: 45,
        storyboard_scenes: storyboardScenes,
        cover_text: patternPromise ? truncate(patternPromise, 52) : truncate(contentAngle, 52),
        caption: contentAngle,
        hashtags: ['#AIProduct', '#ProductManagement', '#AmaduTownAdvisory', '#TechForGood'],
        b_roll_assets: bRollHints,
        safe_area_notes: [
          'Keep captions and CTA clear of top and bottom app chrome.',
          'Use 9:16 vertical framing with the proof screen centered.',
          'Avoid exposing admin names, client data, private notes, or raw Chronicle material.',
        ],
        export_readiness: 'pending_human_approval',
        claim_boundaries: claimBoundaries,
      },
      source_research_patterns: patterns,
      side_effects: reviewDraftSideEffects(),
    },
    tiktok: {
      channel: 'tiktok',
      generated_at: generatedAt,
      approval_status: 'in_review',
      shared_source: sharedSource,
      source_insight_title: title,
      source_use_boundary: sourceBoundary,
      fields: {
        hook: youtubeHook,
        script: shortScript,
        target_duration_seconds: 45,
        storyboard_scenes: storyboardScenes,
        cover_frame: patternPromise ? truncate(patternPromise, 48) : truncate(contentAngle, 48),
        caption: contentAngle,
        hashtags: ['#AIProduct', '#ProductOps', '#Automation', '#AmaduTown'],
        b_roll_assets: bRollHints,
        audio_rights: 'Use original narration, approved provider voiceover, or platform-safe audio only.',
        safe_area_notes: [
          'Keep text inside central 9:16 safe areas for TikTok controls.',
          'Use a first-frame promise that can stand without sound.',
          'Redact any private admin, client, Chronicle, or meeting-derived detail before export.',
        ],
        export_readiness: 'pending_human_approval',
        claim_boundaries: claimBoundaries,
      },
      source_research_patterns: patterns,
      side_effects: reviewDraftSideEffects(),
    },
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
