import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import type { SocialPlatform } from '@/lib/social-content'
import {
  filterSocialCommentInboxItems,
  getSocialCommentInboxItems,
  summarizeSocialCommentInbox,
  type SocialCommentPostProjection,
  type SocialCommentStatus,
} from '@/lib/social-comment-inbox-ui'
import {
  buildSocialCommentAlertReliabilityStatus,
  needsCommentAttention,
  type SocialCommentAlertReliabilityStatus,
  type SocialCommentAttentionRow,
} from '@/lib/social-comment-attention'
import {
  explicitEngagementInboxQaFixtureEnabled,
  getEngagementInboxQaFixturePayload,
  isEngagementInboxQaFixtureListRequest,
} from '@/lib/social-comment-engagement-qa-fixture'

export const dynamic = 'force-dynamic'

const COMMENT_SELECT = [
  'id',
  'content_id',
  'platform',
  'provider',
  'provider_comment_id',
  'author_display_name',
  'author_public_handle',
  'body',
  'comment_url',
  'classification_status',
  'classification_reason',
  'priority',
  'response_approval_state',
  'reply_submission_state',
  'proposed_reply_text',
  'approved_reply_text',
  'reply_provider_comment_id',
  'reply_submitted_at',
  'provider_capability',
  'captured_at',
  'updated_at',
  'metadata',
].join(', ')

const POST_SELECT = 'id, platform, post_text, cta_text, youtube_title, rag_context'
const COMMENT_INBOX_UNAVAILABLE_MESSAGE = 'Comment inbox storage is not available in this environment.'
const COMMENT_INBOX_UNAVAILABLE_RECOVERY = 'Apply migration 20260806163011 to the bound Supabase project before validating populated comment inbox rows. Do not submit external replies from this UI lane.'
const PLATFORM_VALUES = new Set<SocialPlatform>(['linkedin', 'instagram', 'facebook', 'youtube', 'tiktok', 'x'])
const STATUS_VALUES = new Set<SocialCommentStatus>([
  'new',
  'needs_qa',
  'auto_send_pending',
  'lead',
  'escalated',
  'responded',
  'ignored',
])

function socialPlatform(value: string | null): SocialPlatform | 'all' {
  return value && PLATFORM_VALUES.has(value as SocialPlatform) ? value as SocialPlatform : 'all'
}

function socialCommentStatus(value: string | null): SocialCommentStatus | 'all' {
  const normalized = value?.replace(/-/g, '_')
  return normalized && STATUS_VALUES.has(normalized as SocialCommentStatus) ? normalized as SocialCommentStatus : 'all'
}

