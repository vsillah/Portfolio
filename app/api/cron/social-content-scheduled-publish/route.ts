/**
 * GET/POST /api/cron/social-content-scheduled-publish
 *
 * Publishes due Social Content rows only after final platform-submission approval.
 * Auth: Bearer CRON_SECRET or N8N_INGEST_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import { supabaseAdmin } from '@/lib/supabase'
import { publishSocialContentItem } from '@/lib/social-content-publisher'
import type { SocialPlatform } from '@/lib/social-content'
import { isPlatformSubmissionGateApproved } from '@/lib/social-platform-orchestration'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type PublishRow = {
  platform: SocialPlatform
  status: string
  platform_post_url?: string | null
}

const DEFAULT_STALE_THRESHOLD_HOURS = 24
const MAX_STALE_THRESHOLD_HOURS = 7 * 24

const STALE_SCHEDULE_BLOCKER = 'Scheduled publish paused because the scheduled time is outside the automatic publish safety window. Reschedule and reconfirm, or cancel, in Social Content.'
const SUBMISSION_GATE_BLOCKER = 'Scheduled publish paused because final platform submission approval is incomplete. Review the Submit gate in Social Content.'
const PUBLISH_ATTEMPT_BLOCKER = 'Scheduled publish did not complete. Review the publish blocker in Social Content before retrying.'
const PUBLISH_ROWS_BLOCKER = 'Scheduled publish paused because publish readiness could not be verified. Review the Social Content item before retrying.'

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const allowedTokens = [process.env.CRON_SECRET, process.env.N8N_INGEST_SECRET].filter(Boolean)
  return Boolean(token && allowedTokens.includes(token))
}

async function bodyOrEmpty(request: NextRequest) {
  if (request.method === 'GET') return {}
  return request.json().catch(() => ({})) as Promise<Record<string, unknown>>
}

function isDryRun(request: NextRequest, body: Record<string, unknown>) {
  const { searchParams } = new URL(request.url)
  return searchParams.get('dry_run') === '1'
    || searchParams.get('dry_run') === 'true'
    || body.dry_run === true
}

function limitFrom(request: NextRequest, body: Record<string, unknown>) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('limit') ?? body.limit
  const parsed = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : 10
  if (!Number.isFinite(parsed)) return 10
  return Math.min(Math.max(Math.floor(parsed), 1), 20)
}

function staleThresholdHoursFrom(request: NextRequest, body: Record<string, unknown>) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('stale_hours')
    ?? body.stale_hours
    ?? process.env.SOCIAL_CONTENT_SCHEDULED_PUBLISH_STALE_HOURS
    ?? DEFAULT_STALE_THRESHOLD_HOURS
  const parsed = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : DEFAULT_STALE_THRESHOLD_HOURS
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_STALE_THRESHOLD_HOURS
  return Math.min(Math.max(parsed, 1), MAX_STALE_THRESHOLD_HOURS)
}

function asPlatform(value: unknown): SocialPlatform | null {
  return typeof value === 'string' && ['linkedin', 'youtube', 'instagram', 'facebook', 'tiktok', 'x'].includes(value)
    ? value as SocialPlatform
    : null
}

function isStaleSchedule(value: unknown, now: Date, thresholdHours: number) {
  if (typeof value !== 'string') return true
  const scheduledAt = new Date(value).getTime()
  if (!Number.isFinite(scheduledAt)) return true
  return scheduledAt < now.getTime() - thresholdHours * 60 * 60 * 1000
}

async function scheduledRowsForWindow(input: {
  admin: NonNullable<typeof supabaseAdmin>
  cutoff: string
  now: string
  limit: number
  window: 'in_window' | 'stale'
}) {
  let query = input.admin
    .from('social_content_queue')
    .select('id, platform, target_platforms, status, scheduled_for, rag_context')
    .eq('status', 'scheduled')

  query = input.window === 'in_window'
    ? query.gte('scheduled_for', input.cutoff).lte('scheduled_for', input.now)
    : query.lt('scheduled_for', input.cutoff)

  return query
    .order('scheduled_for', { ascending: input.window === 'in_window' })
    .limit(input.limit)
}

async function persistPublishBlocker(input: {
  contentId: string
  platforms: SocialPlatform[]
  blocker: string
}) {
  let query = supabaseAdmin
    .from('social_content_publishes')
    .update({ error_message: input.blocker })
    .eq('content_id', input.contentId)
    .in('status', ['pending', 'failed'])

  if (input.platforms.length) {
    query = query.in('platform', input.platforms)
  }

  const { error } = await query
  return error?.message ?? null
}

async function createScheduledPublishRecovery(input: {
  contentId: string
  scheduledFor: string | null
  platforms: SocialPlatform[]
  blocker: string
  kind: 'stale_schedule' | 'publish_blocked'
}) {
  const stale = input.kind === 'stale_schedule'
  const recoveryAction = stale
    ? 'reschedule_reconfirm_or_cancel'
    : 'resolve_blocker_and_reconfirm'

  return createAgentWorkItem({
    title: stale
      ? `Recover stale scheduled Social Content item ${input.contentId}`
      : `Resolve scheduled Social Content blocker ${input.contentId}`,
    objective: [
      `Review the canonical Social Content item at /admin/social-content/${input.contentId}.`,
      stale
        ? 'Reschedule and reconfirm the publishing intent, or cancel the stale schedule.'
        : 'Resolve the displayed publish blocker and reconfirm readiness before retrying.',
      'Do not publish or call a provider from this recovery item.',
    ].join(' '),
    priority: stale ? 'urgent' : 'high',
    status: 'queued',
    ownerAgentKey: 'chief-of-staff',
    ownerRuntime: 'codex',
    source: {
      type: 'social_content_scheduled_publish_recovery',
      id: input.contentId,
      label: `Social Content ${input.contentId}`,
    },
    overlapGroup: 'social-content-publishing',
    metadata: {
      goal_id: 'social-content-publish-recovery',
      requires_approval: true,
      social_content_id: input.contentId,
      social_content_path: `/admin/social-content/${input.contentId}`,
      social_content_href: `/admin/social-content/${input.contentId}?step=status#scheduled-publish-recovery`,
      scheduled_for: input.scheduledFor,
      target_platforms: input.platforms,
      blocker: input.blocker,
      recovery_kind: input.kind,
      recovery_action: recoveryAction,
      external_execution_enabled: false,
      side_effects: {
        provider_generation: false,
        upload: false,
        external_schedule: false,
        publish: false,
        external_post: false,
      },
    },
    idempotencyKey: `social-content-scheduled-publish-recovery:${input.kind}:${input.contentId}`,
  })
}

async function recordBlockedItem(input: {
  contentId: string
  scheduledFor: string | null
  platforms: SocialPlatform[]
  blocker: string
  kind: 'stale_schedule' | 'publish_blocked'
  dryRun: boolean
}) {
  if (input.dryRun) {
    return { blocker_persisted: false, recovery_work_item_id: null, dry_run: true }
  }

  const [persistError, recovery] = await Promise.all([
    persistPublishBlocker(input).catch((error) => (
      error instanceof Error ? error.message : 'Failed to persist publish blocker'
    )),
    createScheduledPublishRecovery(input).catch(() => null),
  ])

  return {
    blocker_persisted: persistError === null,
    blocker_persist_error: persistError,
    recovery_work_item_id: recovery?.id ?? null,
  }
}

async function recordReadinessUnverified(input: {
  contentId: string
  scheduledFor: string | null
  dryRun: boolean
}) {
  if (input.dryRun) {
    return { blocker_persisted: false, recovery_work_item_id: null, dry_run: true }
  }

  const recovery = await createScheduledPublishRecovery({
    contentId: input.contentId,
    scheduledFor: input.scheduledFor,
    platforms: [],
    blocker: PUBLISH_ROWS_BLOCKER,
    kind: 'publish_blocked',
  }).catch(() => null)

  return {
    blocker_persisted: false,
    recovery_work_item_id: recovery?.id ?? null,
  }
}

async function runScheduledPublishSweep(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const body = await bodyOrEmpty(request)
    const dryRun = isDryRun(request, body)
    const limit = limitFrom(request, body)
    const staleThresholdHours = staleThresholdHoursFrom(request, body)
    const nowDate = new Date()
    const now = nowDate.toISOString()
    const staleCutoff = new Date(
      nowDate.getTime() - staleThresholdHours * 60 * 60 * 1000,
    ).toISOString()

    const [inWindowRead, staleRead] = await Promise.all([
      scheduledRowsForWindow({
        admin,
        cutoff: staleCutoff,
        now,
        limit,
        window: 'in_window',
      }),
      scheduledRowsForWindow({
        admin,
        cutoff: staleCutoff,
        now,
        limit,
        window: 'stale',
      }),
    ])

    if (inWindowRead.error) throw inWindowRead.error
    if (staleRead.error) throw staleRead.error

    const inWindowItems = inWindowRead.data ?? []
    const staleItems = staleRead.data ?? []
    const items = [...inWindowItems, ...staleItems]
    const evaluated: Array<Record<string, unknown>> = []
    let publishedCount = 0
    let blockedCount = 0

    for (const item of items) {
      const { data: publishRows, error: publishError } = await admin
        .from('social_content_publishes')
        .select('platform, status, platform_post_url')
        .eq('content_id', item.id)

      if (publishError) {
        blockedCount += 1
        const recovery = await recordReadinessUnverified({
          contentId: item.id,
          scheduledFor: item.scheduled_for,
          dryRun,
        })
        evaluated.push({
          id: item.id,
          status: 'blocked',
          readiness: 'unverified',
          reason: PUBLISH_ROWS_BLOCKER,
          ...recovery,
        })
        continue
      }

      const publishes = (publishRows ?? []) as PublishRow[]
      if (!publishes.length) {
        blockedCount += 1
        const recovery = await recordReadinessUnverified({
          contentId: item.id,
          scheduledFor: item.scheduled_for,
          dryRun,
        })
        evaluated.push({
          id: item.id,
          status: 'blocked',
          readiness: 'unverified',
          reason: PUBLISH_ROWS_BLOCKER,
          ...recovery,
        })
        continue
      }

      const pendingPlatforms = publishes
        .filter((publish) => publish.status === 'pending' || publish.status === 'failed')
        .map((publish) => asPlatform(publish.platform))
        .filter((platform): platform is SocialPlatform => Boolean(platform))

      if (!pendingPlatforms.length) {
        evaluated.push({
          id: item.id,
          status: 'skipped',
          reason: 'No pending or failed publish rows remain.',
        })
        continue
      }

      if (isStaleSchedule(item.scheduled_for, nowDate, staleThresholdHours)) {
        blockedCount += 1
        const recovery = await recordBlockedItem({
          contentId: item.id,
          scheduledFor: item.scheduled_for,
          platforms: pendingPlatforms,
          blocker: STALE_SCHEDULE_BLOCKER,
          kind: 'stale_schedule',
          dryRun,
        })
        evaluated.push({
          id: item.id,
          status: 'stale',
          reason: STALE_SCHEDULE_BLOCKER,
          platforms: pendingPlatforms,
          scheduled_for: item.scheduled_for,
          ...recovery,
        })
        continue
      }

      if (!isPlatformSubmissionGateApproved(item.rag_context, pendingPlatforms)) {
        blockedCount += 1
        const recovery = await recordBlockedItem({
          contentId: item.id,
          scheduledFor: item.scheduled_for,
          platforms: pendingPlatforms,
          blocker: SUBMISSION_GATE_BLOCKER,
          kind: 'publish_blocked',
          dryRun,
        })
        evaluated.push({
          id: item.id,
          status: 'blocked',
          reason: SUBMISSION_GATE_BLOCKER,
          platforms: pendingPlatforms,
          ...recovery,
        })
        continue
      }

      if (dryRun) {
        evaluated.push({
          id: item.id,
          status: 'eligible',
          platforms: pendingPlatforms,
          scheduled_for: item.scheduled_for,
        })
        continue
      }

      const result = await publishSocialContentItem({
        admin,
        id: item.id,
        targetPlatforms: pendingPlatforms,
      })
      const published = result.status === 200 && result.body.published === true
      if (published) publishedCount += 1
      else blockedCount += 1
      const recovery = published
        ? null
        : await recordBlockedItem({
            contentId: item.id,
            scheduledFor: item.scheduled_for,
            platforms: pendingPlatforms,
            blocker: PUBLISH_ATTEMPT_BLOCKER,
            kind: 'publish_blocked',
            dryRun: false,
          })
      evaluated.push({
        id: item.id,
        status: published ? 'published' : 'blocked',
        response_status: result.status,
        platforms: pendingPlatforms,
        ...(published ? { result: result.body } : { reason: PUBLISH_ATTEMPT_BLOCKER, ...recovery }),
      })
    }

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      stale_threshold_hours: staleThresholdHours,
      checked_count: items.length,
      in_window_checked_count: inWindowItems.length,
      stale_checked_count: staleItems.length,
      published_count: publishedCount,
      blocked_count: blockedCount,
      evaluated,
      side_effects: {
        provider_generation: false,
        upload: false,
        external_schedule: false,
        publish: !dryRun && publishedCount > 0,
        external_post: !dryRun && publishedCount > 0,
      },
    })
  } catch (error) {
    console.error('[social-content-scheduled-publish] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scheduled publish sweep failed' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return runScheduledPublishSweep(request)
}

export async function POST(request: NextRequest) {
  return runScheduledPublishSweep(request)
}
