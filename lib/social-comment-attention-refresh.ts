import type {
  YouTubeCommentRefreshInput,
  YouTubeCommentRefreshResult,
} from '@/lib/youtube-comment-ingestion'

type SupabaseClientLike = {
  from: (table: string) => any
}

type PublishRow = {
  id: string
  content_id: string
  platform: string
  status: string
  platform_post_id: string | null
  platform_post_url: string | null
  published_at: string | null
  created_at?: string | null
}

type CommentActivityRow = {
  publish_id: string | null
  captured_at?: string | null
  updated_at?: string | null
  created_at?: string | null
  classification_status?: string | null
  status?: string | null
  priority?: string | null
  response_approval_state?: string | null
  reply_submission_state?: string | null
}

type RunRow = {
  publish_id: string | null
  status: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at?: string | null
}

export type SocialCommentAttentionRefreshOptions = {
  publishLimit?: number
  commentLimit?: number
  candidateLimit?: number
  unresolvedCommentScanLimit?: number
  recentPublishedHours?: number
  refreshCooldownMinutes?: number
  force?: boolean
  dryRun?: boolean
  now?: () => Date
  refreshPublishedYouTubeComments?: (input: YouTubeCommentRefreshInput) => Promise<YouTubeCommentRefreshResult>
}

export type SocialCommentAttentionRefreshOutcome = {
  publishId: string
  contentId: string
  selectedReason: 'unresolved_activity' | 'recently_published'
  status: YouTubeCommentRefreshResult['status'] | 'skipped'
  dryRun: boolean
  fetched: number
  upserted: number
  skipped: number
  errorCount: number
  runId: string | null
  blockedReason?: string
  errors: YouTubeCommentRefreshResult['errors']
  skippedReason?: 'cooldown' | 'dry_run'
}

export type SocialCommentAttentionRefreshSummary = {
  ok: boolean
  status: 'succeeded' | 'partial' | 'failed' | 'manual_blocked'
  dryRun: boolean
  selectedCount: number
  attemptedCount: number
  skippedCooldownCount: number
  succeededCount: number
  partialCount: number
  manualBlockedCount: number
  failedCount: number
  commentLimit: number
  publishLimit: number
  refreshCooldownMinutes: number
  outcomes: SocialCommentAttentionRefreshOutcome[]
}

const DEFAULT_PUBLISH_LIMIT = 3
const DEFAULT_COMMENT_LIMIT = 50
const DEFAULT_RECENT_PUBLISHED_HOURS = 24 * 30
const DEFAULT_REFRESH_COOLDOWN_MINUTES = 15
const MAX_PUBLISH_LIMIT = 10
const MAX_COMMENT_LIMIT = 100
const MAX_CANDIDATE_LIMIT = 100
const MAX_RECENT_PUBLISHED_HOURS = 24 * 90
const UNRESOLVED_CLASSIFICATION_STATUSES = new Set(['unreviewed', 'needs_response', 'blocked'])
const ACTIVE_VISIBILITY_STATUSES = new Set(['visible', 'held_for_review', 'blocked', 'unknown'])

function boundedInt(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.floor(value as number), min), max)
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function hasProviderIdentity(row: PublishRow) {
  return Boolean(row.platform_post_id?.trim() || row.platform_post_url?.trim())
}

function isUnresolvedActivity(row: CommentActivityRow) {
  const classification = typeof row.classification_status === 'string' ? row.classification_status : ''
  const visibility = typeof row.status === 'string' ? row.status : ''
  return Boolean(
    row.publish_id
    && UNRESOLVED_CLASSIFICATION_STATUSES.has(classification)
    && (!visibility || ACTIVE_VISIBILITY_STATUSES.has(visibility)),
  )
}

function latestRunAt(row: RunRow) {
  return Math.max(timestamp(row.completed_at), timestamp(row.started_at), timestamp(row.created_at))
}

function classifyStatus(summary: Pick<SocialCommentAttentionRefreshSummary, 'succeededCount' | 'partialCount' | 'manualBlockedCount' | 'failedCount' | 'attemptedCount'>): SocialCommentAttentionRefreshSummary['status'] {
  if (summary.failedCount > 0) return summary.attemptedCount === summary.failedCount ? 'failed' : 'partial'
  if (summary.partialCount > 0) return 'partial'
  if (summary.manualBlockedCount > 0) return summary.succeededCount > 0 ? 'partial' : 'manual_blocked'
  return 'succeeded'
}

