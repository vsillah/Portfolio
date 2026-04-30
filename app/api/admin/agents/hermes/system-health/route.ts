import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { attachAgentArtifact, endAgentRun, markAgentRunFailed, recordAgentStep, startAgentRun } from '@/lib/agent-run'
import { buildHermesSystemHealthSummary } from '@/lib/hermes-system-health'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/agents/hermes/system-health
 *
 * Read-only Hermes bridge slice. This records the work as a Hermes runtime run
 * without granting Hermes write access to production data.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let runId: string | null = null

  try {
    const run = await startAgentRun({
      agentKey: 'hermes-secondary',
      runtime: 'hermes',
      kind: 'system_health_summary',
      title: 'Generate system health summary',
      subject: { type: 'system', id: 'portfolio', label: 'Portfolio operations' },
      triggerSource: 'admin_hermes_system_health',
      triggeredByUserId: auth.user.id,
      currentStep: 'Collecting read-only health signals',
      metadata: {
        execution_mode: 'bridge_read_only',
        production_mutation_allowed: false,
        requires_approval_for_writes: true,
      },
      idempotencyKey: `hermes:system-health:${new Date().toISOString().slice(0, 16)}`,
    })
    runId = run.id

    await recordAgentStep({
      runId,
      stepKey: 'collect_health_signals',
      name: 'Collected read-only health signals',
      status: 'completed',
      inputSummary: 'Database, n8n runtime flags, recent agent runs, costs, and workflow status snapshots.',
      idempotencyKey: `${runId}:collect`,
    })

    const summary = await buildHermesSystemHealthSummary()

    await recordAgentStep({
      runId,
      stepKey: 'summarize_health',
      name: 'Summarized system health',
      status: 'completed',
      outputSummary: `Overall: ${summary.overall}; warnings: ${summary.warnings.length}`,
      metadata: {
        overall: summary.overall,
        warnings: summary.warnings,
      },
      idempotencyKey: `${runId}:summary`,
    })

    await attachAgentArtifact({
      runId,
      artifactType: 'system_health_summary',
      title: `System health summary - ${summary.overall}`,
      refType: 'agent_run',
      refId: runId,
      metadata: {
        summary_markdown: summary.summaryMarkdown,
        signals: summary.signals,
        warnings: summary.warnings,
      },
      idempotencyKey: `${runId}:artifact:system-health`,
    })

    await endAgentRun({
      runId,
      status: summary.overall === 'error' ? 'failed' : 'completed',
      currentStep: 'System health summary ready',
      errorMessage: summary.overall === 'error' ? summary.warnings[0] ?? 'System health summary failed' : null,
      outcome: {
        overall: summary.overall,
        warning_count: summary.warnings.length,
        generated_at: summary.generatedAt,
      },
    })

    return NextResponse.json({
      ok: summary.overall !== 'error',
      run_id: runId,
      overall: summary.overall,
      warnings: summary.warnings,
      summary_markdown: summary.summaryMarkdown,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (runId) {
      await markAgentRunFailed(runId, message, { bridge: 'hermes_system_health' }).catch(() => {})
    }
    console.error('[hermes-system-health] failed:', error)
    return NextResponse.json({ error: message, run_id: runId }, { status: 500 })
  }
}
