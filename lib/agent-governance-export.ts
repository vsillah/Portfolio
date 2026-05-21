import type { AgentGovernanceSnapshot } from '@/lib/agent-governance'
import type { AgentGovernanceExportScope } from '@/lib/agent-governance-scope'

export type AgentGovernanceClientExport = {
  export_type: 'agent_governance_client_audit'
  generated_at: string
  classification: 'client_safe'
  title: string
  scope: AgentGovernanceExportScope & {
    description: string
  }
  summary: {
    total_agents: number
    reviewed_agents: number
    planned_agents: number
    least_privilege_attention: number
    pending_authority_approvals: number
    payment_authority_actions: number
  }
  client_positioning: {
    headline: string
    proof_points: string[]
  }
  capability_inventory: Array<{
    agent: string
    status: string
    runtime: string
    pod: string
    tools: string[]
    data_access: string[]
    write_authority: string[]
    outbound_authority: string
    spend_authority: string
    approval_gates: string[]
    governance_status: string
  }>
  delegation_trace: Array<{
    trace_reference: string
    selected_agent: string
    task_type: string
    risk_class: string
    confidence: string
    occurred_at: string
    reason: string
  }>
  authority_controls: {
    payment_gates: Array<{
      action: string
      approval_type: string
      label: string
      description: string
    }>
    pending_authority_checkpoints: Array<{
      trace_reference: string
      approval_type: string
      status: string
      requested_at: string
    }>
  }
  audit_boundaries: string[]
}

const AUDIT_BOUNDARIES = [
  'Client-safe export excludes raw prompts, private logs, secrets, credentials, private reasoning, and sensitive records.',
  'Trace references point operators back to Agent Ops without exposing the full run payload.',
  'Payment and paid-job actions are represented as approval gates, not proof that money moved.',
  'Specialist agent scopes are summarized from current governance policy and should be reviewed before external delivery.',
]

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function buildAgentGovernanceClientExport(
  governance: AgentGovernanceSnapshot,
  scope: AgentGovernanceExportScope = {},
): AgentGovernanceClientExport {
  const scoped = Boolean(scope.run_id || scope.client_project_id || scope.from || scope.to)
  return {
    export_type: 'agent_governance_client_audit',
    generated_at: new Date().toISOString(),
    classification: 'client_safe',
    title: 'Agentic Operating System Governance Audit',
    scope: {
      ...scope,
      description: scoped ? 'Scoped governance export.' : 'Current governance snapshot.',
    },
    summary: governance.summary,
    client_positioning: {
      headline: 'Governed agents, not unchecked automation.',
      proof_points: [
        'Every agent has a named role, runtime, and scope profile.',
        'Delegation decisions can be traced back to Shaka routing evidence.',
        'Payment and spend authority stays behind explicit approval gates.',
        'The audit trail separates client-safe summaries from private operator traces.',
      ],
    },
    capability_inventory: governance.capability_profiles.map((profile) => ({
      agent: profile.display_name,
      status: profile.status,
      runtime: profile.primary_runtime,
      pod: profile.pod,
      tools: profile.allowed_tools,
      data_access: profile.allowed_data_classes,
      write_authority: profile.allowed_write_classes,
      outbound_authority: profile.outbound_authority,
      spend_authority: profile.spend_authority,
      approval_gates: profile.approval_required_for,
      governance_status: profile.governance_status,
    })),
    delegation_trace: governance.recent_delegation_decisions.map((decision) => ({
      trace_reference: decision.run_id,
      selected_agent: decision.selected_agent_name,
      task_type: decision.task_type,
      risk_class: decision.risk_class,
      confidence: percent(decision.confidence),
      occurred_at: decision.occurred_at,
      reason: decision.reason,
    })),
    authority_controls: {
      payment_gates: governance.payment_authority_actions.map((gate) => ({
        action: gate.action,
        approval_type: gate.approval_type,
        label: gate.label,
        description: gate.description,
      })),
      pending_authority_checkpoints: governance.pending_authority_approvals.map((approval) => ({
        trace_reference: approval.run_id,
        approval_type: approval.approval_type,
        status: approval.status,
        requested_at: approval.requested_at,
      })),
    },
    audit_boundaries: AUDIT_BOUNDARIES,
  }
}

