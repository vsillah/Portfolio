import { AGENT_ORGANIZATION, getAgentByKey } from '@/lib/agent-organization'
import type { ChiefOfStaffAgentEngagementProposal } from '@/lib/chief-of-staff-chat'

export type DelegationTaskType =
  | 'status'
  | 'recovery'
  | 'research'
  | 'content'
  | 'code'
  | 'automation'
  | 'payment'
  | 'approval'
  | 'client_delivery'
  | 'publishing'

export type DelegationRiskClass =
  | 'read_only'
  | 'internal_write'
  | 'client_data_access'
  | 'outbound_send'
  | 'production_mutation'
  | 'payment_spend'

export type AgentDelegationDecision = {
  task_type: DelegationTaskType
  risk_class: DelegationRiskClass
  selected_agent_key: string
  selected_agent_name: string
  alternatives_considered: string[]
  required_evidence: string[]
  fallback_agent_key: string
  approval_gate: string
  confidence: number
  reason: string
}

type DelegationRule = {
  taskType: DelegationTaskType
  riskClass: DelegationRiskClass
  preferredAgentKeys: string[]
  fallbackAgentKey: string
  requiredEvidence: string[]
}

const DELEGATION_RULES: DelegationRule[] = [
  {
    taskType: 'payment',
    riskClass: 'payment_spend',
    preferredAgentKeys: ['automation-systems', 'proposal-business-model', 'chief-of-staff'],
    fallbackAgentKey: 'chief-of-staff',
    requiredEvidence: ['approval', 'payment_object', 'trace_id'],
  },
  {
    taskType: 'automation',
    riskClass: 'production_mutation',
    preferredAgentKeys: ['automation-systems', 'agent-tooling-parity', 'engineering-copilot'],
    fallbackAgentKey: 'chief-of-staff',
    requiredEvidence: ['work_item', 'run_trace', 'approval_if_mutating'],
  },
  {
    taskType: 'code',
    riskClass: 'internal_write',
    preferredAgentKeys: ['engineering-copilot', 'agent-tooling-parity'],
    fallbackAgentKey: 'chief-of-staff',
    requiredEvidence: ['branch', 'worktree', 'validation_summary'],
  },
  {
    taskType: 'research',
    riskClass: 'read_only',
    preferredAgentKeys: ['research-source-register', 'risk-compliance-intelligence', 'private-knowledge-librarian'],
    fallbackAgentKey: 'chief-of-staff',
    requiredEvidence: ['source_register', 'trace_id'],
  },
  {
    taskType: 'content',
    riskClass: 'client_data_access',
    preferredAgentKeys: ['voice-content-architect', 'amadutown-brand', 'strategic-narrative'],
    fallbackAgentKey: 'chief-of-staff',
    requiredEvidence: ['source_context', 'approval_if_public'],
  },
  {
    taskType: 'publishing',
    riskClass: 'outbound_send',
    preferredAgentKeys: ['website-product-copy', 'inbox-follow-up', 'voice-content-architect'],
    fallbackAgentKey: 'chief-of-staff',
    requiredEvidence: ['approved_content', 'approval'],
  },
  {
    taskType: 'client_delivery',
    riskClass: 'client_data_access',
    preferredAgentKeys: ['meeting-intake-follow-up', 'automation-systems', 'inbox-follow-up'],
    fallbackAgentKey: 'chief-of-staff',
    requiredEvidence: ['client_project', 'work_item', 'approval_if_external'],
  },
  {
    taskType: 'approval',
    riskClass: 'production_mutation',
    preferredAgentKeys: ['chief-of-staff', 'risk-compliance-intelligence', 'automation-systems'],
    fallbackAgentKey: 'chief-of-staff',
    requiredEvidence: ['approval', 'run_trace'],
  },
  {
    taskType: 'recovery',
    riskClass: 'read_only',
    preferredAgentKeys: ['chief-of-staff', 'engineering-copilot', 'automation-systems'],
    fallbackAgentKey: 'chief-of-staff',
    requiredEvidence: ['failed_or_stale_run', 'recovery_packet'],
  },
  {
    taskType: 'status',
    riskClass: 'read_only',
    preferredAgentKeys: ['chief-of-staff'],
    fallbackAgentKey: 'chief-of-staff',
    requiredEvidence: ['agent_ops_context'],
  },
]

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term))
}

