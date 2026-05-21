import { AGENT_ORGANIZATION, AGENT_PODS, type AgentOrganizationNode } from '@/lib/agent-organization'
import {
  APPROVAL_GATES,
  PAYMENT_AUTHORITY_ACTIONS,
  getApprovalGate,
  isPaymentAuthorityAction,
  type AgentAction,
} from '@/lib/agent-policy'

export type AgentCapabilityProfile = {
  agent_key: string
  display_name: string
  pod: string
  status: AgentOrganizationNode['status']
  primary_runtime: AgentOrganizationNode['primaryRuntime']
  allowed_tools: string[]
  allowed_data_classes: string[]
  allowed_write_classes: string[]
  outbound_authority: 'none' | 'draft_only' | 'known_workflow' | 'approval_required'
  spend_authority: 'none' | 'approval_required'
  approval_required_for: AgentAction[]
  sensitive_boundaries: string[]
  last_reviewed_at: string
  review_status: 'reviewed' | 'planned'
  governance_status: 'green' | 'yellow' | 'red'
}

export type GovernanceApprovalSummary = {
  run_id: string
  approval_type: string
  status: string
  requested_at: string
}

export type GovernanceEventSummary = {
  run_id: string
  event_type: string
  severity: string
  message: string | null
  occurred_at: string
  metadata?: Record<string, unknown> | null
}

export type GovernanceExportSummary = {
  id: string
  export_type: string
  format: 'json' | 'markdown'
  classification: string
  run_id: string | null
  client_project_id: string | null
  from_at: string | null
  to_at: string | null
  matching_run_count: number | null
  requested_by_user_id: string | null
  generated_at: string
  created_at: string
}

export type AgentGovernanceSnapshot = {
  generated_at: string
  summary: {
    total_agents: number
    reviewed_agents: number
    planned_agents: number
    least_privilege_attention: number
    pending_authority_approvals: number
    payment_authority_actions: number
  }
  capability_profiles: AgentCapabilityProfile[]
  payment_authority_actions: Array<{
    action: AgentAction
    approval_type: string
    label: string
    description: string
  }>
  pending_authority_approvals: GovernanceApprovalSummary[]
  recent_delegation_decisions: Array<{
    run_id: string
    selected_agent_key: string
    selected_agent_name: string
    task_type: string
    risk_class: string
    confidence: number
    occurred_at: string
    reason: string
  }>
  recent_governance_exports: GovernanceExportSummary[]
}

const GOVERNANCE_REVIEWED_AT = '2026-05-21'

function podName(agent: AgentOrganizationNode) {
  return AGENT_PODS.find((pod) => pod.key === agent.podKey)?.name ?? agent.podKey
}

function baseTools(agent: AgentOrganizationNode) {
  const tools = ['Agent Ops traces', 'Mission Control context']
  if (agent.primaryRuntime === 'codex' || agent.primaryRuntime === 'mixed') {
    tools.push('Codex repo/worktree tools')
  }
  if (agent.primaryRuntime === 'n8n' || agent.primaryRuntime === 'mixed' || agent.n8nWorkflows.length > 0) {
    tools.push('n8n workflow hooks')
  }
  if (agent.key === 'chief-of-staff') {
    tools.push('Shaka routing catalog')
  }
  if (agent.n8nWorkflows.some((workflow) => workflow.active)) {
    tools.push(`${agent.n8nWorkflows.filter((workflow) => workflow.active).length} active workflow(s)`)
  }
  return tools
}

function dataClasses(agent: AgentOrganizationNode) {
  const classes = ['agent_ops_traces']
  if (agent.podKey === 'chief_of_staff') classes.push('cross_agent_status', 'approvals', 'work_items')
  if (agent.podKey === 'research_knowledge') classes.push('source_registers', 'knowledge_records', 'rag_metadata')
  if (agent.podKey === 'content_production') classes.push('content_drafts', 'private_source_summaries')
  if (agent.podKey === 'product_automation') classes.push('workflow_config', 'client_project_state', 'runtime_health')
  if (agent.podKey === 'publishing_follow_up') classes.push('outreach_records', 'meeting_records', 'publishing_queue')
  return Array.from(new Set(classes))
}

function writeClasses(agent: AgentOrganizationNode) {
  if (agent.status === 'planned') return ['none_until_reviewed']
  const classes = ['agent_run_events', 'agent_work_items']
  if (agent.primaryRuntime === 'codex') classes.push('repo_branch_files')
  if (agent.primaryRuntime === 'n8n' || agent.primaryRuntime === 'mixed') classes.push('known_workflow_records')
  return Array.from(new Set(classes))
}

function approvalActions(agent: AgentOrganizationNode): AgentAction[] {
  const actions = new Set<AgentAction>(['production_config_change', 'public_content_from_private_material'])
  const gate = agent.approvalGate.toLowerCase()

  if (gate.includes('publishing') || agent.podKey === 'content_production') actions.add('publish_public_content')
  if (gate.includes('send') || gate.includes('email') || agent.podKey === 'publishing_follow_up') actions.add('send_email')
  if (gate.includes('unknown') || gate.includes('config') || agent.podKey === 'product_automation') actions.add('unknown_db_write')
  if (agent.key === 'automation-systems' || agent.key === 'proposal-business-model') {
    PAYMENT_AUTHORITY_ACTIONS.forEach((action) => actions.add(action))
  }

  return Array.from(actions)
}

