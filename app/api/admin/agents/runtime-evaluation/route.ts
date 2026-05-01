import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  attachAgentArtifact,
  endAgentRun,
  markAgentRunFailed,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import { evaluateRuntimeAvailability } from '@/lib/agent-runtime-evaluation'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/agents/runtime-evaluation
 *
 * Creates an observable, side-effect-free evaluation trace for deferred worker
 * runtimes. v1 intentionally probes availability only; it does not execute
 * arbitrary worker tasks.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as { runtime?: string }
  const runtime = body.runtime ?? 'opencode'
  if (runtime !== 'opencode') {
    return NextResponse.json({ error: 'Unsupported runtime evaluation target' }, { status: 400 })
  }

  const run = await startAgentRun({
    agentKey: 'opencode-evaluation',
    runtime: 'opencode',
    kind: 'runtime_evaluation',
    title: 'Evaluate OpenCode/OpenClaw runtime',
    subject: { type: 'runtime', id: 'opencode', label: 'OpenCode/OpenClaw' },
    triggerSource: 'admin_runtime_evaluation',
    triggeredByUserId: auth.user.id,
    currentStep: 'Checking runtime availability',
    metadata: {
      side_effects_allowed: false,
      production_mutation_allowed: false,
      execution_mode: 'availability_probe',
    },
    idempotencyKey: `runtime-evaluation:${runtime}:${auth.user.id}:${Date.now()}`,
  })

  try {
    const evaluation = await evaluateRuntimeAvailability('opencode')

    await recordAgentStep({
      runId: run.id,
      stepKey: 'availability_probe',
      name: 'Checked OpenCode/OpenClaw command availability',
      status: evaluation.available ? 'completed' : 'failed',
      inputSummary: 'Checked PATH for opencode, openclaw, and opencode-ai commands.',
      outputSummary: evaluation.available
        ? `Available at ${evaluation.executable}`
        : 'No OpenCode/OpenClaw command found.',
      metadata: evaluation,
      idempotencyKey: `${run.id}:availability-probe`,
    })

    await attachAgentArtifact({
      runId: run.id,
      artifactType: 'runtime_evaluation',
      title: 'OpenCode/OpenClaw Runtime Evaluation',
      refType: 'runtime',
      refId: 'opencode',
      metadata: evaluation,
      idempotencyKey: `${run.id}:artifact:runtime-evaluation`,
    })

    if (!evaluation.available) {
      await markAgentRunFailed(run.id, 'OpenCode/OpenClaw command not installed or not on PATH', {
        runtime: 'opencode',
        available: false,
        next_steps: evaluation.nextSteps,
      })
      return NextResponse.json({
        ok: false,
        run_id: run.id,
        runtime: 'opencode',
        available: false,
        next_steps: evaluation.nextSteps,
      })
    }

    await endAgentRun({
      runId: run.id,
      status: 'completed',
      currentStep: 'Runtime availability confirmed',
      outcome: {
        runtime: 'opencode',
        available: true,
        executable: evaluation.executable,
        safe_for_production_automation: false,
      },
    })

    return NextResponse.json({
      ok: true,
      run_id: run.id,
      runtime: 'opencode',
      available: true,
      executable: evaluation.executable,
      next_steps: evaluation.nextSteps,
    })
  } catch (error) {
    await markAgentRunFailed(run.id, error instanceof Error ? error.message : 'Runtime evaluation failed')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Runtime evaluation failed', run_id: run.id },
      { status: 500 },
    )
  }
}
