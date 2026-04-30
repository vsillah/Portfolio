import { describeN8nRuntimeFlags } from '@/lib/n8n-runtime-flags'
import { supabaseAdmin } from '@/lib/supabase'

type QueryResult<T> = {
  ok: boolean
  data: T
  error?: string
}

type AgentRunHealthRow = {
  id: string
  runtime: string
  kind: string
  status: string
  error_message: string | null
  started_at: string
}

type WorkflowHealthRow = {
  id: string
  status: string
  error_message?: string | null
  completed_at?: string | null
  triggered_at?: string | null
}

export type HermesSystemHealthSummary = {
  generatedAt: string
  overall: 'ok' | 'warning' | 'error'
  summaryMarkdown: string
  signals: {
    database: 'connected' | 'unavailable'
    n8n: {
      deploymentTier: string
      mockEnabled: boolean
      outboundDisabled: boolean
    }
    agentRuns24h: {
      total: number
      failed: number
      stale: number
      running: number
      byRuntime: Record<string, number>
    }
    costs24h: {
      totalUsd: number
      events: number
    }
    workflows: {
      socialContent: QueryResult<WorkflowHealthRow[]>
      valueEvidence: QueryResult<WorkflowHealthRow[]>
      warmLeads: QueryResult<WorkflowHealthRow[]>
    }
  }
  warnings: string[]
}

