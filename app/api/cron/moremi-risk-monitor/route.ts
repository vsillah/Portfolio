/**
 * GET/POST /api/cron/moremi-risk-monitor
 *
 * Runs Moremi's scheduled read-only AI risk signal monitor.
 * Auth: Bearer CRON_SECRET or N8N_INGEST_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runMoremiRiskSignalMonitor } from '@/lib/moremi-risk-signal-monitor'

export const dynamic = 'force-dynamic'

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const allowedTokens = [process.env.CRON_SECRET, process.env.N8N_INGEST_SECRET].filter(Boolean)
  return Boolean(token && allowedTokens.includes(token))
}

async function runMonitor(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runMoremiRiskSignalMonitor(
      request.method === 'GET' ? 'vercel_cron_moremi_risk_monitor' : 'manual_cron_moremi_risk_monitor',
    )

    return NextResponse.json({
      ok: true,
      run_id: result.runId,
      overall: result.overall,
      enabled_source_feed_count: result.enabledSourceFeedCount,
      disabled_source_feed_count: result.disabledSourceFeedCount,
      warnings: result.warnings,
      summary_markdown: result.summaryMarkdown,
      side_effects: {
        work_items_created: false,
        production_mutation_allowed: false,
        live_external_fetch: false,
        client_data_access: false,
      },
    })
  } catch (error) {
    console.error('[moremi-risk-monitor] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Moremi AI risk signal monitor failed' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return runMonitor(request)
}

export async function POST(request: NextRequest) {
  return runMonitor(request)
}
