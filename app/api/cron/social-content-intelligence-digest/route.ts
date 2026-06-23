/**
 * GET/POST /api/cron/social-content-intelligence-digest
 *
 * Builds the Social Content Intelligence daily digest and, once explicitly
 * activated, creates a Shaka review work item in the Agentic Dashboard.
 * Auth: Bearer CRON_SECRET or N8N_INGEST_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import {
  buildSocialContentDailyDigest,
  type SocialContentDailyDigest,
} from '@/lib/social-content-daily-digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MANUAL_CONFIRMATION = 'run_social_intelligence_daily_digest'

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const allowedTokens = [process.env.CRON_SECRET, process.env.N8N_INGEST_SECRET].filter(Boolean)
  return Boolean(token && allowedTokens.includes(token))
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asPositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

async function parseBody(request: NextRequest) {
  if (request.method !== 'POST') return {}
  try {
    return asRecord(await request.json())
  } catch {
    return {}
  }
}

function activationEnabled() {
  return process.env.SOCIAL_CONTENT_INTELLIGENCE_DAILY_DIGEST_ENABLED === 'true'
}

function runDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

function bulletList(values: string[]) {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : '- None'
}

function digestObjective(digest: SocialContentDailyDigest) {
  const patterns = digest.strongest_patterns
    .slice(0, 3)
    .map((pattern) => `${pattern.title} (${pattern.platform}, score ${pattern.outlier_score})`)
  const insights = digest.recommended_insights
    .slice(0, 3)
    .map((insight) => `${insight.title} (${insight.sensitivity})`)
  const lanes = digest.suggested_channel_lanes
    .slice(0, 4)
    .map((lane) => `${lane.label}: ${lane.status} for ${lane.insight_title}`)
  const blockers = digest.blocked_or_sensitive_items
    .slice(0, 4)
    .map((item) => `${item.title}: ${item.reason}`)

  return [
    'Review the daily Social Content Intelligence digest for Shaka.',
    '',
    `Lookback window: ${digest.lookback_days} day(s).`,
    `New research packets: ${digest.summary.new_research_packets}.`,
    `Usable public patterns: ${digest.summary.usable_patterns}.`,
    `Shaka insight triggers: ${digest.summary.shaka_insights}.`,
    `Blocked/privacy-sensitive items: ${digest.summary.blocked_or_sensitive_items}.`,
    '',
    'Strongest reusable patterns:',
    bulletList(patterns),
    '',
    'Recommended Shaka insights:',
    bulletList(insights),
    '',
    'Suggested channel lanes:',
    bulletList(lanes),
    '',
    'Privacy/source blockers:',
    bulletList(blockers),
    '',
    'Approval boundary: this digest only creates an internal Agentic Dashboard review item. It does not run Apify, generate drafts, generate media, upload assets, schedule posts, publish, or create external posts.',
  ].join('\n')
}

async function createDigestReviewWorkItem(input: {
  digest: SocialContentDailyDigest
  triggerSource: string
  actorLabel: string
}) {
  const dateKey = runDateKey()
  const blockers = input.digest.summary.blocked_or_sensitive_items
  return createAgentWorkItem({
    title: `Review Social Content Intelligence daily digest (${dateKey})`,
    objective: digestObjective(input.digest),
    priority: blockers > 0 ? 'high' : 'medium',
    status: 'queued',
    ownerAgentKey: 'chief-of-staff',
    ownerRuntime: 'codex',
    source: {
      type: 'social_intelligence_daily_digest',
      id: dateKey,
      label: 'Social Content Intelligence daily digest',
    },
    metadata: {
      digest: input.digest,
      trigger_source: input.triggerSource,
      actor_label: input.actorLabel,
      run_date: dateKey,
      activation: {
        enabled: activationEnabled(),
        manual_confirmation_required_when_disabled: MANUAL_CONFIRMATION,
      },
      side_effects: {
        internal_work_item_created: true,
        apify_run: false,
        provider_generation: false,
        upload: false,
        schedule: false,
        publish: false,
        external_post: false,
      },
    },
    idempotencyKey: `social-intelligence-daily-digest:${dateKey}:${input.digest.lookback_days}`,
  })
}

async function runDigest(request: NextRequest, body: Record<string, unknown>) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const lookbackDays = asPositiveInteger(body.lookback_days ?? searchParams.get('lookback_days'), 5, 30)
  const limit = asPositiveInteger(body.limit ?? searchParams.get('limit'), 12, 25)
  const dryRun = body.dry_run === true || searchParams.get('dry_run') === '1'
  const manualConfirmed = request.method === 'POST' && asString(body.confirmation) === MANUAL_CONFIRMATION
  const enabled = activationEnabled()
  const shouldCreateWorkItem = !dryRun && (enabled || manualConfirmed)

  try {
    const digest = await buildSocialContentDailyDigest({ lookbackDays, limit })
    const workItem = shouldCreateWorkItem
      ? await createDigestReviewWorkItem({
        digest,
        triggerSource: request.method === 'GET'
          ? 'vercel_cron_social_content_intelligence_digest'
          : 'manual_social_content_intelligence_digest',
        actorLabel: request.method === 'GET' ? 'Vercel cron' : 'Manual cron trigger',
      })
      : null

    return NextResponse.json({
      ok: true,
      digest,
      activation: {
        enabled,
        manual_confirmed: manualConfirmed,
        executed: Boolean(workItem),
        disabled_reason: !shouldCreateWorkItem
          ? 'SOCIAL_CONTENT_INTELLIGENCE_DAILY_DIGEST_ENABLED is not true and no manual confirmation was provided.'
          : null,
        manual_confirmation: MANUAL_CONFIRMATION,
      },
      work_item: workItem,
      side_effects: {
        internal_work_item_created: Boolean(workItem),
        apify_run: false,
        provider_generation: false,
        upload: false,
        schedule: false,
        publish: false,
        external_post: false,
      },
    })
  } catch (error) {
    console.error('[social-content-intelligence-digest-cron] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Social Content Intelligence digest failed' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return runDigest(request, {})
}

export async function POST(request: NextRequest) {
  return runDigest(request, await parseBody(request))
}