async function readPublishedYouTubeRows(db: SupabaseClientLike, limit: number) {
  const result = await db
    .from('social_content_publishes')
    .select('id, content_id, platform, status, platform_post_id, platform_post_url, published_at, created_at')
    .eq('platform', 'youtube')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(limit)

  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []) as PublishRow[]
}

async function readPublishedYouTubeRowsByIds(db: SupabaseClientLike, publishIds: string[]) {
  const ids = [...new Set(publishIds)].filter(Boolean)
  if (!ids.length) return []
  const result = await db
    .from('social_content_publishes')
    .select('id, content_id, platform, status, platform_post_id, platform_post_url, published_at, created_at')
    .eq('platform', 'youtube')
    .eq('status', 'published')
    .in('id', ids)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(Math.min(ids.length, MAX_CANDIDATE_LIMIT))

  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []) as PublishRow[]
}

async function readUnresolvedCommentActivity(db: SupabaseClientLike, limit: number) {
  const result = await db
    .from('social_content_comments')
    .select('publish_id, captured_at, updated_at, created_at, classification_status, status, priority, response_approval_state, reply_submission_state')
    .eq('platform', 'youtube')
    .in('classification_status', [...UNRESOLVED_CLASSIFICATION_STATUSES])
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []) as CommentActivityRow[]
}

async function readLatestRuns(db: SupabaseClientLike, publishIds: string[]) {
  if (!publishIds.length) return new Map<string, RunRow>()
  const result = await db
    .from('social_comment_ingestion_runs')
    .select('publish_id, status, started_at, completed_at, created_at')
    .eq('platform', 'youtube')
    .in('publish_id', publishIds)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(publishIds.length * 3, MAX_CANDIDATE_LIMIT))

  if (result.error) throw new Error(result.error.message)
  const latest = new Map<string, RunRow>()
  for (const row of (result.data ?? []) as RunRow[]) {
    if (!row.publish_id) continue
    const current = latest.get(row.publish_id)
    if (!current || latestRunAt(row) > latestRunAt(current)) {
      latest.set(row.publish_id, row)
    }
  }
  return latest
}

