import { NextRequest, NextResponse } from 'next/server'
import { runAgentOpsMorningReview } from '@/lib/agent-ops-morning-review'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/agents/morning-review
 *
 * Admin-owned manual trigger for the Agent Operations morning review. The
 * n8n cron route remains the no-human scheduled path; this route gives the
 * admin console a safe on-demand engagement point with the same traced run.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const result = await runAgentOpsMorningReview('admin_agent_ops_morning_review')
    return NextResponse.json({
      ok: result.overall !== 'error',
      run_id: result.runId,
      overall: result.overall,
      stale_sweep: result.staleSweep,
      slack_notified: result.slackNotified,
      warnings: result.health.warnings,
      summary_markdown: result.summaryMarkdown,
      triggered_by_user_id: auth.user.id,
    })
  } catch (error) {
    console.error('[admin-agent-ops-morning-review] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent Ops morning review failed' },
      { status: 500 },
    )
  }
}