function list(items: string[]) {
  if (items.length === 0) return '- None recorded.'
  return items.map((item) => `- ${item}`).join('\n')
}

export function formatAgentGovernanceClientMarkdown(clientExport: AgentGovernanceClientExport) {
  const capabilityRows = clientExport.capability_inventory.map((profile) =>
    `| ${profile.agent} | ${profile.status} | ${profile.runtime} | ${profile.governance_status} | ${profile.spend_authority} | ${profile.outbound_authority} |`,
  )

  const delegationRows = clientExport.delegation_trace.length
    ? clientExport.delegation_trace.map((decision) =>
        `| ${decision.trace_reference} | ${decision.selected_agent} | ${decision.task_type} | ${decision.risk_class} | ${decision.confidence} |`,
      )
    : ['| No recent delegation decisions recorded. | - | - | - | - |']

  const paymentRows = clientExport.authority_controls.payment_gates.map((gate) =>
    `| ${gate.label} | ${gate.approval_type} | ${gate.description} |`,
  )

  const pendingRows = clientExport.authority_controls.pending_authority_checkpoints.length
    ? clientExport.authority_controls.pending_authority_checkpoints.map((approval) =>
        `| ${approval.trace_reference} | ${approval.approval_type} | ${approval.status} | ${approval.requested_at} |`,
      )
    : ['| No pending authority checkpoints. | - | - | - |']

  return [
    `# ${clientExport.title}`,
    '',
    `Generated: ${clientExport.generated_at}`,
    `Classification: ${clientExport.classification}`,
    '',
    '## Executive Summary',
    '',
    clientExport.client_positioning.headline,
    '',
    list(clientExport.client_positioning.proof_points),
    '',
    '## Export Scope',
    '',
    `- Scope: ${clientExport.scope.description}`,
    `- Run ID: ${clientExport.scope.run_id ?? 'All visible governance runs'}`,
    `- Client project ID: ${clientExport.scope.client_project_id ?? 'All visible client projects'}`,
    `- From: ${clientExport.scope.from ?? 'No lower bound'}`,
    `- To: ${clientExport.scope.to ?? 'No upper bound'}`,
    `- Matching runs: ${clientExport.scope.matching_run_count ?? 'Not scoped by run set'}`,
    '',
    '## Governance Snapshot',
    '',
    `- Agents: ${clientExport.summary.reviewed_agents}/${clientExport.summary.total_agents} reviewed`,
    `- Planned agents: ${clientExport.summary.planned_agents}`,
    `- Least-privilege attention: ${clientExport.summary.least_privilege_attention}`,
    `- Pending authority approvals: ${clientExport.summary.pending_authority_approvals}`,
    `- Payment authority gates: ${clientExport.summary.payment_authority_actions}`,
    '',
    '## Capability Inventory',
    '',
    '| Agent | Status | Runtime | Governance | Spend | Outbound |',
    '| --- | --- | --- | --- | --- | --- |',
    ...capabilityRows,
    '',
    '## Delegation Trace',
    '',
    '| Trace | Selected Agent | Task | Risk | Confidence |',
    '| --- | --- | --- | --- | --- |',
    ...delegationRows,
    '',
    '## Payment And Spend Authority',
    '',
    '| Gate | Approval Type | Boundary |',
    '| --- | --- | --- |',
    ...paymentRows,
    '',
    '## Pending Authority Checkpoints',
    '',
    '| Trace | Approval Type | Status | Requested At |',
    '| --- | --- | --- | --- |',
    ...pendingRows,
    '',
    '## Audit Boundaries',
    '',
    list(clientExport.audit_boundaries),
    '',
  ].join('\n')
}