function outboundAuthority(agent: AgentOrganizationNode): AgentCapabilityProfile['outbound_authority'] {
  if (agent.status === 'planned') return 'none'
  if (agent.approvalGate.toLowerCase().includes('approval') && (agent.podKey === 'publishing_follow_up' || agent.podKey === 'content_production')) {
    return 'approval_required'
  }
  if (agent.primaryRuntime === 'n8n' && agent.n8nWorkflows.length > 0) return 'known_workflow'
  return 'draft_only'
}

function spendAuthority(agent: AgentOrganizationNode): AgentCapabilityProfile['spend_authority'] {
  return agent.key === 'automation-systems' || agent.key === 'proposal-business-model'
    ? 'approval_required'
    : 'none'
}

function governanceStatus(profile: Omit<AgentCapabilityProfile, 'governance_status'>): AgentCapabilityProfile['governance_status'] {
  if (profile.status === 'planned') return 'yellow'
  if (profile.spend_authority === 'approval_required' || profile.outbound_authority === 'approval_required') return 'yellow'
  if (profile.allowed_write_classes.includes('none_until_reviewed')) return 'red'
  return 'green'
}

export function buildAgentCapabilityProfiles(): AgentCapabilityProfile[] {
  return AGENT_ORGANIZATION.map((agent) => {
    const profile = {
      agent_key: agent.key,
      display_name: agent.name,
      pod: podName(agent),
      status: agent.status,
      primary_runtime: agent.primaryRuntime,
      allowed_tools: baseTools(agent),
      allowed_data_classes: dataClasses(agent),
      allowed_write_classes: writeClasses(agent),
      outbound_authority: outboundAuthority(agent),
      spend_authority: spendAuthority(agent),
      approval_required_for: approvalActions(agent),
      sensitive_boundaries: [agent.approvalGate],
      last_reviewed_at: GOVERNANCE_REVIEWED_AT,
      review_status: agent.status === 'planned' ? 'planned' : 'reviewed',
    } satisfies Omit<AgentCapabilityProfile, 'governance_status'>

    return {
      ...profile,
      governance_status: governanceStatus(profile),
    }
  })
}

function isAuthorityApproval(approvalType: string) {
  const action = APPROVAL_GATES.find((gate) => gate.approvalType === approvalType)?.action
  return approvalType.includes('payment_') ||
    approvalType.includes('production_config') ||
    approvalType.includes('private_material') ||
    approvalType.includes('send_email') ||
    approvalType.includes('publishing') ||
    (action ? isPaymentAuthorityAction(action) : false)
}

function metadataRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function recentDelegationDecisions(events: GovernanceEventSummary[]): AgentGovernanceSnapshot['recent_delegation_decisions'] {
  return events
    .filter((event) => event.event_type === 'delegation_decision_recorded')
    .flatMap((event) => {
      const metadata = metadataRecord(event.metadata)
      const selectedAgentKey = typeof metadata?.selected_agent_key === 'string' ? metadata.selected_agent_key : ''
      const selectedAgentName = typeof metadata?.selected_agent_name === 'string' ? metadata.selected_agent_name : selectedAgentKey
      if (!selectedAgentKey) return []

      return [{
        run_id: event.run_id,
        selected_agent_key: selectedAgentKey,
        selected_agent_name: selectedAgentName,
        task_type: typeof metadata?.task_type === 'string' ? metadata.task_type : 'unknown',
        risk_class: typeof metadata?.risk_class === 'string' ? metadata.risk_class : 'read_only',
        confidence: typeof metadata?.confidence === 'number' ? metadata.confidence : 0,
        occurred_at: event.occurred_at,
        reason: event.message ?? 'Delegation decision recorded.',
      }]
    })
    .slice(0, 5)
}

export function buildAgentGovernanceSnapshot(input?: {
  approvals?: GovernanceApprovalSummary[]
  events?: GovernanceEventSummary[]
  exports?: GovernanceExportSummary[]
}): AgentGovernanceSnapshot {
  const capabilityProfiles = buildAgentCapabilityProfiles()
  const pendingAuthorityApprovals = (input?.approvals ?? []).filter((approval) =>
    approval.status === 'pending' && isAuthorityApproval(approval.approval_type),
  )

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_agents: capabilityProfiles.length,
      reviewed_agents: capabilityProfiles.filter((profile) => profile.review_status === 'reviewed').length,
      planned_agents: capabilityProfiles.filter((profile) => profile.review_status === 'planned').length,
      least_privilege_attention: capabilityProfiles.filter((profile) => profile.governance_status !== 'green').length,
      pending_authority_approvals: pendingAuthorityApprovals.length,
      payment_authority_actions: PAYMENT_AUTHORITY_ACTIONS.length,
    },
    capability_profiles: capabilityProfiles,
    payment_authority_actions: PAYMENT_AUTHORITY_ACTIONS.map((action) => {
      const gate = getApprovalGate(action)
      return {
        action,
        approval_type: gate?.approvalType ?? action,
        label: gate?.label ?? action.replace(/_/g, ' '),
        description: gate?.description ?? 'Payment authority action.',
      }
    }),
    pending_authority_approvals: pendingAuthorityApprovals.slice(0, 8),
    recent_delegation_decisions: recentDelegationDecisions(input?.events ?? []),
    recent_governance_exports: (input?.exports ?? []).slice(0, 8),
  }
}
