import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { AGENT_DECISION_TRUST_EVENT } from '@/lib/agent-decision-trust'
import { parseDecisionTrustFrames, type GovernanceEventSummary } from '@/lib/agent-governance'
import { getOpenBrainSnapshot } from '@/lib/open-brain'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const decisionTrustFrames = await loadDecisionTrustFrames()
  const snapshot = decisionTrustFrames.length
    ? await getOpenBrainSnapshot(undefined, { decisionTrustFrames })
    : await getOpenBrainSnapshot()
  return NextResponse.json(snapshot)
}

async function loadDecisionTrustFrames() {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    if (!supabaseAdmin) return []
    const { data, error } = await supabaseAdmin
      .from('agent_run_events')
      .select('run_id, event_type, severity, message, occurred_at, metadata')
      .eq('event_type', AGENT_DECISION_TRUST_EVENT)
      .order('occurred_at', { ascending: false })
      .limit(25)

    if (error) {
      console.warn('[open-brain] decision trust projection unavailable:', error.message)
      return []
    }

    return parseDecisionTrustFrames((data ?? []) as GovernanceEventSummary[], 25)
  } catch (error) {
    console.warn('[open-brain] decision trust projection skipped:', error)
    return []
  }
}
