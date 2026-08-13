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
import { runSocialCommentAttentionYouTubeRefresh } from '@/lib/social-comment-attention-refresh'
import { evaluateSocialCommentReplyHolds } from '@/lib/social-comment-attention'
import { supabaseAdmin } from '@/lib/supabase'
import { refreshPublishedYouTubeComments } from '@/lib/youtube-comment-ingestion'

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

function numericOption(request: NextRequest, body: Record<string, unknown>, key: string, fallback: number, max: number) {
  const searchParams = new URL(request.url).searchParams
  const raw = searchParams.get(key) ?? body[key]
  const parsed = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : fallback
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.floor(parsed), 1), max)
}

async function runCommentAttentionSweep(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await parsePostBody(request)
  const dryRun = flagValue(request, body, 'dry_run') || body.dryRun === true
  const activationEnabled = socialCommentSlackAttentionEnabled()
  const activationDisabled = !activationEnabled
  const slackDryRun = dryRun || activationDisabled
  const requestedForce = flagValue(request, body, 'force')
  const slackForce = requestedForce && activationEnabled
  const limit = limitFrom(request, body)
  const publishLimit = numericOption(request, body, 'publish_limit', 3, 10)
  const commentLimit = numericOption(request, body, 'comment_limit', 50, 100)
  const refreshCooldownMinutes = numericOption(request, body, 'refresh_cooldown_minutes', 15, 24 * 60)
  const recentPublishedHours = numericOption(request, body, 'recent_published_hours', 72, 24 * 14)

  const youtubeRefresh = await runSocialCommentAttentionYouTubeRefresh(supabaseAdmin, {
    publishLimit,
    commentLimit,
    refreshCooldownMinutes,
    recentPublishedHours,
    force: requestedForce,
    dryRun,
    refreshPublishedYouTubeComments,
  })

  const slack = await runAgentSlackNotificationSweep({
    kinds: ['social_comment_attention_due'],
    mode: 'scheduled',
    dryRun: slackDryRun,
    force: slackForce,
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
    ok: youtubeRefresh.ok && slack.ok && holds.ok,
    dry_run: dryRun,
    slack_delivery_dry_run: slackDryRun,
    activation: {
      enabled: activationEnabled,
      disabled: activationDisabled,
      reason: activationDisabled
        ? 'activation_disabled_default_off'
        : dryRun
          ? 'manual_dry_run'
          : 'enabled',
      force_requested: requestedForce,
      force_applied: slackForce,
    },
    youtube_refresh: youtubeRefresh,
    slack,
    holds,
    side_effects: {
      slack_messages_sent: slack.sentCount,
      reply_hold_state_updated: !dryRun && holds.checkedCount > 0,
      provider_comment_read: !dryRun && youtubeRefresh.attemptedCount > 0,
      provider_generation: false,
      provider_refresh: !dryRun && youtubeRefresh.attemptedCount > 0,
      provider_reply_write: false,
      external_schedule: false,
      external_reply_send: false,
      external_post: false,
    },
  }, { status: youtubeRefresh.ok && slack.ok && holds.ok ? 200 : 500 })
}

export async function GET(request: NextRequest) {
  return runCommentAttentionSweep(request)
}

export async function POST(request: NextRequest) {
  return runCommentAttentionSweep(request)
}
