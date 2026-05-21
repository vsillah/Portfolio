import { supabaseAdmin } from '@/lib/supabase'
import type { AgentGovernanceClientExport } from '@/lib/agent-governance-export'

export type AgentGovernanceExportLedgerRow = {
  id: string
  export_type: string
  format: 'json' | 'markdown'
  classification: string
  scope: Record<string, unknown>
  run_id: string | null
  client_project_id: string | null
  from_at: string | null
  to_at: string | null
  matching_run_count: number | null
  requested_by_user_id: string | null
  generated_at: string
  created_at: string
}

export type RecordAgentGovernanceExportInput = {
  clientExport: AgentGovernanceClientExport
  format: 'json' | 'markdown'
  userId: string
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function recordAgentGovernanceExport(input: RecordAgentGovernanceExportInput): Promise<{ id: string } | null> {
  if (!supabaseAdmin) return null

  const scope = input.clientExport.scope
  const { data, error } = await supabaseAdmin
    .from('agent_governance_exports')
    .insert({
      export_type: input.clientExport.export_type,
      format: input.format,
      classification: input.clientExport.classification,
      scope,
      run_id: stringValue(scope.run_id),
      client_project_id: stringValue(scope.client_project_id),
      from_at: stringValue(scope.from),
      to_at: stringValue(scope.to),
      matching_run_count: numberValue(scope.matching_run_count),
      requested_by_user_id: input.userId,
      generated_at: input.clientExport.generated_at,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to record agent governance export: ${error.message}`)
  return data?.id ? { id: data.id as string } : null
}
