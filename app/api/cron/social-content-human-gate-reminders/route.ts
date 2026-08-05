/**
 * GET/POST /api/cron/social-content-human-gate-reminders
 *
 * Sends governed Slack reminders for scheduled Social Content that is close to
 * publish time but still blocked by a human QA, asset/privacy, or provider gate.
 * Auth: Bearer CRON_SECRET or N8N_INGEST_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runAgentSlackNotificationSweep } from '@/lib/agent-slack-notification-sweep'

export const dynamic = 'force-dynamic'

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const allowedTokens = [process.env.CRON_SECRET, process.env.N8N_INGEST_SECRET].filter(Boolean)
  return Boolean(token && allowedTokens.includes(token))
}

async function parsePostBody(request: NextRequest) {
  if (request.method === 'GET') return {}
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    return {}
  }
}

async function runReminderSweep(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await parsePostBody(request)
  const searchParams = new URL(request.url).searchParams
  const dryRun = body.dry_run === true
    || body.dryRun === true
    || searchParams.get('dry_run') === '1'
  const force = body.force === true || searchParams.get('force') === '1'

  const result = await runAgentSlackNotificationSweep({
    kinds: ['social_publish_gate_due'],
    mode: 'scheduled',
    dryRun,
    force,
    actorLabel: request.method === 'GET' ? 'Vercel cron' : 'Manual cron trigger',
    triggerSource: request.method === 'GET'
      ? 'vercel_cron_social_content_human_gate_reminders'
      : 'manual_cron_social_content_human_gate_reminders',
  })

  return NextResponse.json({
    ...result,
    side_effects: {
      slack_messages_sent: result.sentCount,
      approval_recorded: false,
      provider_generation: false,
      external_schedule: false,
      publish: false,
      external_post: false,
    },
  }, { status: result.ok ? 200 : 500 })
}

export async function GET(request: NextRequest) {
  return runReminderSweep(request)
}

export async function POST(request: NextRequest) {
  return runReminderSweep(request)
}
