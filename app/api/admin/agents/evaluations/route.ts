import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getAgentQualitySummary } from '@/lib/agent-evaluations'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/agents/evaluations
 *
 * Returns rubric-backed quality signals for Mission Control.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const url = new URL(request.url)
    const agentKey = url.searchParams.get('agent_key')?.trim() || undefined
    const windowHoursValue = Number(url.searchParams.get('window_hours') ?? 24)
    const windowHours = Number.isFinite(windowHoursValue) && windowHoursValue > 0 ? windowHoursValue : 24
    const summary = await getAgentQualitySummary({ agentKey, windowHours })
    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load agent evaluations'
    console.error('[agent-evaluations] list failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
