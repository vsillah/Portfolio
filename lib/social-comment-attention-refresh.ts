import type {
  YouTubeCommentRefreshInput,
  YouTubeCommentRefreshResult,
} from '@/lib/youtube-comment-ingestion'
import type {
  MetaCommentRefreshInput,
  MetaCommentRefreshResult,
} from '@/lib/meta-comment-ingestion'
import {
  extractXPostId,
  type XCommentRefreshInput,
  type XCommentRefreshResult,
} from '@/lib/x-comment-ingestion'

type SupabaseClientLike = {
  from: (table: string) => any
}

type CommentRefreshPlatform = 'youtube' | 'facebook' | 'instagram' | 'x'
type CommentRefreshResult = YouTubeCommentRefreshResult | MetaCommentRefreshResult | XCommentRefreshResult

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

type CapabilityRow = {
  platform: string
  capability_status: string | null
  supports_comment_ingestion: boolean | null
  gate_notes?: string | null
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
  refreshPublishedMetaComments?: (input: MetaCommentRefreshInput) => Promise<MetaCommentRefreshResult>
  refreshPublishedXComments?: (input: XCommentRefreshInput) => Promise<XCommentRefreshResult>
}

export type SocialCommentAttentionRefreshOutcome = {
  platform: CommentRefreshPlatform
  publishId: string | null
  contentId: string | null
  selectedReason: 'unresolved_activity' | 'recently_published'
  status: CommentRefreshResult['status'] | 'skipped'
  dryRun: boolean
  fetched: number
  upserted: number
  skipped: number
  errorCount: number
  runId: string | null
  providerReadAttempted: boolean
  blockedReason?: string
  errors: CommentRefreshResult['errors']
  skippedReason?: 'cooldown' | 'dry_run' | 'capability_blocked' | 'provider_identity_blocked'
}

type SocialCommentAttentionProviderSummary = {
  ok: boolean
  status: 'succeeded' | 'partial' | 'failed' | 'manual_blocked'
  dryRun: boolean
  selectedCount: number
  attemptedCount: number
  providerReadAttemptCount: number
  skippedCooldownCount: number
  capabilityBlockedCount: number
  identityBlockedCount: number
  succeededCount: number
  partialCount: number
  manualBlockedCount: number
  failedCount: number
  commentLimit: number
  publishLimit: number
  refreshCooldownMinutes: number
  outcomes: SocialCommentAttentionRefreshOutcome[]
}

export type SocialCommentAttentionRefreshSummary = {
  ok: boolean
  status: 'succeeded' | 'partial' | 'failed' | 'manual_blocked'
  dryRun: boolean
  selectedCount: number
  attemptedCount: number
  providerReadAttemptCount: number
  skippedCooldownCount: number
  capabilityBlockedCount: number
  identityBlockedCount: number
  succeededCount: number
  partialCount: number
  manualBlockedCount: number
  failedCount: number
  commentLimit: number
  publishLimit: number
  refreshCooldownMinutes: number
  outcomes: SocialCommentAttentionRefreshOutcome[]
  providerSummaries: Record<CommentRefreshPlatform, SocialCommentAttentionProviderSummary>
}

const DEFAULT_PUBLISH_LIMIT = 3
const DEFAULT_COMMENT_LIMIT = 50
const DEFAULT_RECENT_PUBLISHED_HOURS = 24 * 30
const DEFAULT_REFRESH_COOLDOWN_MINUTES = 15
const MAX_PUBLISH_LIMIT = 10
const MAX_COMMENT_LIMIT = 100
const MAX_CANDIDATE_LIMIT = 100
const MAX_RECENT_PUBLISHED_HOURS = 24 * 90
const META_PROVIDER_POST_ID_PATTERN = /^[A-Za-z0-9_:-]{3,256}$/
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

