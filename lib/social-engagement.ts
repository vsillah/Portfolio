import type { SocialPlatform } from './social-content'

export type EngagementSource = 'apify' | 'linkedin_organization' | 'manual_fixture'

export type NormalizedEngagementMetrics = {
  platform: SocialPlatform
  contentUrl: string | null
  platformPostId: string | null
  capturedAt: string
  impressions: number | null
  views: number | null
  reactions: number
  likes: number
  comments: number
  shares: number
  reposts: number
  engagementRate: number | null
  notableCommenters: string[]
  source: {
    provider: EngagementSource
    actorId: string | null
    runId: string | null
    datasetId: string | null
    confidence: 'exact' | 'matched' | 'low'
  }
  raw: Record<string, unknown>
}

export type EngagementRecommendation = 'promote' | 'expand' | 'format_bakeoff' | 'hold' | 'retire'

export type EngagementScore = {
  score: number
  recommendation: EngagementRecommendation
  rationale: string
}

export type HighSignalInsight = {
  contentId: string
  title: string
  theme: string
  score: number
  recommendation: EngagementRecommendation
  recommendationLabel: string
  ownerAgentKey: string
  bestContentHref: string
  bestContentUrl: string | null
  sourcePrdHref: string | null
  capturedAt: string
  metrics: Pick<NormalizedEngagementMetrics, 'impressions' | 'views' | 'reactions' | 'likes' | 'comments' | 'shares' | 'reposts' | 'engagementRate'>
}

export type EngagementSignalRow = {
  id: string
  post_text: string | null
  topic_extracted: Record<string, unknown> | null
  rag_context: Record<string, unknown> | null
}

export const LINKEDIN_PROFILE_POSTS_ACTOR = 'harvestapi/linkedin-profile-posts'
export const LINKEDIN_PROFILE_POSTS_ACTOR_ID = 'harvestapi~linkedin-profile-posts'

const AGENTIC_CONTENT_PRD_BASE = '/docs/agentic-content-research-prds/'

const PRD_THEME_RULES: Array<{ pattern: RegExp; theme: string; href: string }> = [
  { pattern: /slack|mobile|traceability|notification/i, theme: 'Mission Control and Slack Traceability', href: `${AGENTIC_CONTENT_PRD_BASE}09-mission-control-and-slack-traceability.md` },
  { pattern: /operating system|agent ops|mission control|control plane/i, theme: 'Agentic Operating System', href: `${AGENTIC_CONTENT_PRD_BASE}01-agentic-operating-system-overview.md` },
  { pattern: /trace|harness|audit|observability|evidence/i, theme: 'Harness and Trace Foundation', href: `${AGENTIC_CONTENT_PRD_BASE}02-harness-and-trace-foundation.md` },
  { pattern: /shaka|controller|chief of staff|orchestrat/i, theme: 'Shaka Controller Brain', href: `${AGENTIC_CONTENT_PRD_BASE}03-shaka-controller-brain.md` },
  { pattern: /open brain|memory|rag|knowledge/i, theme: 'Open Brain Memory Architecture', href: `${AGENTIC_CONTENT_PRD_BASE}04-open-brain-memory-architecture.md` },
  { pattern: /evaluation|quality|rubric|feedback loop|self[- ]?eval/i, theme: 'Self-Evaluation and Quality Loops', href: `${AGENTIC_CONTENT_PRD_BASE}05-self-evaluation-and-quality-loops.md` },
  { pattern: /swarm|delegation|agent roster|kanban|handoff/i, theme: 'Agent Swarms and Delegation', href: `${AGENTIC_CONTENT_PRD_BASE}06-agent-swarms-and-delegation.md` },
  { pattern: /permission|risk boundary|approval gate|governance/i, theme: 'Permission Scopes and Risk Boundaries', href: `${AGENTIC_CONTENT_PRD_BASE}07-permission-scopes-and-risk-boundaries.md` },
  { pattern: /human[- ]?in[- ]?the[- ]?loop|approval|reject|approve/i, theme: 'Human-In-The-Loop Approvals', href: `${AGENTIC_CONTENT_PRD_BASE}08-human-in-the-loop-approvals.md` },
  { pattern: /cost|spend|payment|budget/i, theme: 'Cost, Spend, and Payment Authority', href: `${AGENTIC_CONTENT_PRD_BASE}10-cost-spend-and-payment-authority.md` },
  { pattern: /client-safe|export|audit export/i, theme: 'Client-Safe Audit Export', href: `${AGENTIC_CONTENT_PRD_BASE}11-client-safe-audit-export.md` },
  { pattern: /message|synthesis|voice|content/i, theme: 'Messaging Synthesis', href: `${AGENTIC_CONTENT_PRD_BASE}12-messaging-synthesis.md` },
]

