import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentQualitySummary } from '@/lib/agent-evaluations'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/agents/evaluations/:agentKey
 *
 * Returns quality trends and coaching signals for one agent.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { agentKey: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const agentKey = params.agentKey?.trim()
  if (!agentKey) {
    return NextResponse.json({ error: 'agentKey is required' }, { status: 400 })
  }

  try {
    const url = new URL(request.url)
    const windowHoursValue = Number(url.searchParams.get('window_hours') ?? 24)
    const windowHours = Number.isFinite(windowHoursValue) && windowHoursValue > 0 ? windowHoursValue : 24
    const summary = await getAgentQualitySummary({ agentKey, windowHours })
    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load agent evaluation detail'
    console.error('[agent-evaluations] detail failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
