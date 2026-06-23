import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { createAgentWorkItem } from '@/lib/agent-work-items'

export const dynamic = 'force-dynamic'

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

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const body = asRecord(await request.json().catch(() => ({})))
  const cadence = asString(body.cadence) || 'daily'
  if (cadence !== 'daily') {
    return NextResponse.json({ error: 'Only daily cadence is supported for this activation request' }, { status: 400 })
  }
  const lookbackDays = asPositiveInteger(body.lookback_days, 5, 30)
  const scopeNote = asString(body.scope_note)

  try {
    const workItem = await createAgentWorkItem({
      title: 'Approve daily Social Content Intelligence digest activation',
      objective: [
        `Review whether Shaka should run a ${cadence} Social Content Intelligence digest.`,
        `Default lookback window: ${lookbackDays} day(s).`,
        'Scope: summarize public creator research, Shaka internal insight triggers, suggested channel lanes, thumbnail opportunities, and privacy blockers into the Agentic Dashboard.',
        'Approval boundary: this work item does not activate cron, run Apify, generate drafts, generate media, upload assets, schedule posts, or publish externally.',
        scopeNote ? `Operator note: ${scopeNote}` : null,
      ].filter(Boolean).join('\n'),
      priority: 'high',
      status: 'queued',
      ownerAgentKey: 'chief-of-staff',
      ownerRuntime: 'codex',
      source: {
        type: 'social_intelligence_daily_digest_activation',
        id: 'daily-social-content-intelligence',
        label: 'Content Intelligence daily digest activation review',
      },
      metadata: {
        requested_by_user_id: authResult.user.id,
        requested_by_email: authResult.user.email ?? null,
        cadence,
        lookback_days: lookbackDays,
        scope_note: scopeNote || null,
        activation_boundary: {
          schedule_activation: 'approval_required',
          apify_collection: 'approval_required',
          drafting: 'approval_required',
          media_generation: 'approval_required',
          uploads: 'approval_required',
          publishing: 'approval_required',
        },
        side_effects: {
          cron_activated: false,
          apify_run: false,
          provider_generation: false,
          upload: false,
          schedule: false,
          publish: false,
          external_post: false,
        },
      },
      idempotencyKey: `social-intelligence-daily-digest-activation:${cadence}:${lookbackDays}`,
    })

    return NextResponse.json({
      ok: true,
      work_item: workItem,
      activation_requested: true,
      activation_executed: false,
      side_effects: {
        cron_activated: false,
        apify_run: false,
        provider_generation: false,
        upload: false,
        schedule: false,
        publish: false,
        external_post: false,
      },
    })
  } catch (error) {
    console.error('[social-content-intelligence] activation request failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to request daily digest activation review' },
      { status: 500 },
    )
  }
}
