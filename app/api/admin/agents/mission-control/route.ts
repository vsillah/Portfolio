import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { buildAgentMissionControlSnapshot } from '@/lib/agent-mission-control'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/agents/mission-control
 *
 * Compact command-center snapshot for Agent Operations. This is a derived
 * read model over the existing run, event, artifact, approval, and cost tables.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const snapshot = await buildAgentMissionControlSnapshot()
    return NextResponse.json({ ok: true, ...snapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build mission control snapshot'
    const status = message === 'Database not available' ? 500 : 500
    console.error('[agent-mission-control] snapshot failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
