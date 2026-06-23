/**
 * GET/POST /api/cron/social-content-calendar-due-gates
 *
 * Finds pending calendar authorization gates due within 24h/2h and creates
 * internal Agent Ops work items. Auth: Bearer CRON_SECRET or N8N_INGEST_SECRET.
 * This route does not publish, upload, schedule externally, or call providers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import { runAgentSlackNotificationSweep } from '@/lib/agent-slack-notification-sweep'
import { supabaseAdmin } from '@/lib/supabase'
import {
  CALENDAR_SIDE_EFFECTS,
  dueGateWindow,
  deriveDueStatus,
  parseMetadata,
  type SocialContentCalendarItem,
} from '@/lib/social-content-calendar'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

function pingAlreadySent(item: SocialContentCalendarItem, window: '24h' | '2h') {
  const metadata = parseMetadata(item.metadata)
  const pings = parseMetadata(metadata.due_gate_pings)
  return Boolean(pings[window])
}

async function runDueGateSweep(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await bodyOrEmpty(request)
    const dryRun = isDryRun(request, body)
    const now = new Date()
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const { data, error } = await supabaseAdmin
      .from('social_content_calendar_items')
      .select(`
        *,
        attraction_campaigns (id, name, slug, status, starts_at, ends_at),
        agent_work_items (id, title, status, priority),
        social_content_queue (id, status, post_text, scheduled_for)
      `)
      .eq('authorization_status', 'pending')
      .lte('scheduled_for', windowEnd.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50)

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({
          ok: true,
          dry_run: dryRun,
          candidate_count: 0,
          pinged_count: 0,
          candidates: [],
          side_effects: CALENDAR_SIDE_EFFECTS,
        })
      }
      throw error
    }

    const candidates = ((data ?? []) as SocialContentCalendarItem[])
      .map((item) => ({ item, window: dueGateWindow(item.scheduled_for, now) }))
      .filter((entry): entry is { item: SocialContentCalendarItem; window: '24h' | '2h' } => (
        Boolean(entry.window) && !pingAlreadySent(entry.item, entry.window as '24h' | '2h')
      ))

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        candidate_count: candidates.length,
        pinged_count: 0,
        candidates: candidates.map(({ item, window }) => ({
          id: item.id,
          title: item.title,
          scheduled_for: item.scheduled_for,
          due_gate_window: window,
          campaign_id: item.campaign_id,
          channel: item.channel,
          campaign_phase: item.campaign_phase,
        })),
        side_effects: CALENDAR_SIDE_EFFECTS,
      })
    }

    const pinged: Array<{ calendar_item_id: string; work_item_id: string; window: '24h' | '2h' }> = []

    for (const { item, window } of candidates) {
      const idempotencyKey = `social-content-calendar-due:${item.id}:${window}`
      const workItem = await createAgentWorkItem({
        title: `Authorize content calendar item: ${item.title}`,
        objective: [
          `Review the ${window} due gate for ${item.channel.replace(/_/g, ' ')} content.`,
          'Authorize only the internal platform draft handoff if the item is ready.',
          'Reject with a decision note if Shaka or research should revise it.',
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
          approval_action: 'authorize_internal_platform_draft_handoff',
          rejection_action: 'return_to_shaka_or_research_revision',
          side_effects: {
            ...CALENDAR_SIDE_EFFECTS,
            social_draft_handoff_only: true,
          },
        },
        idempotencyKey,
      })

      const metadata = parseMetadata(item.metadata)
      const dueGatePings = parseMetadata(metadata.due_gate_pings)
      await supabaseAdmin
        .from('social_content_calendar_items')
        .update({
          due_status: deriveDueStatus(item.scheduled_for, now),
          last_pinged_at: now.toISOString(),
          metadata: {
            ...metadata,
            due_gate_pings: {
              ...dueGatePings,
              [window]: {
                pinged_at: now.toISOString(),
                work_item_id: workItem.id,
              },
            },
            external_execution_enabled: false,
          },
        })
        .eq('id', item.id)

      pinged.push({ calendar_item_id: item.id, work_item_id: workItem.id, window })
    }

    const slackResult = pinged.length > 0
      ? await runAgentSlackNotificationSweep({
          mode: 'immediate',
          kinds: ['goal_decisions'],
          goalId: 'social-content-calendar',
          actorLabel: request.method === 'GET' ? 'Calendar due-gate cron' : 'Manual calendar due-gate sweep',
          triggerSource: request.method === 'GET'
            ? 'vercel_cron_social_content_calendar_due_gates'
            : 'manual_social_content_calendar_due_gates',
        }).catch((notificationError) => ({
          error: notificationError instanceof Error ? notificationError.message : 'Slack sweep failed',
        }))
      : null

    return NextResponse.json({
      ok: true,
      dry_run: false,
      candidate_count: candidates.length,
      pinged_count: pinged.length,
      pinged,
      slack_notification_result: slackResult,
      side_effects: {
        ...CALENDAR_SIDE_EFFECTS,
        internal_work_items_created: pinged.length,
        slack_notification_requested: pinged.length > 0,
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