export function inferDelegationRule(message: string): DelegationRule {
  const text = message.toLowerCase()

  if (includesAny(text, ['payment', 'checkout', 'subscription', 'refund', 'vendor', 'spend', 'paid api', 'budget increase'])) {
    return DELEGATION_RULES[0]
  }
  if (includesAny(text, ['n8n', 'workflow', 'automation', 'webhook', 'mcp', 'schedule'])) {
    return DELEGATION_RULES[1]
  }
  if (includesAny(text, ['code', 'build', 'implement', 'pr ', 'pull request', 'branch', 'worktree'])) {
    return DELEGATION_RULES[2]
  }
  if (includesAny(text, ['research', 'source', 'evidence', 'risk', 'compliance', 'regulation', 'news'])) {
    return DELEGATION_RULES[3]
  }
  if (includesAny(text, ['content', 'copy', 'post', 'deck', 'script', 'brand', 'course'])) {
    return DELEGATION_RULES[4]
  }
  if (includesAny(text, ['publish', 'send', 'email', 'outreach', 'follow-up', 'follow up'])) {
    return DELEGATION_RULES[5]
  }
  if (includesAny(text, ['client', 'delivery', 'meeting', 'onboarding', 'project'])) {
    return DELEGATION_RULES[6]
  }
  if (includesAny(text, ['approve', 'approval', 'authorize', 'reject'])) {
    return DELEGATION_RULES[7]
  }
  if (includesAny(text, ['failed', 'stale', 'retry', 'recover', 'dead-letter', 'dead letter', 'blocker'])) {
    return DELEGATION_RULES[8]
  }
  return DELEGATION_RULES[9]
}

function isImmediateAgent(agentKey: string) {
  const agent = getAgentByKey(agentKey)
  return agent?.status === 'active' || agent?.status === 'partial'
}

function firstImmediate(keys: string[]) {
  return keys.find((key) => isImmediateAgent(key)) ?? keys[0]
}

export function evaluateAgentDelegationPolicy(input: {
  message: string
  proposedAgentKeys?: string[]
}): AgentDelegationDecision {
  const rule = inferDelegationRule(input.message)
  const validProposedKeys = (input.proposedAgentKeys ?? []).filter((key) => Boolean(getAgentByKey(key)))
  const preferredSet = new Set(rule.preferredAgentKeys)
  const selectedKey =
    firstImmediate(rule.preferredAgentKeys) ??
    validProposedKeys.find((key) => preferredSet.has(key) && isImmediateAgent(key)) ??
    rule.fallbackAgentKey
  const selectedAgent = getAgentByKey(selectedKey) ?? AGENT_ORGANIZATION[0]
  const alternatives = Array.from(new Set([...validProposedKeys, ...rule.preferredAgentKeys]))
    .filter((key) => key !== selectedAgent.key)
    .slice(0, 4)

  return {
    task_type: rule.taskType,
    risk_class: rule.riskClass,
    selected_agent_key: selectedAgent.key,
    selected_agent_name: selectedAgent.name,
    alternatives_considered: alternatives,
    required_evidence: rule.requiredEvidence,
    fallback_agent_key: rule.fallbackAgentKey,
    approval_gate: selectedAgent.approvalGate,
    confidence: rule.preferredAgentKeys.includes(selectedAgent.key) ? 0.9 : 0.65,
    reason: `${selectedAgent.name} matches ${rule.taskType.replace(/_/g, ' ')} work with ${rule.riskClass.replace(/_/g, ' ')} risk.`,
  }
}

export function applyDelegationDecisionToEngagements(
  engagements: ChiefOfStaffAgentEngagementProposal[],
  decision: AgentDelegationDecision | null,
): ChiefOfStaffAgentEngagementProposal[] {
  if (!decision || engagements.length === 0) return engagements
  const selectedAgent = getAgentByKey(decision.selected_agent_key)
  if (!selectedAgent) return engagements

  const existing = engagements.find((engagement) => engagement.agentKey === selectedAgent.key)
  const primary: ChiefOfStaffAgentEngagementProposal = existing ?? {
    agentKey: selectedAgent.key,
    agentName: selectedAgent.name,
    label: `Run ${selectedAgent.name}`,
    rationale: decision.reason,
    status: selectedAgent.status,
    executionMode: selectedAgent.status === 'planned' ? 'queued_for_review' : 'read_only',
  }

  return [
    primary,
    ...engagements.filter((engagement) => engagement.agentKey !== selectedAgent.key),
  ].slice(0, 3)
}