function isCommentInboxStorageUnavailable(error: unknown) {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const code = typeof record.code === 'string' ? record.code : ''
  const text = [record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()

  return code === '42P01'
    || code === 'PGRST205'
    || text.includes('social_content_comments')
    || text.includes('relation') && text.includes('does not exist')
}

function socialCommentSlackAttentionEnabled() {
  return process.env.SOCIAL_COMMENT_SLACK_ATTENTION_ENABLED === 'true'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function boolValue(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null
}

function lastRunOutcome(row: Record<string, unknown>): NonNullable<SocialCommentAlertReliabilityStatus['lastRun']>['outcome'] {
  const outcome = asRecord(row.outcome)
  const metadata = asRecord(row.metadata)
  if (boolValue(outcome?.sent) === true) return 'sent'
  if (boolValue(outcome?.deduped) === true || stringValue(outcome?.reason)?.toLowerCase().includes('already prepared')) return 'deduped'
  if (boolValue(outcome?.skipped) === true) return 'skipped'
  if (String(row.status ?? '').toLowerCase() === 'failed' || Boolean(outcome?.error) || Boolean(metadata?.error)) return 'errored'
  return 'unknown'
}

function lastRunItemCount(row: Record<string, unknown>) {
  const outcome = asRecord(row.outcome)
  const metadata = asRecord(row.metadata)
  return numberValue(outcome?.item_count)
    ?? numberValue(outcome?.itemCount)
    ?? numberValue(metadata?.item_count)
    ?? numberValue(metadata?.itemCount)
    ?? 0
}

function alertReliabilityCountsFromLastRun(lastRun: SocialCommentAlertReliabilityStatus['lastRun']) {
  if (!lastRun) {
    return { sentCount: 0, dedupedCount: 0, skippedCount: 0, errorCount: 0 }
  }

  return {
    sentCount: lastRun.outcome === 'sent' ? 1 : 0,
    dedupedCount: lastRun.outcome === 'deduped' ? 1 : 0,
    skippedCount: lastRun.outcome === 'skipped' ? 1 : 0,
    errorCount: lastRun.outcome === 'errored' ? 1 : 0,
  }
}

async function fetchLastSocialCommentAlertRun(): Promise<SocialCommentAlertReliabilityStatus['lastRun']> {
  if (!supabaseAdmin) return null

  try {
    const { data, error } = await supabaseAdmin
      .from('agent_runs')
      .select('id, status, current_step, metadata, outcome, started_at, completed_at, updated_at')
      .eq('kind', 'slack_mobile_notification')
      .order('started_at', { ascending: false })
      .limit(10)

    if (error || !Array.isArray(data)) return null

    const row = data.find((item: Record<string, unknown>) => {
      const metadata = asRecord(item.metadata)
      return metadata?.notification_kind === 'social_comment_attention_due'
    }) as Record<string, unknown> | undefined
    if (!row) return null

    const outcome = asRecord(row.outcome)
    const metadata = asRecord(row.metadata)
    const alertOutcome = lastRunOutcome(row)
    const itemCount = lastRunItemCount(row)
    return {
      id: String(row.id),
      status: stringValue(row.status),
      at: stringValue(row.completed_at) || stringValue(row.ended_at) || stringValue(row.updated_at) || stringValue(row.started_at),
      outcome: alertOutcome,
      reason: stringValue(outcome?.reason) || stringValue(metadata?.reason) || stringValue(row.current_step),
      itemCount,
    }
  } catch {
    return null
  }
}

function unavailableResponse(filters: {
  status: SocialCommentStatus | 'all'
  platform: SocialPlatform | 'all'
  campaign: string
  post: string
}) {
  const activationEnabled = socialCommentSlackAttentionEnabled()
  return NextResponse.json({
    unavailable: true,
    blocked: true,
    items: [],
    summary: summarizeSocialCommentInbox([]),
    filteredSummary: summarizeSocialCommentInbox([]),
    filters,
    message: COMMENT_INBOX_UNAVAILABLE_MESSAGE,
    recovery: COMMENT_INBOX_UNAVAILABLE_RECOVERY,
    alertReliability: buildSocialCommentAlertReliabilityStatus({
      activationEnabled,
      activationReason: activationEnabled ? 'enabled' : 'activation_disabled_default_off',
      deliveryDryRun: !activationEnabled,
      itemCount: 0,
      dataSurfaceReady: false,
      dataSurfaceReason: COMMENT_INBOX_UNAVAILABLE_MESSAGE,
      reasons: [COMMENT_INBOX_UNAVAILABLE_RECOVERY],
    }),
    integration_note: 'The canonical comment inbox table is missing from the bound database. No provider ingestion or external comment replies were attempted.',
  })
}

async function fetchPostsByContentId(contentIds: string[]) {
  if (!contentIds.length || !supabaseAdmin) return new Map<string, SocialCommentPostProjection>()

  const { data, error } = await supabaseAdmin
    .from('social_content_queue')
    .select(POST_SELECT)
    .in('id', contentIds)

  if (error) {
    console.error('Error fetching social content post projections:', error)
    return new Map<string, SocialCommentPostProjection>()
  }

  const rows = Array.isArray(data) ? data as SocialCommentPostProjection[] : []
  return new Map<string, SocialCommentPostProjection>(rows.map((row) => [String(row.id), row]))
}

/**
 * GET /api/admin/social-content/engagement/comments
 *
 * Lists the local Portfolio comment-inbox projection from the canonical
 * social_content_comments table. Provider ingestion and outbound submission
 * remain outside this UI lane.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filters = {
    status: socialCommentStatus(searchParams.get('status')),
    platform: socialPlatform(searchParams.get('platform')),
    campaign: searchParams.get('campaign') || 'all',
    post: searchParams.get('post') || 'all',
  }
  const qaFixtureRequest = isEngagementInboxQaFixtureListRequest({
    post: filters.post,
    comment: searchParams.get('comment'),
  })

  if (explicitEngagementInboxQaFixtureEnabled() && qaFixtureRequest) {
    return NextResponse.json(getEngagementInboxQaFixturePayload(filters))
  }

  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (qaFixtureRequest) {
    return NextResponse.json(getEngagementInboxQaFixturePayload(filters))
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  let query = supabaseAdmin
    .from('social_content_comments')
    .select(COMMENT_SELECT)

  // filter === 'all' → no restriction on platform
  if (filters.platform !== 'all') {
    query = query.eq('platform', filters.platform)
  }

  const { data, error } = await query
    .order('captured_at', { ascending: false })
    .limit(200)

  if (error) {
    if (isCommentInboxStorageUnavailable(error)) {
      return unavailableResponse(filters)
    }

    console.error('Error fetching social comment inbox:', error)
    return NextResponse.json({ error: 'Failed to fetch social comment inbox' }, { status: 500 })
  }

  const rows = Array.isArray(data) ? data : []
  const contentIds = [...new Set(rows.map((row: Record<string, unknown>) => String(row.content_id || '')).filter(Boolean))]
  const postsByContentId = await fetchPostsByContentId(contentIds)
  const allItems = getSocialCommentInboxItems(rows, postsByContentId)
  const items = filterSocialCommentInboxItems(allItems, filters)
  const activationEnabled = socialCommentSlackAttentionEnabled()
  const lastRun = await fetchLastSocialCommentAlertRun()
  const lastRunCounts = alertReliabilityCountsFromLastRun(lastRun)
  const currentAttentionItemCount = rows.filter((row) => needsCommentAttention(row as SocialCommentAttentionRow)).length
  const alertReliability = buildSocialCommentAlertReliabilityStatus({
    activationEnabled,
    activationReason: activationEnabled ? 'enabled' : 'activation_disabled_default_off',
    deliveryDryRun: !activationEnabled,
    itemCount: lastRun && lastRun.outcome !== 'unknown' ? lastRun.itemCount : currentAttentionItemCount,
    ...lastRunCounts,
    lastRun,
  })

  return NextResponse.json({
    items,
    summary: summarizeSocialCommentInbox(allItems),
    filteredSummary: summarizeSocialCommentInbox(items),
    filters,
    alertReliability,
    integration_note: 'Provider ingestion and outbound reply adapters are intentionally outside this UI lane. No external comment replies are submitted by this route.',
  })
}
