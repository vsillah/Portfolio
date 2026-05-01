/**
 * POST /api/cron/agent-ops-morning-review
 *
 * Runs the daily Agent Operations review without a human in the loop.
 * Auth: Bearer N8N_INGEST_SECRET, matching the existing n8n-owned cron pattern.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runAgentOpsMorningReview } from '@/lib/agent-ops-morning-review'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.N8N_INGEST_SECRET
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return Boolean(expectedSecret && token === expectedSecret)
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAgentOpsMorningReview('cron_agent_ops_morning_review')
    return NextResponse.json({
      ok: result.overall !== 'error',
      run_id: result.runId,
      overall: result.overall,
      stale_sweep: result.staleSweep,
      slack_notified: result.slackNotified,
      warnings: result.health.warnings,
      summary_markdown: result.summaryMarkdown,
    })
  } catch (error) {
    console.error('[agent-ops-morning-review] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent Ops morning review failed' },
      { status: 500 },
    )
  }
}
