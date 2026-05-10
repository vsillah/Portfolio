import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { buildAgentOrgBoardSnapshot, buildAgentSwarmBoardSnapshot } from '@/lib/agent-swarm-board'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/agents/swarm-board
 *
 * Derived cross-client board for ATAS Agent Org handoffs. V1 reads existing
 * Agent Ops, approval, and Client AI Ops roadmap tables; it does not create a
 * new queue table or mutate client/provider state.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const [snapshot, organization] = await Promise.all([
      buildAgentSwarmBoardSnapshot(),
      buildAgentOrgBoardSnapshot(),
    ])
    return NextResponse.json({ ok: true, ...snapshot, organization })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build agent swarm board'
    console.error('[agent-swarm-board] snapshot failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