function numberFrom(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const compact = value.trim().toLowerCase().replace(/,/g, '')
    const multiplier = compact.endsWith('k') ? 1000 : compact.endsWith('m') ? 1000000 : 1
    const numeric = Number(compact.replace(/[km]$/, ''))
    return Number.isFinite(numeric) ? numeric * multiplier : null
  }
  return null
}

function firstNumber(row: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = numberFrom(row[key])
    if (value !== null) return value
  }
  return fallback
}

function firstString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return value.trim().replace(/\/$/, '')
  }
}

export function normalizeEngagementRow(input: {
  platform: SocialPlatform
  row: Record<string, unknown>
  contentUrl?: string | null
  platformPostId?: string | null
  actorId?: string | null
  runId?: string | null
  datasetId?: string | null
  capturedAt?: string
  confidence?: NormalizedEngagementMetrics['source']['confidence']
}): NormalizedEngagementMetrics {
  const row = input.row
  const reactions = firstNumber(row, ['reactions', 'reactionCount', 'numReactions', 'likesCount', 'likeCount', 'likes'])
  const likes = firstNumber(row, ['likes', 'likesCount', 'likeCount'], reactions)
  const comments = firstNumber(row, ['comments', 'commentCount', 'numComments', 'commentsCount'])
  const shares = firstNumber(row, ['shares', 'shareCount', 'numShares', 'sharesCount'])
  const reposts = firstNumber(row, ['reposts', 'repostCount', 'numReposts'], shares)
  const impressions = numberFrom(row.impressions ?? row.impressionCount ?? row.totalImpressions)
  const views = numberFrom(row.views ?? row.viewCount ?? row.videoViews ?? row.numViews)
  const denominator = impressions ?? views
  const engagementRate = denominator && denominator > 0
    ? Number(((reactions + comments + shares + reposts) / denominator).toFixed(4))
    : numberFrom(row.engagementRate ?? row.engagement_rate)

  const commenters = Array.isArray(row.comments)
    ? row.comments
        .map((comment) => comment && typeof comment === 'object' ? firstString(comment as Record<string, unknown>, ['author', 'authorName', 'name', 'profileName']) : null)
        .filter((value): value is string => Boolean(value))
    : []

  return {
    platform: input.platform,
    contentUrl: normalizeUrl(input.contentUrl ?? firstString(row, ['url', 'postUrl', 'post_url', 'shareUrl', 'link'])),
    platformPostId: input.platformPostId ?? firstString(row, ['id', 'postId', 'urn', 'activityUrn', 'shareUrn']),
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    impressions,
    views,
    reactions,
    likes,
    comments,
    shares,
    reposts,
    engagementRate,
    notableCommenters: [...new Set(commenters)].slice(0, 5),
    source: {
      provider: 'apify',
      actorId: input.actorId ?? null,
      runId: input.runId ?? null,
      datasetId: input.datasetId ?? null,
      confidence: input.confidence ?? 'matched',
    },
    raw: row,
  }
}

export function scoreEngagement(metrics: NormalizedEngagementMetrics, capturedAt = metrics.capturedAt): EngagementScore {
  const impressionsOrViews = metrics.impressions ?? metrics.views ?? 0
  const interactionScore =
    metrics.comments * 12 +
    (metrics.shares + metrics.reposts) * 10 +
    metrics.reactions * 3 +
    metrics.likes * 2 +
    Math.log10(Math.max(impressionsOrViews, 0) + 1) * 4

  const qualifiedMultiplier = metrics.notableCommenters.length > 0 || metrics.comments >= 3 ? 1.25 : 1
  const daysOld = Math.max(0, (Date.now() - new Date(capturedAt).getTime()) / 86400000)
  const decay = daysOld > 30 ? 0.8 : daysOld > 14 ? 0.9 : 1
  const score = Number((interactionScore * qualifiedMultiplier * decay).toFixed(1))

  if (score >= 80 || metrics.comments >= 8 || metrics.shares + metrics.reposts >= 5) {
    return { score, recommendation: 'promote', rationale: 'High-quality interaction signal. Prioritize the related backlog theme.' }
  }
  if ((metrics.views ?? metrics.impressions ?? 0) >= 1000 && metrics.comments + metrics.shares + metrics.reposts < 2) {
    return { score, recommendation: 'format_bakeoff', rationale: 'Reach is present but interaction is weak. Test format changes before expanding the theme.' }
  }
  if (score >= 45 || metrics.comments >= 3) {
    return { score, recommendation: 'expand', rationale: 'Meaningful comments or shares suggest an adjacent research prompt is worth drafting.' }
  }
  if (score <= 4 && daysOld > 14) {
    return { score, recommendation: 'retire', rationale: 'Repeated low signal after aging. Deprioritize unless the theme is strategically required.' }
  }
  return { score, recommendation: 'hold', rationale: 'Signal is not decisive yet. Keep watching before creating more work.' }
}

