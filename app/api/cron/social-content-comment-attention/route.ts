/**
 * GET/POST /api/cron/social-content-comment-attention
 *
 * Sends governed Slack reminders for unresolved Social Content comments and
 * evaluates the 15-minute reply hold queue. This route never submits provider
 * replies; provider writes remain behind later capability and policy gates.
 * Auth: Bearer CRON_SECRET or N8N_INGEST_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runAgentSlackNotificationSweep } from '@/lib/agent-slack-notification-sweep'
import { evaluateSocialCommentReplyHolds } from '@/lib/social-comment-attention'

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

function flagValue(request: NextRequest, body: Record<string, unknown>, key: string) {
  const searchParams = new URL(request.url).searchParams
  return body[key] === true || searchParams.get(key) === '1' || searchParams.get(key) === 'true'
}

function socialCommentSlackAttentionEnabled() {
  return process.env.SOCIAL_COMMENT_SLACK_ATTENTION_ENABLED === 'true'
}

function limitFrom(request: NextRequest, body: Record<string, unknown>) {
  const searchParams = new URL(request.url).searchParams
  const raw = searchParams.get('limit') ?? body.limit
  const parsed = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : 25
  if (!Number.isFinite(parsed)) return 25
  return Math.min(Math.max(Math.floor(parsed), 1), 50)
}

async function runCommentAttentionSweep(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await parsePostBody(request)
  const requestedDryRun = flagValue(request, body, 'dry_run') || body.dryRun === true
  const activationEnabled = socialCommentSlackAttentionEnabled()
  const activationDisabled = !activationEnabled
  const dryRun = requestedDryRun || activationDisabled
  const requestedForce = flagValue(request, body, 'force')
  const force = requestedForce && activationEnabled
  const limit = limitFrom(request, body)

  const slack = await runAgentSlackNotificationSweep({
    kinds: ['social_comment_attention_due'],
    mode: 'scheduled',
    dryRun,
    force,
    actorLabel: request.method === 'GET' ? 'Vercel cron' : 'Manual cron trigger',
    triggerSource: request.method === 'GET'
      ? 'vercel_cron_social_content_comment_attention'
      : 'manual_cron_social_content_comment_attention',
  })
  const holds = dryRun
    ? {
        ok: true,
        checkedCount: 0,
        readyForProviderSendCount: 0,
        manualRequiredCount: 0,
        blockedCount: 0,
        waitingHoldCount: 0,
        dataSurfaceReady: true,
        reason: 'Dry run only.',
        evaluations: [],
      }
    : await evaluateSocialCommentReplyHolds(limit)

  return NextResponse.json({
    ok: slack.ok && holds.ok,
    dry_run: dryRun,
    activation: {
      enabled: activationEnabled,
      disabled: activationDisabled,
      reason: activationDisabled
        ? 'activation_disabled_default_off'
        : requestedDryRun
          ? 'manual_dry_run'
          : 'enabled',
      force_requested: requestedForce,
      force_applied: force,
    },
    slack,
    holds,
    side_effects: {
      slack_messages_sent: slack.sentCount,
      reply_hold_state_updated: !dryRun && holds.checkedCount > 0,
      provider_generation: false,
      provider_refresh: false,
      external_schedule: false,
      external_reply_send: false,
      external_post: false,
    },
  }, { status: slack.ok && holds.ok ? 200 : 500 })
}

export async function GET(request: NextRequest) {
  return runCommentAttentionSweep(request)
}

export async function POST(request: NextRequest) {
  return runCommentAttentionSweep(request)
}
