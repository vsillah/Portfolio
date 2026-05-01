import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { sweepStaleAgentRuns } from '@/lib/agent-stale-runs'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/agents/runs/stale-sweep
 *
 * Marks queued/running agent runs as stale when they exceed stale_after or the
 * default active-run threshold. Approval waits are intentionally excluded.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const result = await sweepStaleAgentRuns()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[agent-runs] stale sweep failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sweep stale agent runs' },
      { status: 500 },
    )
  }
}