async function safeQuery<T>(label: string, query: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<QueryResult<T | null>> {
  try {
    const { data, error } = await query
    if (error) {
      return { ok: false, data: null, error: `${label}: ${error.message}` }
    }
    return { ok: true, data }
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: `${label}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

function countByRuntime(rows: AgentRunHealthRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.runtime] = (acc[row.runtime] ?? 0) + 1
    return acc
  }, {})
}

function statusLine(label: string, result: QueryResult<WorkflowHealthRow[]>) {
  if (!result.ok) return `- ${label}: unavailable (${result.error})`
  const rows = result.data
  if (rows.length === 0) return `- ${label}: no recent runs`
  const failed = rows.filter((row) => row.status === 'failed').length
  const running = rows.filter((row) => row.status === 'running').length
  return `- ${label}: ${rows.length} recent, ${running} running, ${failed} failed`
}

export async function buildHermesSystemHealthSummary(): Promise<HermesSystemHealthSummary> {
  const generatedAt = new Date().toISOString()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const n8nFlags = describeN8nRuntimeFlags()

  if (!supabaseAdmin) {
    return {
      generatedAt,
      overall: 'error',
      summaryMarkdown: [
        '# Hermes System Health Summary',
        '',
        'Database client is unavailable, so no operational checks could run.',
      ].join('\n'),
      signals: {
        database: 'unavailable',
        n8n: {
          deploymentTier: n8nFlags.tier,
          mockEnabled: n8nFlags.mockN8n.effective,
          outboundDisabled: n8nFlags.disableOutbound.effective,
        },
        agentRuns24h: { total: 0, failed: 0, stale: 0, running: 0, byRuntime: {} },
        costs24h: { totalUsd: 0, events: 0 },
        workflows: {
          socialContent: { ok: false, data: [], error: 'Database client unavailable' },
          valueEvidence: { ok: false, data: [], error: 'Database client unavailable' },
          warmLeads: { ok: false, data: [], error: 'Database client unavailable' },
        },
      },
      warnings: ['Database client unavailable'],
    }
  }

  const [dbProbe, agentRunsResult, costsResult, socialRunsResult, valueRunsResult, warmRunsResult] = await Promise.all([
    safeQuery('database probe', supabaseAdmin.from('site_settings').select('id').limit(1).maybeSingle()),
    safeQuery<AgentRunHealthRow[]>(
      'agent_runs',
      supabaseAdmin
        .from('agent_runs')
        .select('id, runtime, kind, status, error_message, started_at')
        .gte('started_at', since24h)
        .order('started_at', { ascending: false })
        .limit(100),
    ),
    safeQuery<Array<{ amount: number | string | null }>>(
      'cost_events',
      supabaseAdmin
        .from('cost_events')
        .select('amount')
        .gte('occurred_at', since24h)
        .limit(500),
    ),
    safeQuery<WorkflowHealthRow[]>(
      'social_content_extraction_runs',
      supabaseAdmin
        .from('social_content_extraction_runs')
        .select('id, status, error_message, completed_at, triggered_at')
        .order('triggered_at', { ascending: false })
        .limit(10),
    ),
    safeQuery<WorkflowHealthRow[]>(
      'value_evidence_workflow_runs',
      supabaseAdmin
        .from('value_evidence_workflow_runs')
        .select('id, status, error_message, completed_at, triggered_at')
        .order('triggered_at', { ascending: false })
        .limit(10),
    ),
    safeQuery<WorkflowHealthRow[]>(
      'warm_lead_trigger_audit',
      supabaseAdmin
        .from('warm_lead_trigger_audit')
        .select('id, status, error_message, completed_at, triggered_at')
        .order('triggered_at', { ascending: false })
        .limit(10),
    ),
  ])

  const agentRuns = agentRunsResult.ok && agentRunsResult.data ? agentRunsResult.data : []
  const costs = costsResult.ok && costsResult.data ? costsResult.data : []
  const failed = agentRuns.filter((row) => row.status === 'failed').length
  const stale = agentRuns.filter((row) => row.status === 'stale').length
  const running = agentRuns.filter((row) => row.status === 'running' || row.status === 'queued').length
  const totalUsd = costs.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

  const warnings = [
    !dbProbe.ok ? 'Database probe failed' : null,
    n8nFlags.mockN8n.effective ? 'MOCK_N8N is enabled' : null,
    n8nFlags.disableOutbound.effective ? 'N8N outbound calls are disabled' : null,
    failed > 0 ? `${failed} agent run(s) failed in the last 24 hours` : null,
    stale > 0 ? `${stale} agent run(s) stale in the last 24 hours` : null,
    !socialRunsResult.ok ? socialRunsResult.error : null,
    !valueRunsResult.ok ? valueRunsResult.error : null,
    !warmRunsResult.ok ? warmRunsResult.error : null,
  ].filter(Boolean) as string[]

  const overall: HermesSystemHealthSummary['overall'] =
    !dbProbe.ok ? 'error' : warnings.length > 0 ? 'warning' : 'ok'

  const summaryMarkdown = [
    '# Hermes System Health Summary',
    '',
    `Generated: ${generatedAt}`,
    `Overall: ${overall}`,
    '',
    '## Signals',
    '',
    `- Database: ${dbProbe.ok ? 'connected' : 'unavailable'}`,
    `- n8n tier: ${n8nFlags.tier}`,
    `- n8n mock enabled: ${String(n8nFlags.mockN8n.effective)}`,
    `- n8n outbound disabled: ${String(n8nFlags.disableOutbound.effective)}`,
    `- Agent runs in last 24h: ${agentRuns.length} total, ${running} running/queued, ${failed} failed, ${stale} stale`,
    `- Cost events in last 24h: ${costs.length} event(s), $${totalUsd.toFixed(4)}`,
    '',
    '## Workflow Snapshots',
    '',
    statusLine('Social content', { ok: socialRunsResult.ok, data: socialRunsResult.data ?? [], error: socialRunsResult.error }),
    statusLine('Value evidence', { ok: valueRunsResult.ok, data: valueRunsResult.data ?? [], error: valueRunsResult.error }),
    statusLine('Warm leads', { ok: warmRunsResult.ok, data: warmRunsResult.data ?? [], error: warmRunsResult.error }),
    '',
    '## Warnings',
    '',
    ...(warnings.length > 0 ? warnings.map((warning) => `- ${warning}`) : ['- None']),
  ].join('\n')

  return {
    generatedAt,
    overall,
    summaryMarkdown,
    signals: {
      database: dbProbe.ok ? 'connected' : 'unavailable',
      n8n: {
        deploymentTier: n8nFlags.tier,
        mockEnabled: n8nFlags.mockN8n.effective,
        outboundDisabled: n8nFlags.disableOutbound.effective,
      },
      agentRuns24h: {
        total: agentRuns.length,
        failed,
        stale,
        running,
        byRuntime: countByRuntime(agentRuns),
      },
      costs24h: {
        totalUsd: Number(totalUsd.toFixed(4)),
        events: costs.length,
      },
      workflows: {
        socialContent: { ok: socialRunsResult.ok, data: socialRunsResult.data ?? [], error: socialRunsResult.error },
        valueEvidence: { ok: valueRunsResult.ok, data: valueRunsResult.data ?? [], error: valueRunsResult.error },
        warmLeads: { ok: warmRunsResult.ok, data: warmRunsResult.data ?? [], error: warmRunsResult.error },
      },
    },
    warnings,
  }
}
