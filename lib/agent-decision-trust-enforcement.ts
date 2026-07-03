import type { AgentRuntime } from '@/lib/agent-run'
import {
  actionRequiresApproval,
  getApprovalGate,
  isPaymentAuthorityAction,
  type AgentAction,
} from '@/lib/agent-policy'
import type {
  AgentDecisionFrame,
  DecisionTrustGate,
  DecisionTrustScore,
} from '@/lib/agent-decision-trust'

export type DecisionTrustEnforcementMode =
  | 'shadow'
  | 'advisory'
  | 'soft_gate'
  | 'hard_block'

export type DecisionTrustEnforcementRecommendation = {
  mode: DecisionTrustEnforcementMode
  gate: DecisionTrustGate
  mayProceed: boolean
  requiresApproval: boolean
  shouldBlock: boolean
  approvalType: string | null
  reason: string
  evidence: {
    decisionId: string
    linkedRunId: string | null
    selectedCandidate: string
    scores: DecisionTrustScore
    missingEvidence: string[]
  }
}

export type RecommendDecisionTrustEnforcementInput = {
  frame: AgentDecisionFrame
  mode?: DecisionTrustEnforcementMode
  runtime?: AgentRuntime
  action?: AgentAction
}

export function recommendDecisionTrustEnforcement(
  input: RecommendDecisionTrustEnforcementInput,
): DecisionTrustEnforcementRecommendation {
  const mode = input.mode ?? 'shadow'
  const gate = input.frame.recommended_gate
  const approvalType = approvalTypeFor(input)
  const evidence = {
    decisionId: input.frame.decision_id,
    linkedRunId: input.frame.linked_run_id,
    selectedCandidate: input.frame.selected_candidate,
    scores: input.frame.scores,
    missingEvidence: input.frame.missing_evidence,
  }

  if (mode === 'shadow') {
    return {
      mode,
      gate,
      mayProceed: true,
      requiresApproval: false,
      shouldBlock: false,
      approvalType,
      reason: 'Shadow mode records the Decision Trust posture without changing execution.',
      evidence,
    }
  }

  if (mode === 'advisory') {
    return {
      mode,
      gate,
      mayProceed: true,
      requiresApproval: false,
      shouldBlock: false,
      approvalType,
      reason: advisoryReason(gate),
      evidence,
    }
  }

  if (mode === 'hard_block' && gate === 'block') {
    return {
      mode,
      gate,
      mayProceed: false,
      requiresApproval: false,
      shouldBlock: true,
      approvalType,
      reason: 'Hard-block mode prevents blocked Decision Trust frames from executing until the evidence is corrected or explicitly overridden.',
      evidence,
    }
  }

  if (approvalType && gate !== 'human_review' && gate !== 'block') {
    return {
      mode,
      gate,
      mayProceed: false,
      requiresApproval: true,
      shouldBlock: false,
      approvalType,
      reason: 'Runtime policy requires human approval before this action can continue, regardless of the Decision Trust score.',
      evidence,
    }
  }

  if (gate === 'human_review' || gate === 'block') {
    return {
      mode,
      gate,
      mayProceed: false,
      requiresApproval: true,
      shouldBlock: false,
      approvalType,
      reason: gate === 'block'
        ? 'Soft-gate mode requires human review for a blocked Decision Trust frame before execution can continue.'
        : 'Soft-gate mode requires human approval before this Decision Trust frame can produce a side effect.',
      evidence,
    }
  }

  if (gate === 'sandbox') {
    return {
      mode,
      gate,
      mayProceed: true,
      requiresApproval: false,
      shouldBlock: false,
      approvalType,
      reason: 'Sandbox decisions may proceed only in an isolated or read-only path with no sensitive side effect.',
      evidence,
    }
  }

  return {
    mode,
    gate,
    mayProceed: true,
    requiresApproval: false,
    shouldBlock: false,
    approvalType,
    reason: 'Allow decisions may proceed when the calling workflow keeps the action low-risk, reversible, and inside existing policy.',
    evidence,
  }
}

function approvalTypeFor(input: RecommendDecisionTrustEnforcementInput) {
  if (input.frame.approval_type) return input.frame.approval_type
  if (!input.action) return null
  const explicitGate = getApprovalGate(input.action)
  if (explicitGate) return explicitGate.approvalType
  if (input.runtime && actionRequiresApproval(input.runtime, input.action)) return input.action
  if (isPaymentAuthorityAction(input.action)) return `payment_${input.action}`
  return null
}

function advisoryReason(gate: DecisionTrustGate) {
  if (gate === 'block') return 'Advisory mode warns that this Decision Trust frame would be blocked in hard-block mode.'
  if (gate === 'human_review') return 'Advisory mode warns that this Decision Trust frame needs human review before side effects.'
  if (gate === 'sandbox') return 'Advisory mode warns that this Decision Trust frame should stay sandboxed or read-only.'
  return 'Advisory mode reports an allow posture without changing execution.'
}