export function mapBacklogTheme(input: {
  postText?: string | null
  topic?: string | null
  ragContext?: Record<string, unknown> | null
}): { theme: string; href: string | null } {
  const explicitRefs = Array.isArray(input.ragContext?.backlog_refs)
    ? input.ragContext?.backlog_refs.filter((item): item is string => typeof item === 'string')
    : []
  if (explicitRefs.length) {
    return { theme: explicitRefs[0].replace(/[-_]/g, ' '), href: null }
  }

  const haystack = [input.topic, input.postText, input.ragContext?.goal_title, input.ragContext?.content_packet_id]
    .filter((value): value is string => typeof value === 'string')
    .join('\n')

  for (const rule of PRD_THEME_RULES) {
    if (rule.pattern.test(haystack)) return { theme: rule.theme, href: rule.href }
  }
  return { theme: 'Messaging Synthesis', href: `${AGENTIC_CONTENT_PRD_BASE}12-messaging-synthesis.md` }
}

export function recommendationLabel(recommendation: EngagementRecommendation) {
  switch (recommendation) {
    case 'promote':
      return 'Promote backlog priority'
    case 'expand':
      return 'Draft adjacent AutoResearch'
    case 'format_bakeoff':
      return 'Run format bakeoff'
    case 'retire':
      return 'Deprioritize theme'
    case 'hold':
    default:
      return 'Keep watching'
  }
}

export function latestEngagementFromRagContext(ragContext: Record<string, unknown> | null | undefined): NormalizedEngagementMetrics | null {
  const engagement = ragContext?.engagement
  if (!engagement || typeof engagement !== 'object' || Array.isArray(engagement)) return null
  const latest = (engagement as Record<string, unknown>).latest
  if (!latest || typeof latest !== 'object' || Array.isArray(latest)) return null
  return latest as NormalizedEngagementMetrics
}

export function buildHighSignalInsight(input: {
  contentId: string
  postText: string | null
  topic: string | null
  ragContext: Record<string, unknown> | null
  metrics: NormalizedEngagementMetrics
}): HighSignalInsight {
  const score = scoreEngagement(input.metrics)
  const mapped = mapBacklogTheme({
    postText: input.postText,
    topic: input.topic,
    ragContext: input.ragContext,
  })

  return {
    contentId: input.contentId,
    title: input.topic || input.postText?.slice(0, 90) || 'Published AI insight',
    theme: mapped.theme,
    score: score.score,
    recommendation: score.recommendation,
    recommendationLabel: recommendationLabel(score.recommendation),
    ownerAgentKey: score.recommendation === 'format_bakeoff' ? 'voice-content-architect' : 'research-source-register',
    bestContentHref: `/admin/social-content/${input.contentId}`,
    bestContentUrl: input.metrics.contentUrl,
    sourcePrdHref: mapped.href,
    capturedAt: input.metrics.capturedAt,
    metrics: {
      impressions: input.metrics.impressions,
      views: input.metrics.views,
      reactions: input.metrics.reactions,
      likes: input.metrics.likes,
      comments: input.metrics.comments,
      shares: input.metrics.shares,
      reposts: input.metrics.reposts,
      engagementRate: input.metrics.engagementRate,
    },
  }
}

export function buildHighSignalInsightsFromRows(rows: EngagementSignalRow[], limit = 3): HighSignalInsight[] {
  return rows
    .map((row) => {
      const metrics = latestEngagementFromRagContext(row.rag_context)
      if (!metrics) return null
      const topic = typeof row.topic_extracted?.topic === 'string' ? row.topic_extracted.topic : null
      return buildHighSignalInsight({
        contentId: row.id,
        postText: row.post_text,
        topic,
        ragContext: row.rag_context,
        metrics,
      })
    })
    .filter((item): item is HighSignalInsight => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function mergeEngagementIntoRagContext(input: {
  ragContext: Record<string, unknown> | null
  metrics: NormalizedEngagementMetrics
  score: EngagementScore
  theme: string
  sourcePrdHref: string | null
}) {
  const existing = input.ragContext ?? {}
  const existingEngagement = existing.engagement && typeof existing.engagement === 'object' && !Array.isArray(existing.engagement)
    ? existing.engagement as Record<string, unknown>
    : {}
  const snapshots = Array.isArray(existingEngagement.snapshots) ? existingEngagement.snapshots : []

  return {
    ...existing,
    engagement: {
      ...existingEngagement,
      latest: input.metrics,
      latest_score: input.score.score,
      recommendation: input.score.recommendation,
      recommendation_label: recommendationLabel(input.score.recommendation),
      recommendation_rationale: input.score.rationale,
      mapped_theme: input.theme,
      source_prd_href: input.sourcePrdHref,
      updated_at: input.metrics.capturedAt,
      snapshots: [input.metrics, ...snapshots].slice(0, 10),
      manual_entry_required: false,
    },
  }
}
