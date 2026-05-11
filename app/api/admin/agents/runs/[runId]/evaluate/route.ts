import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { evaluateAgentRun } from '@/lib/agent-evaluations'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/agents/runs/:runId/evaluate
 *
 * Scores an existing run against a stored rubric and writes a trace-linked
 * evaluation. This never mutates prompts, skills, n8n workflows, or Slack.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as {
    rubric_key?: string
  }
  const rubricKey = body.rubric_key?.trim()
  if (!params.runId?.trim()) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 })
  }
  if (!rubricKey) {
    return NextResponse.json({ error: 'rubric_key is required' }, { status: 400 })
  }

  try {
    const evaluation = await evaluateAgentRun(params.runId, rubricKey)
    return NextResponse.json({ ok: true, evaluation })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to evaluate agent run'
    if (message === 'Agent run not found' || message === 'Evaluation rubric not found') {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('required') || message.includes('threshold')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('[agent-evaluations] run evaluation failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
