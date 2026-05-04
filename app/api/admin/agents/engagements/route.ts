import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { AGENT_ORGANIZATION } from '@/lib/agent-organization'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type EngagementRunRow = {
  id: string
  agent_key: string | null
  status: string
  current_step: string | null
  started_at: string
  completed_at: string | null
  metadata: Record<string, unknown> | null
}

export type AgentEngagementStatus = {
  agent_key: string
  run_id: string | null
  status: string | null
  current_step: string | null
  started_at: string | null
  completed_at: string | null
  execution_mode: string | null
}

function executionMode(row: EngagementRunRow | undefined) {
  const explicitMode = row?.metadata?.execution_mode
  if (typeof explicitMode === 'string') return explicitMode

  const executesAction = row?.metadata?.executes_action
  if (typeof executesAction === 'boolean') {
    return executesAction ? 'action' : 'read_only'
  }

  return null
}

function requestedAgentKey(row: EngagementRunRow) {
  const requested = row.metadata?.requested_agent
  return typeof requested === 'string' && requested.trim() ? requested.trim() : row.agent_key
}

/**
 * GET /api/admin/agents/engagements
 *
 * Returns the latest traced engagement request for each mapped agent. This is
 * read-only status for the admin roster; it does not execute agents.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .select('id, agent_key, status, current_step, started_at, completed_at, metadata')
    .eq('kind', 'agent_engagement_request')
    .order('started_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[agent-engagements] list failed:', error)
    return NextResponse.json({ error: 'Failed to fetch agent engagements' }, { status: 500 })
  }

  const latestByAgent = new Map<string, EngagementRunRow>()
  for (const row of (data ?? []) as EngagementRunRow[]) {
    const agentKey = requestedAgentKey(row)
    if (!agentKey || latestByAgent.has(agentKey)) continue
    latestByAgent.set(agentKey, row)
  }

  const engagements: AgentEngagementStatus[] = AGENT_ORGANIZATION.map((agent) => {
    const latest = latestByAgent.get(agent.key)
    return {
      agent_key: agent.key,
      run_id: latest?.id ?? null,
      status: latest?.status ?? null,
      current_step: latest?.current_step ?? null,
      started_at: latest?.started_at ?? null,
      completed_at: latest?.completed_at ?? null,
      execution_mode: executionMode(latest),
    }
  })

  return NextResponse.json({ engagements })
}