function hasCanonicalProviderIdentity(row: PublishRow, platform: CommentRefreshPlatform) {
  if (platform === 'youtube') return hasProviderIdentity(row)
  if (platform === 'x') {
    return Boolean(extractXPostId({
      platformPostId: row.platform_post_id,
      platformPostUrl: row.platform_post_url,
    }))
  }
  const providerPostId = row.platform_post_id?.trim()
  return Boolean(providerPostId && META_PROVIDER_POST_ID_PATTERN.test(providerPostId))
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

function classifyStatus(summary: Pick<SocialCommentAttentionProviderSummary, 'succeededCount' | 'partialCount' | 'manualBlockedCount' | 'failedCount' | 'attemptedCount' | 'capabilityBlockedCount' | 'identityBlockedCount'>): SocialCommentAttentionRefreshSummary['status'] {
  if (summary.failedCount > 0) return summary.attemptedCount === summary.failedCount ? 'failed' : 'partial'
  if (summary.partialCount > 0) return 'partial'
  if (summary.manualBlockedCount > 0) return summary.succeededCount > 0 ? 'partial' : 'manual_blocked'
  if ((summary.capabilityBlockedCount > 0 || summary.identityBlockedCount > 0) && summary.attemptedCount === 0) return 'manual_blocked'
  return 'succeeded'
}

async function readPublishedRows(db: SupabaseClientLike, platform: CommentRefreshPlatform, limit: number) {
  const result = await db
    .from('social_content_publishes')
    .select('id, content_id, platform, status, platform_post_id, platform_post_url, published_at, created_at')
    .eq('platform', platform)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(limit)

  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []) as PublishRow[]
}

async function readPublishedRowsByIds(db: SupabaseClientLike, platform: CommentRefreshPlatform, publishIds: string[]) {
  const ids = [...new Set(publishIds)].filter(Boolean)
  if (!ids.length) return []
  const result = await db
    .from('social_content_publishes')
    .select('id, content_id, platform, status, platform_post_id, platform_post_url, published_at, created_at')
    .eq('platform', platform)
    .eq('status', 'published')
    .in('id', ids)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(Math.min(ids.length, MAX_CANDIDATE_LIMIT))

  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []) as PublishRow[]
}

async function readUnresolvedCommentActivity(db: SupabaseClientLike, platform: CommentRefreshPlatform, limit: number) {
  const result = await db
    .from('social_content_comments')
    .select('publish_id, captured_at, updated_at, created_at, classification_status, status, priority, response_approval_state, reply_submission_state')
    .eq('platform', platform)
    .in('classification_status', [...UNRESOLVED_CLASSIFICATION_STATUSES])
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []) as CommentActivityRow[]
}

