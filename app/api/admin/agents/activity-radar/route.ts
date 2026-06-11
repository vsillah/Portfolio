import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { buildAgentActivityRadarSnapshot } from '@/lib/agent-activity-radar'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/agents/activity-radar
 *
 * Read-only Agent Ops projection for point-in-time visibility and governed
 * soft steering. This route does not execute agent work or mutate queues.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const snapshot = await buildAgentActivityRadarSnapshot()
    return NextResponse.json({ ok: true, ...snapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build agent activity radar'
    console.error('[agent-activity-radar] snapshot failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
