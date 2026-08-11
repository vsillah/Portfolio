/**
 * GET/POST /api/cron/agent-ops-morning-review
 *
 * Runs the daily Agent Operations review without a human in the loop.
 * Auth: Bearer CRON_SECRET or N8N_INGEST_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runAgentOpsMorningReview } from '@/lib/agent-ops-morning-review'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const allowedTokens = [process.env.CRON_SECRET, process.env.N8N_INGEST_SECRET].filter(Boolean)
  return Boolean(token && allowedTokens.includes(token))
}

async function runMorningReview(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  return runMorningReview(request)
}

export async function POST(request: NextRequest) {
  return runMorningReview(request)
}