async function readLatestRuns(db: SupabaseClientLike, platform: CommentRefreshPlatform, publishIds: string[]) {
  if (!publishIds.length) return new Map<string, RunRow>()
  const result = await db
    .from('social_comment_ingestion_runs')
    .select('publish_id, status, started_at, completed_at, created_at')
    .eq('platform', platform)
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

async function readCommentCapability(db: SupabaseClientLike, platform: CommentRefreshPlatform): Promise<CapabilityRow | null> {
  const result = await db
    .from('social_comment_provider_capabilities')
    .select('platform, capability_status, supports_comment_ingestion, gate_notes')
    .eq('platform', platform)
    .limit(1)

  if (result.error) throw new Error(result.error.message)
  return ((result.data ?? []) as CapabilityRow[])[0] ?? null
}

function capabilityAllowsIngestion(capability: CapabilityRow | null) {
  return capability?.capability_status === 'verified' && capability.supports_comment_ingestion === true
}

async function runProviderRefresh(input: {
  db: SupabaseClientLike
  platform: CommentRefreshPlatform
  options: SocialCommentAttentionRefreshOptions
  now: Date
  publishLimit: number
  commentLimit: number
  candidateLimit: number
  unresolvedCommentScanLimit: number
  recentPublishedHours: number
  refreshCooldownMinutes: number
}): Promise<SocialCommentAttentionProviderSummary> {
  const { db, platform, options, now, publishLimit, commentLimit, candidateLimit, unresolvedCommentScanLimit, recentPublishedHours, refreshCooldownMinutes } = input
  const recentCutoffMs = now.getTime() - recentPublishedHours * 60 * 60 * 1000
  const cooldownCutoffMs = now.getTime() - refreshCooldownMinutes * 60 * 1000
  const dryRun = options.dryRun === true
  const force = options.force === true

  const [recentRows, activityRows] = await Promise.all([
    readPublishedRows(db, platform, candidateLimit),
    readUnresolvedCommentActivity(db, platform, unresolvedCommentScanLimit),
  ])
  const unresolvedPublishIds = [...new Set(activityRows.filter(isUnresolvedActivity).map((row) => row.publish_id as string))]
  const unresolvedRows = await readPublishedRowsByIds(db, platform, unresolvedPublishIds)

  const candidatesById = new Map<string, {
    row: PublishRow
    reason: SocialCommentAttentionRefreshOutcome['selectedReason']
    publishedAt: number
    providerIdentityBlocked: boolean
  }>()

  for (const row of recentRows) {
    const publishedAt = timestamp(row.published_at ?? row.created_at)
    if (publishedAt < recentCutoffMs) continue
    const providerIdentityBlocked = !hasCanonicalProviderIdentity(row, platform)
    if (providerIdentityBlocked && platform === 'youtube') continue
    candidatesById.set(row.id, {
      row,
      reason: 'recently_published',
      publishedAt,
      providerIdentityBlocked,
    })
  }

  for (const row of unresolvedRows) {
    const providerIdentityBlocked = !hasCanonicalProviderIdentity(row, platform)
    if (providerIdentityBlocked && platform === 'youtube') continue
    candidatesById.set(row.id, {
      row,
      reason: 'unresolved_activity',
      publishedAt: timestamp(row.published_at ?? row.created_at),
      providerIdentityBlocked,
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
  const outcomes: SocialCommentAttentionRefreshOutcome[] = []
  const refreshableSelected = selected.filter((candidate) => !candidate.providerIdentityBlocked)
  const latestRuns = await readLatestRuns(db, platform, refreshableSelected.map(({ row }) => row.id))
  const capability = platform === 'youtube' || refreshableSelected.length === 0 ? null : await readCommentCapability(db, platform)

  for (const candidate of selected) {
    if (candidate.providerIdentityBlocked) {
      const message = `${platform} published row is missing a canonical provider post or media ID; skipping unattended provider refresh.`
      outcomes.push({
        platform,
        publishId: candidate.row.id,
        contentId: candidate.row.content_id,
        selectedReason: candidate.reason,
        status: 'skipped',
        dryRun,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        errorCount: 1,
        runId: null,
        providerReadAttempted: false,
        blockedReason: message,
        errors: [{
          code: 'provider_identity_blocked',
          message,
        }],
        skippedReason: 'provider_identity_blocked',
      })
      continue
    }

    if (platform !== 'youtube' && !capabilityAllowsIngestion(capability)) {
      const message = `${platform} comment ingestion capability is not verified; skipping unattended provider refresh.`
      outcomes.push({
        platform,
        publishId: candidate.row.id,
        contentId: candidate.row.content_id,
        selectedReason: candidate.reason,
        status: 'skipped',
        dryRun,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        errorCount: 1,
        runId: null,
        providerReadAttempted: false,
        blockedReason: message,
        errors: [{
          code: 'capability_blocked',
          message,
        }],
        skippedReason: 'capability_blocked',
      })
      continue
    }

    const latest = latestRuns.get(candidate.row.id)
    if (!force && latest && latestRunAt(latest) >= cooldownCutoffMs) {
      outcomes.push({
        platform,
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
        providerReadAttempted: false,
        errors: [],
        skippedReason: 'cooldown',
      })
      continue
    }

    if (dryRun) {
      outcomes.push({
        platform,
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
        providerReadAttempted: false,
        errors: [],
        skippedReason: 'dry_run',
      })
      continue
    }

    try {
      const providerReadAttempted = true
      const result = await refreshProviderComments({
        db,
        platform,
        publishId: candidate.row.id,
        contentId: candidate.row.content_id,
        commentLimit,
        options,
      })
      outcomes.push({
        platform,
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
        providerReadAttempted,
        blockedReason: result.blockedReason,
        errors: result.errors,
      })
    } catch (error) {
      outcomes.push({
        platform,
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
        providerReadAttempted: true,
        errors: [{
          code: `${platform}_comment_refresh_failed`,
          message: error instanceof Error ? error.message : `${platform} comment refresh failed`,
        }],
      })
    }
  }

  return summarizeProvider({
    dryRun,
    outcomes,
    commentLimit,
    publishLimit,
    refreshCooldownMinutes,
  })
}

async function runProviderRefreshSafely(input: {
  db: SupabaseClientLike
  platform: CommentRefreshPlatform
  options: SocialCommentAttentionRefreshOptions
  now: Date
  publishLimit: number
  commentLimit: number
  candidateLimit: number
  unresolvedCommentScanLimit: number
  recentPublishedHours: number
  refreshCooldownMinutes: number
}) {
  try {
    return await runProviderRefresh(input)
  } catch {
    const message = `${input.platform} comment attention refresh setup failed.`
    return summarizeProvider({
      dryRun: input.options.dryRun === true,
      outcomes: [{
        platform: input.platform,
        publishId: null,
        contentId: null,
        selectedReason: 'recently_published',
        status: 'failed',
        dryRun: input.options.dryRun === true,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        errorCount: 1,
        runId: null,
        providerReadAttempted: false,
        errors: [{
          code: `${input.platform}_comment_refresh_setup_failed`,
          message,
        }],
      }],
      commentLimit: input.commentLimit,
      publishLimit: input.publishLimit,
      refreshCooldownMinutes: input.refreshCooldownMinutes,
    })
  }
}

async function refreshProviderComments(input: {
  db: SupabaseClientLike
  platform: CommentRefreshPlatform
  publishId: string
  contentId: string
  commentLimit: number
  options: SocialCommentAttentionRefreshOptions
}): Promise<CommentRefreshResult> {
  if (input.platform === 'youtube') {
    const refresh = input.options.refreshPublishedYouTubeComments
    if (!refresh) throw new Error('refreshPublishedYouTubeComments adapter was not provided')
    return refresh({
      db: input.db,
      publishId: input.publishId,
      contentId: input.contentId,
      limit: input.commentLimit,
    })
  }

  if (input.platform === 'x') {
    const refresh = input.options.refreshPublishedXComments
    if (!refresh) throw new Error('refreshPublishedXComments adapter was not provided')
    return refresh({
      db: input.db,
      publishId: input.publishId,
      contentId: input.contentId,
      limit: input.commentLimit,
    })
  }

  const refresh = input.options.refreshPublishedMetaComments
  if (!refresh) throw new Error('refreshPublishedMetaComments adapter was not provided')
  return refresh({
    db: input.db,
    platform: input.platform,
    publishId: input.publishId,
    contentId: input.contentId,
    limit: input.commentLimit,
  })
}

function summarizeProvider(input: {
  dryRun: boolean
  outcomes: SocialCommentAttentionRefreshOutcome[]
  commentLimit: number
  publishLimit: number
  refreshCooldownMinutes: number
}): SocialCommentAttentionProviderSummary {
  const attempted = input.outcomes.filter((outcome) => outcome.status !== 'skipped')
  const summary = {
    succeededCount: attempted.filter((outcome) => outcome.status === 'succeeded').length,
    partialCount: attempted.filter((outcome) => outcome.status === 'partial').length,
    manualBlockedCount: attempted.filter((outcome) => outcome.status === 'manual_blocked').length,
    failedCount: attempted.filter((outcome) => outcome.status === 'failed').length,
    attemptedCount: attempted.length,
    providerReadAttemptCount: input.outcomes.filter((outcome) => outcome.providerReadAttempted).length,
    capabilityBlockedCount: input.outcomes.filter((outcome) => outcome.skippedReason === 'capability_blocked').length,
    identityBlockedCount: input.outcomes.filter((outcome) => outcome.skippedReason === 'provider_identity_blocked').length,
  }
  const status = classifyStatus(summary)

  return {
    ok: status !== 'failed',
    status,
    dryRun: input.dryRun,
    selectedCount: input.outcomes.length,
    attemptedCount: summary.attemptedCount,
    providerReadAttemptCount: summary.providerReadAttemptCount,
    skippedCooldownCount: input.outcomes.filter((outcome) => outcome.skippedReason === 'cooldown').length,
    capabilityBlockedCount: summary.capabilityBlockedCount,
    identityBlockedCount: summary.identityBlockedCount,
    succeededCount: summary.succeededCount,
    partialCount: summary.partialCount,
    manualBlockedCount: summary.manualBlockedCount,
    failedCount: summary.failedCount,
    commentLimit: input.commentLimit,
    publishLimit: input.publishLimit,
    refreshCooldownMinutes: input.refreshCooldownMinutes,
    outcomes: input.outcomes,
  }
}

function aggregateProviderSummaries(input: {
  dryRun: boolean
  providerSummaries: Record<CommentRefreshPlatform, SocialCommentAttentionProviderSummary>
  commentLimit: number
  publishLimit: number
  refreshCooldownMinutes: number
}): SocialCommentAttentionRefreshSummary {
  const summaries = Object.values(input.providerSummaries)
  const outcomes = summaries.flatMap((summary) => summary.outcomes)
  const summary = {
    succeededCount: summaries.reduce((sum, item) => sum + item.succeededCount, 0),
    partialCount: summaries.reduce((sum, item) => sum + item.partialCount, 0),
    manualBlockedCount: summaries.reduce((sum, item) => sum + item.manualBlockedCount, 0),
    failedCount: summaries.reduce((sum, item) => sum + item.failedCount, 0),
    attemptedCount: summaries.reduce((sum, item) => sum + item.attemptedCount, 0),
    providerReadAttemptCount: summaries.reduce((sum, item) => sum + item.providerReadAttemptCount, 0),
    capabilityBlockedCount: summaries.reduce((sum, item) => sum + item.capabilityBlockedCount, 0),
    identityBlockedCount: summaries.reduce((sum, item) => sum + item.identityBlockedCount, 0),
  }
  const status = classifyStatus(summary)

  return {
    ok: status !== 'failed',
    status,
    dryRun: input.dryRun,
    selectedCount: summaries.reduce((sum, item) => sum + item.selectedCount, 0),
    attemptedCount: summary.attemptedCount,
    providerReadAttemptCount: summary.providerReadAttemptCount,
    skippedCooldownCount: summaries.reduce((sum, item) => sum + item.skippedCooldownCount, 0),
    capabilityBlockedCount: summary.capabilityBlockedCount,
    identityBlockedCount: summary.identityBlockedCount,
    succeededCount: summary.succeededCount,
    partialCount: summary.partialCount,
    manualBlockedCount: summary.manualBlockedCount,
    failedCount: summary.failedCount,
    commentLimit: input.commentLimit,
    publishLimit: input.publishLimit,
    refreshCooldownMinutes: input.refreshCooldownMinutes,
    outcomes,
    providerSummaries: input.providerSummaries,
  }
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
  const dryRun = options.dryRun === true

  const shared = {
    db,
    options,
    now,
    publishLimit,
    commentLimit,
    candidateLimit,
    unresolvedCommentScanLimit,
    recentPublishedHours,
    refreshCooldownMinutes,
  }
  const [youtube, facebook, instagram, x] = await Promise.all([
    runProviderRefreshSafely({ ...shared, platform: 'youtube' }),
    runProviderRefreshSafely({ ...shared, platform: 'facebook' }),
    runProviderRefreshSafely({ ...shared, platform: 'instagram' }),
    runProviderRefreshSafely({ ...shared, platform: 'x' }),
  ])

  return aggregateProviderSummaries({
    dryRun,
    providerSummaries: { youtube, facebook, instagram, x },
    commentLimit,
    publishLimit,
    refreshCooldownMinutes,
  })
}
