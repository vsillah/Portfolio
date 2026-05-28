/**
 * GET/POST /api/cron/agent-ops-slack-notifications
 *
 * Runs governed Agent Ops Slack mobile notification rules.
 * Auth: Bearer CRON_SECRET or N8N_INGEST_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  PROACTIVE_SLACK_NOTIFICATION_RULES,
  runAgentSlackNotificationSweep,
  type ProactiveSlackNotificationKind,
  type ProactiveSlackNotificationMode,
} from '@/lib/agent-slack-notification-sweep'

export const dynamic = 'force-dynamic'

const VALID_KINDS = new Set<ProactiveSlackNotificationKind>(
  PROACTIVE_SLACK_NOTIFICATION_RULES.map((rule) => rule.kind),
)
const VALID_MODES = new Set<ProactiveSlackNotificationMode>(['scheduled', 'immediate', 'all'])

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const allowedTokens = [process.env.CRON_SECRET, process.env.N8N_INGEST_SECRET].filter(Boolean)
  return Boolean(token && allowedTokens.includes(token))
}

function parseKinds(value: unknown): ProactiveSlackNotificationKind[] | undefined {
  if (!Array.isArray(value)) return undefined
  const kinds = value
    .filter((item): item is string => typeof item === 'string')
    .filter((item): item is ProactiveSlackNotificationKind => VALID_KINDS.has(item as ProactiveSlackNotificationKind))
  return kinds.length ? [...new Set(kinds)] : undefined
}

function parseMode(value: unknown): ProactiveSlackNotificationMode | undefined {
  return typeof value === 'string' && VALID_MODES.has(value as ProactiveSlackNotificationMode)
    ? value as ProactiveSlackNotificationMode
    : undefined
}

async function parsePostBody(request: NextRequest) {
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    return {}
  }
}

async function runSweep(request: NextRequest, body: Record<string, unknown> = {}) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const dryRun = body.dry_run === true || body.dryRun === true || searchParams.get('dry_run') === '1'
  const force = body.force === true || searchParams.get('force') === '1'
  const kinds = parseKinds(body.kinds)
  const mode = parseMode(body.mode) ?? parseMode(searchParams.get('mode')) ?? 'scheduled'

  const result = await runAgentSlackNotificationSweep({
    kinds,
    mode,
    dryRun,
    force,
    actorLabel: request.method === 'GET' ? 'Vercel cron' : 'Manual cron trigger',
    triggerSource: request.method === 'GET'
      ? 'vercel_cron_agent_ops_slack_notifications'
      : 'manual_cron_agent_ops_slack_notifications',
  })

  return NextResponse.json({
    ...result,
    side_effects: {
      slack_messages_sent: result.sentCount,
      production_mutation_allowed: false,
      credential_change_allowed: false,
      external_customer_data_mutation: false,
    },
  }, { status: result.ok ? 200 : 500 })
}

export async function GET(request: NextRequest) {
  return runSweep(request)
}

export async function POST(request: NextRequest) {
  return runSweep(request, await parsePostBody(request))
}