export async function runSocialCommentAttentionYouTubeRefresh(
  db: SupabaseClientLike,
  options: SocialCommentAttentionRefreshOptions = {},
): Promise<SocialCommentAttentionRefreshSummary> {
  const now = options.now?.() ?? new Date()
  const publishLimit = boundedInt(options.publishLimit, DEFAULT_PUBLISH_LIMIT, 1, MAX_PUBLISH_LIMIT)
  const commentLimit = boundedInt(options.commentLimit, DEFAULT_COMMENT_LIMIT, 1, MAX_COMMENT_LIMIT)
  const candidateLimit = boundedInt(
    options.candidateLimit,
    Math.min(Math.max(publishLimit * 4, publishLimit), MAX_CANDIDATE_LIMIT),
    publishLimit,
    MAX_CANDIDATE_LIMIT,
  )
  const unresolvedCommentScanLimit = boundedInt(options.unresolvedCommentScanLimit, 200, publishLimit, 500)
  const recentPublishedHours = boundedInt(options.recentPublishedHours, DEFAULT_RECENT_PUBLISHED_HOURS, 1, MAX_RECENT_PUBLISHED_HOURS)
  const refreshCooldownMinutes = boundedInt(options.refreshCooldownMinutes, DEFAULT_REFRESH_COOLDOWN_MINUTES, 1, 24 * 60)
  const recentCutoffMs = now.getTime() - recentPublishedHours * 60 * 60 * 1000
  const cooldownCutoffMs = now.getTime() - refreshCooldownMinutes * 60 * 1000
  const dryRun = options.dryRun === true
  const force = options.force === true

  const [recentRows, activityRows] = await Promise.all([
    readPublishedYouTubeRows(db, candidateLimit),
    readUnresolvedCommentActivity(db, unresolvedCommentScanLimit),
  ])
  const unresolvedPublishIds = [...new Set(activityRows.filter(isUnresolvedActivity).map((row) => row.publish_id as string))]
  const unresolvedRows = await readPublishedYouTubeRowsByIds(db, unresolvedPublishIds)

  const candidatesById = new Map<string, {
    row: PublishRow
    reason: SocialCommentAttentionRefreshOutcome['selectedReason']
    publishedAt: number
  }>()

  for (const row of recentRows) {
    const publishedAt = timestamp(row.published_at ?? row.created_at)
    if (!hasProviderIdentity(row) || publishedAt < recentCutoffMs) continue
    candidatesById.set(row.id, {
      row,
      reason: 'recently_published',
      publishedAt,
    })
  }

  for (const row of unresolvedRows) {
    if (!hasProviderIdentity(row)) continue
    candidatesById.set(row.id, {
      row,
      reason: 'unresolved_activity',
      publishedAt: timestamp(row.published_at ?? row.created_at),
    })
  }

  const candidates = [...candidatesById.values()]

  candidates.sort((a, b) => {
    const reasonDelta = Number(b.reason === 'unresolved_activity') - Number(a.reason === 'unresolved_activity')
    if (reasonDelta) return reasonDelta
    if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt
    return a.row.id.localeCompare(b.row.id)
  })

  const selected = candidates.slice(0, publishLimit)
  const latestRuns = await readLatestRuns(db, selected.map(({ row }) => row.id))
  const outcomes: SocialCommentAttentionRefreshOutcome[] = []

  for (const candidate of selected) {
    const latest = latestRuns.get(candidate.row.id)
    if (!force && latest && latestRunAt(latest) >= cooldownCutoffMs) {
      outcomes.push({
        publishId: candidate.row.id,
        contentId: candidate.row.content_id,
        selectedReason: candidate.reason,
        status: 'skipped',
        dryRun,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        errorCount: 0,
        runId: null,
        errors: [],
        skippedReason: 'cooldown',
      })
      continue
    }

    if (dryRun) {
      outcomes.push({
        publishId: candidate.row.id,
        contentId: candidate.row.content_id,
        selectedReason: candidate.reason,
        status: 'skipped',
        dryRun: true,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        errorCount: 0,
        runId: null,
        errors: [],
        skippedReason: 'dry_run',
      })
      continue
    }

    try {
      const refresh = options.refreshPublishedYouTubeComments
      if (!refresh) throw new Error('refreshPublishedYouTubeComments adapter was not provided')
      const result = await refresh({
        db,
        publishId: candidate.row.id,
        contentId: candidate.row.content_id,
        limit: commentLimit,
      })
      outcomes.push({
        publishId: candidate.row.id,
        contentId: candidate.row.content_id,
        selectedReason: candidate.reason,
        status: result.status,
        dryRun: false,
        fetched: result.fetched,
        upserted: result.upserted,
        skipped: result.skipped,
        errorCount: result.errors.length,
        runId: result.runId,
        blockedReason: result.blockedReason,
        errors: result.errors,
      })
    } catch (error) {
      outcomes.push({
        publishId: candidate.row.id,
        contentId: candidate.row.content_id,
        selectedReason: candidate.reason,
        status: 'failed',
        dryRun: false,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        errorCount: 1,
        runId: null,
        errors: [{
          code: 'youtube_comment_refresh_failed',
          message: error instanceof Error ? error.message : 'YouTube comment refresh failed',
        }],
      })
    }
  }

  const attempted = outcomes.filter((outcome) => outcome.status !== 'skipped')
  const summary = {
    succeededCount: attempted.filter((outcome) => outcome.status === 'succeeded').length,
    partialCount: attempted.filter((outcome) => outcome.status === 'partial').length,
    manualBlockedCount: attempted.filter((outcome) => outcome.status === 'manual_blocked').length,
    failedCount: attempted.filter((outcome) => outcome.status === 'failed').length,
    attemptedCount: attempted.length,
  }
  const status = classifyStatus(summary)

  return {
    ok: status !== 'failed',
    status,
    dryRun,
    selectedCount: selected.length,
    attemptedCount: summary.attemptedCount,
    skippedCooldownCount: outcomes.filter((outcome) => outcome.skippedReason === 'cooldown').length,
    succeededCount: summary.succeededCount,
    partialCount: summary.partialCount,
    manualBlockedCount: summary.manualBlockedCount,
    failedCount: summary.failedCount,
    commentLimit,
    publishLimit,
    refreshCooldownMinutes,
    outcomes,
  }
}
