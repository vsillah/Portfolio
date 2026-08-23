/**
 * GET/POST /api/cron/social-content-calendar-due-gates
 *
 * Finds pending authorization gates and authorized draft preparation gaps due
 * within 24h or overdue within 30 days, then creates internal Agent Ops work.
 * If an unreleased calendar approval date has already elapsed, the cron
 * recalibrates the unreleased campaign sequence forward and creates a review
 * item instead of leaving stale dates visible.
 * Auth: Bearer CRON_SECRET or N8N_INGEST_SECRET.
 * This route does not publish, upload, schedule externally, or call providers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import { runAgentSlackNotificationSweep } from '@/lib/agent-slack-notification-sweep'
import { supabaseAdmin } from '@/lib/supabase'
import {
  CALENDAR_CHANNEL_LABELS,
  CALENDAR_SIDE_EFFECTS,
  calendarApprovalGateSummary,
  calendarDueGatePingAlreadySent,
  calendarDueGateScheduleKey,
  calendarMissedReleaseWindow,
  dueGateWindow,
  deriveDueStatus,
  parseMetadata,
  recalibrateCalendarSequence,
  type CalendarRecalibrationRow,
  type SocialContentCalendarItem,
} from '@/lib/social-content-calendar'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CALENDAR_LOOKBACK_HOURS = 30 * 24
const CALENDAR_SCAN_PAGE_SIZE = 50
const CALENDAR_MAX_SCAN_ROWS = 250
const CALENDAR_MAX_CANDIDATES = 50

type AuthorizationCandidate = {
  item: SocialContentCalendarItem
  window: '24h' | '2h'
}

type CalendarRecalibrationCandidate = {
  item: SocialContentCalendarItem
}

type DueGatePingUpdate = {
  item: SocialContentCalendarItem
  window: '24h' | '2h'
  workItemId: string
  scheduleKey: string
  dueStatus: ReturnType<typeof deriveDueStatus>
}

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const allowedTokens = [process.env.CRON_SECRET, process.env.N8N_INGEST_SECRET].filter(Boolean)
  return Boolean(token && allowedTokens.includes(token))
}

function assertSupabaseWriteSucceeded(result: { error?: { message?: string } | null }, action: string) {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message ?? 'Supabase write failed'}`)
  }
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

function pingAlreadySent(item: SocialContentCalendarItem, window: '24h' | '2h') {
  return calendarDueGatePingAlreadySent(item, window)
}

function preparationAlreadyRecorded(item: SocialContentCalendarItem) {
  const metadata = parseMetadata(item.metadata)
  const preparation = parseMetadata(metadata.publish_preparation)
  return typeof preparation.work_item_id === 'string' && preparation.work_item_id.length > 0
}

function isWithinPreparationWindow(item: SocialContentCalendarItem, now: Date) {
  const scheduledAt = new Date(item.scheduled_for).getTime()
  if (!Number.isFinite(scheduledAt)) return false
  return scheduledAt >= now.getTime() - CALENDAR_LOOKBACK_HOURS * 60 * 60 * 1000
    && scheduledAt <= now.getTime() + 24 * 60 * 60 * 1000
}

function needsPublishPreparation(item: SocialContentCalendarItem, now: Date) {
  if (item.authorization_status !== 'authorized' || !isWithinPreparationWindow(item, now)) return false
  const queue = item.social_content_queue
  if (!queue || !['draft', 'approved'].includes(queue.status)) return false
  return !preparationAlreadyRecorded(item)
}

function calendarNeedsRecalibration(item: SocialContentCalendarItem, now: Date) {
  if (item.authorization_status === 'authorized') return false
  if (item.due_status === 'completed' || item.due_status === 'cancelled') return false
  return calendarMissedReleaseWindow(item.scheduled_for, now)
}

async function createPublishPreparationWorkItem(item: SocialContentCalendarItem, now: Date) {
  const socialContentId = item.social_content_queue?.id ?? item.social_content_id
  const channelLabel = CALENDAR_CHANNEL_LABELS[item.channel]
  const publishes = item.social_content_queue?.social_content_publishes ?? []
  const missingPublishRows = publishes.length === 0

  return createAgentWorkItem({
    title: `Prepare authorized ${channelLabel} Social Content item: ${item.title}`,
    objective: [
      `Continue in the canonical Social Content item at /admin/social-content/${socialContentId}.`,
      'Prepare the internal publish records and review gates needed for a human readiness decision.',
      'Do not approve a gate, generate provider media, upload, schedule, publish, or call a provider from this work item.',
    ].join(' '),
    priority: new Date(item.scheduled_for).getTime() < now.getTime() ? 'urgent' : 'high',
    status: 'queued',
    ownerAgentKey: 'content-repurposing',
    ownerRuntime: 'codex',
    source: {
      type: 'social_content_calendar_publish_preparation',
      id: item.id,
      label: item.title,
    },
    overlapGroup: 'social-content-calendar',
    metadata: {
      goal_id: 'social-content-calendar',
      calendar_item_id: item.id,
      campaign_id: item.campaign_id,
      social_content_id: socialContentId,
      social_content_path: `/admin/social-content/${socialContentId}`,
      queue_status: item.social_content_queue?.status ?? null,
      channel: item.channel,
      campaign_phase: item.campaign_phase,
      scheduled_for: item.scheduled_for,
      preparation_action: 'prepare_publish_rows_and_gates_for_human_review',
      missing_publish_rows: missingPublishRows,
      existing_publish_row_count: publishes.length,
      external_execution_enabled: false,
      side_effects: CALENDAR_SIDE_EFFECTS,
    },
    idempotencyKey: `social-content-calendar-publish-preparation:${item.id}`,
  })
}

async function collectDueGateCandidates(input: {
  now: Date
  windowStart: Date
  windowEnd: Date
}) {
  const candidates: AuthorizationCandidate[] = []
  const preparationCandidates: SocialContentCalendarItem[] = []
  const recalibrationCandidates: CalendarRecalibrationCandidate[] = []
  const seenItemIds = new Set<string>()
  let scannedCount = 0

  for (let offset = 0; offset < CALENDAR_MAX_SCAN_ROWS; offset += CALENDAR_SCAN_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('social_content_calendar_items')
      .select(`
        *,
        attraction_campaigns (id, name, slug, status, starts_at, ends_at),
        agent_work_items (id, title, status, priority),
        social_content_queue (
          id, status, platform, target_platforms, post_text, scheduled_for, rag_context,
          social_content_publishes (id, platform, status)
        )
      `)
      .in('authorization_status', ['pending', 'authorized'])
      .gte('scheduled_for', input.windowStart.toISOString())
      .lte('scheduled_for', input.windowEnd.toISOString())
      .order('scheduled_for', { ascending: true })
      .range(offset, offset + CALENDAR_SCAN_PAGE_SIZE - 1)

    if (error) {
      return { error, candidates, preparationCandidates, recalibrationCandidates, scannedCount }
    }

    const rows = (data ?? []) as SocialContentCalendarItem[]
    scannedCount += rows.length

    for (const item of rows) {
      if (seenItemIds.has(item.id)) continue
      seenItemIds.add(item.id)

      if (item.authorization_status === 'pending') {
        const window = dueGateWindow(item.scheduled_for, input.now)
        if (window && !pingAlreadySent(item, window)) {
          candidates.push({ item, window })
        } else if (calendarNeedsRecalibration(item, input.now)) {
          recalibrationCandidates.push({ item })
        }
      } else if (needsPublishPreparation(item, input.now)) {
        preparationCandidates.push(item)
      }

      if (
        candidates.length
          + preparationCandidates.length
          + recalibrationCandidates.length
          >= CALENDAR_MAX_CANDIDATES
      ) break
    }

    if (
      candidates.length
        + preparationCandidates.length
        + recalibrationCandidates.length
        >= CALENDAR_MAX_CANDIDATES
      || rows.length < CALENDAR_SCAN_PAGE_SIZE
    ) break
  }

  preparationCandidates.sort(
    (left, right) => new Date(left.scheduled_for).getTime() - new Date(right.scheduled_for).getTime(),
  )
  recalibrationCandidates.sort(
    (left, right) => new Date(left.item.scheduled_for).getTime() - new Date(right.item.scheduled_for).getTime(),
  )
  return { error: null, candidates, preparationCandidates, recalibrationCandidates, scannedCount }
}

function recalibrationScopeKey(item: SocialContentCalendarItem) {
  return item.campaign_id ?? `calendar-item:${item.id}`
}

async function loadRecalibrationRows(item: SocialContentCalendarItem): Promise<CalendarRecalibrationRow[]> {
  if (!item.campaign_id) {
    return [{
      id: item.id,
      scheduled_for: item.scheduled_for,
      authorization_status: item.authorization_status,
      due_status: item.due_status,
      metadata: item.metadata,
    }]
  }

  const { data, error } = await supabaseAdmin
    .from('social_content_calendar_items')
    .select('id, scheduled_for, authorization_status, due_status, metadata')
    .eq('campaign_id', item.campaign_id)
    .gte('scheduled_for', item.scheduled_for)
    .order('scheduled_for', { ascending: true })

  if (error) throw error
  return (data ?? []) as CalendarRecalibrationRow[]
}

async function createRecalibrationWorkItem(input: {
  item: SocialContentCalendarItem
  updates: ReturnType<typeof recalibrateCalendarSequence>
  now: Date
  triggerSource: string
}) {
  const channelLabel = CALENDAR_CHANNEL_LABELS[input.item.channel]
  return createAgentWorkItem({
    title: `Recalibrate ${channelLabel} calendar sequence: ${input.item.title}`,
    objective: [
      `The planned release time elapsed before ${input.item.title} was released.`,
      'Portfolio recalibrated the unreleased campaign-calendar rows forward so the sequence is not anchored to stale past dates.',
      'Review the updated dates and approval gates in Content Intelligence.',
      'Do not publish, upload, schedule externally, or call providers from this work item.',
    ].join(' '),
    priority: 'urgent',
    status: 'queued',
    ownerAgentKey: 'chief-of-staff',
    ownerRuntime: 'codex',
    source: {
      type: 'social_content_calendar_recalibration',
      id: input.item.id,
      label: input.item.title,
    },
    overlapGroup: 'social-content-calendar',
    metadata: {
      goal_id: 'social-content-calendar',
      requires_approval: true,
      calendar_item_id: input.item.id,
      campaign_id: input.item.campaign_id,
      channel: input.item.channel,
      campaign_phase: input.item.campaign_phase,
      prior_scheduled_for: input.item.scheduled_for,
      affected_calendar_item_ids: input.updates.map((update) => update.id),
      affected_count: input.updates.length,
      recalibration_action: 'move_unreleased_calendar_sequence_forward',
      trigger_source: input.triggerSource,
      recalibrated_at: input.now.toISOString(),
      side_effects: CALENDAR_SIDE_EFFECTS,
      external_execution_enabled: false,
    },
    idempotencyKey: `social-content-calendar-recalibration:${recalibrationScopeKey(input.item)}:${input.item.id}`,
  })
}

async function runDueGateSweep(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await bodyOrEmpty(request)
    const dryRun = isDryRun(request, body)
    const now = new Date()
    const windowStart = new Date(now.getTime() - CALENDAR_LOOKBACK_HOURS * 60 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const {
      error,
      candidates,
      preparationCandidates,
      recalibrationCandidates,
      scannedCount,
    } = await collectDueGateCandidates({ now, windowStart, windowEnd })

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({
          ok: true,
          dry_run: dryRun,
          candidate_count: 0,
          scanned_count: scannedCount,
          pinged_count: 0,
          recalibrated_count: 0,
          candidates: [],
          side_effects: CALENDAR_SIDE_EFFECTS,
        })
      }
      throw error
    }

    if (dryRun) {
      const slackDryRun = candidates.length + preparationCandidates.length + recalibrationCandidates.length > 0
        ? await runAgentSlackNotificationSweep({
            mode: 'immediate',
            kinds: ['social_calendar_approval_due'],
            goalId: 'social-content-calendar',
            dryRun: true,
            actorLabel: request.method === 'GET' ? 'Calendar due-gate cron dry run' : 'Manual calendar due-gate dry run',
            triggerSource: 'dry_run_social_content_calendar_due_gates',
          }).catch((notificationError) => ({
            error: notificationError instanceof Error ? notificationError.message : 'Slack dry-run sweep failed',
          }))
        : null
      return NextResponse.json({
        ok: true,
        dry_run: true,
        candidate_count: candidates.length + preparationCandidates.length + recalibrationCandidates.length,
        scanned_count: scannedCount,
        pinged_count: 0,
        preparation_count: 0,
        recalibrated_count: 0,
        candidates: [
          ...candidates.map(({ item, window }) => ({
            ...calendarApprovalGateSummary(item),
            id: item.id,
            title: item.title,
            scheduled_for: item.scheduled_for,
            due_gate_window: window,
            gate_type: 'authorization',
            campaign_id: item.campaign_id,
            channel: item.channel,
            campaign_phase: item.campaign_phase,
          })),
          ...preparationCandidates.map((item) => ({
            ...calendarApprovalGateSummary(item),
            id: item.id,
            title: item.title,
            scheduled_for: item.scheduled_for,
            gate_type: 'publish_preparation',
            social_content_id: item.social_content_queue?.id ?? item.social_content_id,
            campaign_id: item.campaign_id,
            channel: item.channel,
            campaign_phase: item.campaign_phase,
          })),
          ...recalibrationCandidates.map(({ item }) => ({
            ...calendarApprovalGateSummary(item),
            id: item.id,
            title: item.title,
            scheduled_for: item.scheduled_for,
            gate_type: 'calendar_recalibration',
            campaign_id: item.campaign_id,
            channel: item.channel,
            campaign_phase: item.campaign_phase,
          })),
        ],
        slack_notification_result: slackDryRun,
        side_effects: CALENDAR_SIDE_EFFECTS,
      })
    }

    const pinged: Array<{ calendar_item_id: string; work_item_id: string; window: '24h' | '2h' }> = []
    const prepared: Array<{ calendar_item_id: string; social_content_id: string | null; work_item_id: string }> = []
    const recalibrated: Array<{
      anchor_calendar_item_id: string
      work_item_id: string
      affected_count: number
      updates: Array<{ calendar_item_id: string; prior_scheduled_for: string; scheduled_for: string }>
    }> = []
    const dueGatePingUpdates: DueGatePingUpdate[] = []
    const recalibratedScopes = new Set<string>()
    const triggerSource = request.method === 'GET'
      ? 'vercel_cron_social_content_calendar_due_gates'
      : 'manual_social_content_calendar_due_gates'

    for (const { item, window } of candidates) {
      const scheduleKey = calendarDueGateScheduleKey(item)
      const idempotencyKey = `social-content-calendar-due:${item.id}:${window}:${scheduleKey}`
      const gate = calendarApprovalGateSummary(item)
      const workItem = await createAgentWorkItem({
        title: `Authorize content calendar item: ${item.title}`,
        objective: [
          `Review the ${window} ${gate.label.toLowerCase()} gate for ${item.channel.replace(/_/g, ' ')} content.`,
          gate.action,
          `Owner: ${gate.owner}.`,
          gate.detail,
          'Do not publish, upload, schedule externally, or call media providers from this gate.',
        ].join(' '),
        priority: window === '2h' ? 'urgent' : 'high',
        status: 'queued',
        ownerAgentKey: 'chief-of-staff',
        ownerRuntime: 'codex',
        source: {
          type: 'social_content_calendar_due_gate',
          id: item.id,
          label: item.title,
        },
        overlapGroup: 'social-content-calendar',
        metadata: {
          goal_id: 'social-content-calendar',
          requires_approval: true,
          calendar_item_id: item.id,
          campaign_id: item.campaign_id,
          agent_work_item_id: item.agent_work_item_id,
          social_content_id: item.social_content_id,
          channel: item.channel,
          campaign_phase: item.campaign_phase,
          scheduled_for: item.scheduled_for,
          due_gate_window: window,
          blocker_kind: gate.kind,
          blocker_label: gate.label,
          blocker_owner: gate.owner,
          blocker_detail: gate.detail,
          approval_action: gate.action,
          social_content_deep_link: item.social_content_queue?.id || item.social_content_id
            ? `/admin/social-content/${item.social_content_queue?.id ?? item.social_content_id}?step=${gate.deepLinkStep}`
            : `/admin/agents/content-intelligence?section=calendar&calendar_item=${item.id}`,
          rejection_action: 'return_to_shaka_or_research_revision',
          side_effects: {
            ...CALENDAR_SIDE_EFFECTS,
            social_draft_handoff_only: true,
          },
        },
        idempotencyKey,
      })

      const dueStatus = deriveDueStatus(item.scheduled_for, now)
      dueGatePingUpdates.push({
        item,
        window,
        workItemId: workItem.id,
        scheduleKey,
        dueStatus,
      })
      pinged.push({ calendar_item_id: item.id, work_item_id: workItem.id, window })
    }

    for (const item of preparationCandidates) {
      const workItem = await createPublishPreparationWorkItem(item, now)
      const metadata = parseMetadata(item.metadata)
      const socialContentId = item.social_content_queue?.id ?? item.social_content_id
      const updateResult = await supabaseAdmin
        .from('social_content_calendar_items')
        .update({
          due_status: deriveDueStatus(item.scheduled_for, now),
          last_pinged_at: now.toISOString(),
          metadata: {
            ...metadata,
            publish_preparation: {
              prepared_at: now.toISOString(),
              work_item_id: workItem.id,
              social_content_id: socialContentId,
              action: 'prepare_publish_rows_and_gates_for_human_review',
            },
            external_execution_enabled: false,
          },
        })
        .eq('id', item.id)
      assertSupabaseWriteSucceeded(updateResult, `Record publish preparation for ${item.id}`)

      prepared.push({
        calendar_item_id: item.id,
        social_content_id: socialContentId,
        work_item_id: workItem.id,
      })
    }

    for (const { item } of recalibrationCandidates) {
      const scopeKey = recalibrationScopeKey(item)
      if (recalibratedScopes.has(scopeKey)) continue
      recalibratedScopes.add(scopeKey)

      const rows = await loadRecalibrationRows(item)
      const updates = recalibrateCalendarSequence({
        rows,
        anchorItemId: item.id,
        now,
        actor: triggerSource,
      })
      if (!updates.length) continue

      const workItem = await createRecalibrationWorkItem({
        item,
        updates,
        now,
        triggerSource,
      })

      for (const update of updates) {
        const updateResult = await supabaseAdmin
          .from('social_content_calendar_items')
          .update({
            scheduled_for: update.scheduled_for,
            authorization_due_at: update.authorization_due_at,
            due_status: update.due_status,
            last_pinged_at: now.toISOString(),
            metadata: {
              ...update.metadata,
              calendar_recalibration: {
                ...parseMetadata(update.metadata.calendar_recalibration),
                work_item_id: workItem.id,
              },
            },
          })
          .eq('id', update.id)
        assertSupabaseWriteSucceeded(updateResult, `Recalibrate calendar item ${update.id}`)
      }

      recalibrated.push({
        anchor_calendar_item_id: item.id,
        work_item_id: workItem.id,
        affected_count: updates.length,
        updates: updates.map((update) => ({
          calendar_item_id: update.id,
          prior_scheduled_for: update.prior_scheduled_for,
          scheduled_for: update.scheduled_for,
        })),
      })
    }

    // Slack selects eligible rows from the calendar table. Persisting due_gate_pings
    // before this sweep makes the same row look already notified and suppresses
    // the alert that the work item was created for.
    const slackResult = pinged.length + prepared.length + recalibrated.length > 0
      ? await runAgentSlackNotificationSweep({
          mode: 'immediate',
          kinds: ['social_calendar_approval_due'],
          goalId: 'social-content-calendar',
          actorLabel: request.method === 'GET' ? 'Calendar due-gate cron' : 'Manual calendar due-gate sweep',
          triggerSource,
        }).catch((notificationError) => ({
          error: notificationError instanceof Error ? notificationError.message : 'Slack sweep failed',
        }))
      : null

    for (const update of dueGatePingUpdates) {
      const metadata = parseMetadata(update.item.metadata)
      const dueGatePings = parseMetadata(metadata.due_gate_pings)
      const updateResult = await supabaseAdmin
        .from('social_content_calendar_items')
        .update({
          due_status: update.dueStatus,
          last_pinged_at: now.toISOString(),
          metadata: {
            ...metadata,
            due_gate_pings: {
              ...dueGatePings,
              [update.window]: {
                pinged_at: now.toISOString(),
                work_item_id: update.workItemId,
                schedule_key: update.scheduleKey,
                scheduled_for: update.item.scheduled_for,
                authorization_due_at: update.item.authorization_due_at ?? null,
                due_status: update.dueStatus,
              },
            },
            external_execution_enabled: false,
          },
        })
        .eq('id', update.item.id)
      assertSupabaseWriteSucceeded(updateResult, `Record due-gate ping for ${update.item.id}`)
    }

    return NextResponse.json({
      ok: true,
      dry_run: false,
      candidate_count: candidates.length + preparationCandidates.length + recalibrationCandidates.length,
      scanned_count: scannedCount,
      pinged_count: pinged.length,
      preparation_count: prepared.length,
      recalibrated_count: recalibrated.length,
      pinged,
      prepared,
      recalibrated,
      slack_notification_result: slackResult,
      side_effects: {
        ...CALENDAR_SIDE_EFFECTS,
        internal_work_items_created: pinged.length + prepared.length + recalibrated.length,
        internal_calendar_recalibration: recalibrated.reduce((sum, item) => sum + item.affected_count, 0),
        slack_notification_requested: pinged.length + prepared.length + recalibrated.length > 0,
      },
    })
  } catch (error) {
    console.error('[social-content-calendar-due-gates] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Calendar due-gate sweep failed' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return runDueGateSweep(request)
}

export async function POST(request: NextRequest) {
  return runDueGateSweep(request)
}
