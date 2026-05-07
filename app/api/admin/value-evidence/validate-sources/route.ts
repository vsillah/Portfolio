import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  runBenchmarkValidation,
  runPainPointEvidenceValidation,
  PPE_MAX_ROWS,
  PROMPT_VERSION,
  JUDGE_VERSION,
} from '@/lib/source-validator'
import { endAgentRun, markAgentRunFailed, recordAgentStep, startAgentRun } from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

const VALID_TABLES = new Set(['industry_benchmarks', 'pain_point_evidence'])
const VALID_MODES = new Set(['stale', 'pending', 'forced', 'sample-audit'])

const MAX_LIMIT = 500

type Mode = 'stale' | 'pending' | 'forced' | 'sample-audit'

/**
 * POST /api/admin/value-evidence/validate-sources
 *
 * Body: {
 *   table?: 'industry_benchmarks' | 'pain_point_evidence',
 *   mode?: 'stale' | 'pending' | 'forced' | 'sample-audit',
 *   limit?: number,                  // default 100; hard cap 500
 *   staleDays?: number,              // default 30
 *   dryRun?: boolean,                // forces no-write; also defaults to true when mode='sample-audit'
 * }
 *
 * Returns the batch summary and per-row outcomes (up to `limit`).
 * `mode='sample-audit'` is always dry-run regardless of the dryRun flag.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // Empty body ok.
  }

  const table = (body.table as string | undefined) ?? 'industry_benchmarks'
  const mode = (body.mode as string | undefined) ?? 'stale'
  const rawLimit = Number(body.limit ?? 100)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 100, 1), MAX_LIMIT)
  const staleDays = Math.max(Number(body.staleDays ?? 30), 1)
  const bodyDryRun = body.dryRun === true
  const isSampleAudit = mode === 'sample-audit'
  const dryRun = bodyDryRun || isSampleAudit

  if (!VALID_TABLES.has(table)) {
    return NextResponse.json(
      { error: `Unsupported table "${table}". Supported: ${Array.from(VALID_TABLES).join(', ')}` },
      { status: 400 }
    )
  }
  if (!VALID_MODES.has(mode)) {
    return NextResponse.json(
      { error: `Invalid mode "${mode}". Expected one of: ${Array.from(VALID_MODES).join(', ')}` },
      { status: 400 }
    )
  }
  if (isSampleAudit && table !== 'pain_point_evidence') {
    return NextResponse.json(
      { error: 'mode="sample-audit" is only supported for pain_point_evidence.' },
      { status: 400 }
    )
  }

  let agentRunId: string | null = null

  try {
    if (table === 'pain_point_evidence') {
      // Sample-audit: smaller limit + force-pin Haiku regardless of body.
      // Per CTO guardrail: "Sample audit" must never become a footgun that
      // quietly runs Opus if a default changes or is overridden.
      const effectiveLimit = isSampleAudit ? Math.min(limit, 20) : limit
      const agentRun = await startAgentRun({
        agentKey: 'manual-admin',
        runtime: 'manual',
        kind: 'source_validation_pain_point_evidence',
        title: 'Validate pain point evidence sources',
        subject: {
          type: 'pain_point_evidence',
          id: `${mode}:${effectiveLimit}`,
          label: `${mode} validation (${effectiveLimit} row limit)`,
        },
        triggerSource: 'admin:value_evidence_validate_sources',
        triggeredByUserId: auth.user?.id ?? null,
        currentStep: 'Preparing source validation',
        metadata: {
          table,
          mode,
          limit: effectiveLimit,
          stale_days: staleDays,
          dry_run: dryRun,
          sample_audit: isSampleAudit,
        },
      })
      agentRunId = agentRun.id

      await recordAgentStep({
        runId: agentRunId,
        stepKey: 'source_validation_request_validated',
        name: 'Validated source validation request',
        status: 'completed',
        outputSummary: `${table} ${mode} run with ${effectiveLimit} row limit.`,
        metadata: {
          table,
          mode,
          limit: effectiveLimit,
          stale_days: staleDays,
          dry_run: dryRun,
        },
        idempotencyKey: `${agentRunId}:source_validation_request_validated`,
      })

      const judgeOpts = {
        ...(isSampleAudit ? { model: 'claude-3-5-haiku-20241022' } : {}),
        agentRunId,
        runtime: 'manual' as const,
        reference: { type: 'source_validation', id: agentRunId },
      }

      const { summary, items } = await runPainPointEvidenceValidation({
        mode: mode as Mode,
        limit: effectiveLimit,
        staleDays,
        triggeredBy: `admin:${auth.user?.id ?? 'unknown'}`,
        dryRun,
        judge: judgeOpts,
      })

      // Log run (unless pure sample audit — we don't persist those).
      if (!isSampleAudit) {
        await recordRun(summary).catch((err) => console.warn('recordRun failed:', err))
      }

      // Enrich each item with prompt_version so the drawer can cite which rubric
      // produced each verdict.
      const enrichedItems = items.map((it) => ({
        ...it,
        prompt_version: PROMPT_VERSION,
      }))

      await endAgentRun({
        runId: agentRunId,
        status: 'completed',
        currentStep: 'Source validation complete',
        outcome: {
          table,
          mode,
          attempted: summary.attempted ?? 0,
          validated: summary.validated ?? 0,
          rejected: summary.rejected ?? 0,
          quarantined: summary.quarantined ?? 0,
          errors: summary.errors ?? 0,
          llm_cost_usd: summary.llm_cost_usd ?? 0,
          dry_run: dryRun,
        },
      })

      return NextResponse.json({
        agentRunId,
        summary,
        items: enrichedItems,
        prompt_version: PROMPT_VERSION,
        validator_version: JUDGE_VERSION,
        judge_version: JUDGE_VERSION,
        model: isSampleAudit ? 'claude-3-5-haiku-20241022' : (judgeOpts?.model ?? 'claude-3-5-haiku-20241022'),
        cost_usd: summary.llm_cost_usd ?? 0,
      })
    }

    // industry_benchmarks
    const { summary, items } = await runBenchmarkValidation({
      mode: mode as 'stale' | 'pending' | 'forced',
      limit,
      staleDays,
    })
    await recordRun(summary).catch((err) => console.warn('recordRun failed:', err))
    return NextResponse.json({ summary, items })
  } catch (e) {
    const msg = (e as Error).message ?? 'unknown error'
    console.error('[validate-sources] batch error:', msg)
    if (agentRunId) {
      await recordAgentStep({
        runId: agentRunId,
        stepKey: 'source_validation_failed',
        name: 'Source validation failed',
        status: 'failed',
        outputSummary: msg,
        idempotencyKey: `${agentRunId}:source_validation_failed`,
      }).catch(() => {})
      await markAgentRunFailed(agentRunId, msg, {
        table,
        mode,
        operation: 'source_validator_llm_judge',
      }).catch(() => {})
    }
    if (/Estimated cost .*exceeds/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            'This source validation request is over the current Agent Ops budget limit. Lower the row limit or use sample-audit before retrying.',
          agentRunId,
        },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: 'Source validation run failed. See server logs for details.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/value-evidence/validate-sources?table=...
 *
 * Quick status snapshot for the given table. Defaults to industry_benchmarks.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table') ?? 'industry_benchmarks'
  if (!VALID_TABLES.has(table)) {
    return NextResponse.json({ error: `Unsupported table "${table}"` }, { status: 400 })
  }

  const { supabaseAdmin } = await import('@/lib/supabase')
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server Supabase client unavailable' }, { status: 500 })
  }

  if (table === 'pain_point_evidence') {
    const { data, error } = await supabaseAdmin
      .from('pain_point_evidence')
      .select(
        'source_validation_status, excerpt_faithfulness_status, excerpt_supported, excerpt_quantified, last_validated_at'
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const bySource: Record<string, number> = { pending: 0, validated: 0, quarantined: 0, rejected: 0 }
    const byExcerpt: Record<string, number> = { pending: 0, faithful: 0, unfaithful: 0, insufficient: 0 }
    let usable = 0
    let blocked = 0
    let lastValidatedAt: string | null = null
    for (const row of (data ?? []) as Array<{
      source_validation_status: string | null
      excerpt_faithfulness_status: string | null
      last_validated_at: string | null
    }>) {
      const s = row.source_validation_status ?? 'pending'
      const e = row.excerpt_faithfulness_status ?? 'pending'
      bySource[s] = (bySource[s] ?? 0) + 1
      byExcerpt[e] = (byExcerpt[e] ?? 0) + 1
      if ((s === 'validated' || s === 'quarantined') && e === 'faithful') usable += 1
      if (s === 'rejected' || e === 'unfaithful') blocked += 1
      if (row.last_validated_at && (!lastValidatedAt || row.last_validated_at > lastValidatedAt)) {
        lastValidatedAt = row.last_validated_at
      }
    }
    return NextResponse.json({
      table,
      total: data?.length ?? 0,
      by_source: bySource,
      by_excerpt: byExcerpt,
      usable,
      blocked,
      last_validated_at: lastValidatedAt,
      prompt_version: PROMPT_VERSION,
      validator_version: JUDGE_VERSION,
    })
  }

  // industry_benchmarks (Phase 1 behavior preserved)
  const { data: statusRows, error: statusErr } = await supabaseAdmin
    .from('industry_benchmarks')
    .select('validation_status, trust_tier, last_validated_at')

  if (statusErr) {
    return NextResponse.json({ error: statusErr.message }, { status: 500 })
  }

  const byStatus: Record<string, number> = { pending: 0, validated: 0, rejected: 0, quarantined: 0 }
  const byTier: Record<string, number> = { unknown: 0, t1: 0, t2: 0, t3: 0, t4: 0, t5: 0 }
  let lastValidatedAt: string | null = null

  for (const row of (statusRows ?? []) as Array<{
    validation_status: string | null
    trust_tier: number | null
    last_validated_at: string | null
  }>) {
    const s = row.validation_status ?? 'pending'
    byStatus[s] = (byStatus[s] ?? 0) + 1
    const t = row.trust_tier
    if (t == null) byTier.unknown += 1
    else byTier[`t${t}`] = (byTier[`t${t}`] ?? 0) + 1
    if (row.last_validated_at && (!lastValidatedAt || row.last_validated_at > lastValidatedAt)) {
      lastValidatedAt = row.last_validated_at
    }
  }

  return NextResponse.json({
    table: 'industry_benchmarks',
    total: statusRows?.length ?? 0,
    by_status: byStatus,
    by_tier: byTier,
    last_validated_at: lastValidatedAt,
  })
}

// -----------------------------------------------------------------------------
// Run logger — writes one source_validation_runs row per persisted invocation.
// Failures here are logged but never surfaced to the admin (the batch itself
// already succeeded).
// -----------------------------------------------------------------------------

type RunSummaryLike = {
  table?: string
  mode?: string
  validator_version?: string
  prompt_version?: string
  attempted?: number
  validated?: number
  rejected?: number
  quarantined?: number
  errors?: number
  faithful?: number
  unfaithful?: number
  insufficient?: number
  llm_tokens_in?: number
  llm_tokens_out?: number
  llm_cost_usd?: number
  duration_ms?: number
  dry_run?: boolean
  triggered_by?: string | null
}

async function recordRun(summary: RunSummaryLike): Promise<void> {
  const { supabaseAdmin } = await import('@/lib/supabase')
  if (!supabaseAdmin) return
  const row: Record<string, unknown> = {
    table_name: summary.table ?? 'unknown',
    mode: summary.mode ?? 'unknown',
    validator_version: summary.validator_version ?? 'unknown',
    prompt_version: summary.prompt_version ?? null,
    attempted: summary.attempted ?? 0,
    validated: summary.validated ?? 0,
    rejected: summary.rejected ?? 0,
    quarantined: summary.quarantined ?? 0,
    errors: summary.errors ?? 0,
    duration_ms: summary.duration_ms ?? 0,
    dry_run: summary.dry_run ?? false,
    triggered_by: summary.triggered_by ?? null,
  }
  if (summary.table === 'pain_point_evidence') {
    row.faithful = summary.faithful ?? 0
    row.unfaithful = summary.unfaithful ?? 0
    row.insufficient = summary.insufficient ?? 0
    row.llm_tokens_in = summary.llm_tokens_in ?? 0
    row.llm_tokens_out = summary.llm_tokens_out ?? 0
    row.llm_cost_usd = summary.llm_cost_usd ?? 0
  }
  const { error } = await supabaseAdmin.from('source_validation_runs').insert(row)
  if (error) console.warn('[validate-sources] source_validation_runs insert failed:', error.message)
}
