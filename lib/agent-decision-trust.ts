import { isPaymentAuthorityAction, type AgentAction } from '@/lib/agent-policy'
import type { TechnologyBakeoffCandidate, TechnologyBakeoffInput } from '@/lib/technology-bakeoff'
import type { AgentDelegationDecision } from '@/lib/agent-delegation-policy'

export const AGENT_DECISION_TRUST_EVENT = 'agent_decision_trust_recorded'

export type AgentDecisionType =
  | 'information'
  | 'tool'
  | 'vendor'
  | 'spend'
  | 'data'
  | 'action'
  | 'oauth'
  | 'app_install'

export type DecisionTrustGate = 'allow' | 'sandbox' | 'human_review' | 'block'
export type DecisionTrustConfidence = 'low' | 'medium' | 'high'
export type DecisionTrustReversibility = 'easy' | 'moderate' | 'hard' | 'irreversible'

export type DecisionTrustScore = {
  relationshipTrust: number
  decisionRisk: number
  evidenceCompleteness: number
}

export type AgentDecisionFrame = {
  decision_id: string
  agent_key: string
  decision_type: AgentDecisionType
  objective: string
  selected_candidate: string
  candidates_considered: string[]
  rejected_candidates: Array<{
    candidate: string
    reason: string
  }>
  trust_signals: string[]
  risk_signals: string[]
  missing_evidence: string[]
  confidence: DecisionTrustConfidence
  reversibility: DecisionTrustReversibility
  scores: DecisionTrustScore
  recommended_gate: DecisionTrustGate
  approval_type: string | null
  linked_run_id: string | null
}

export type BuildAgentDecisionFrameInput = {
  agentKey: string
  decisionType: AgentDecisionType
  objective: string
  selectedCandidate: string
  candidatesConsidered?: string[]
  rejectedCandidates?: AgentDecisionFrame['rejected_candidates']
  trustSignals?: string[]
  riskSignals?: string[]
  missingEvidence?: string[]
  confidence?: DecisionTrustConfidence
  reversibility?: DecisionTrustReversibility
  approvalType?: string | null
  linkedRunId?: string | null
}

const TRUST_SIGNAL_WEIGHTS: Array<[RegExp, number]> = [
  [/official|first.?party|domain.?match|verified/i, 0.25],
  [/prior approval|approved/i, 0.2],
  [/prior successful|used successfully|successful use/i, 0.2],
  [/known internal|internal source|trusted domain|agent ops/i, 0.18],
  [/source evidence|trace|provenance|audit/i, 0.12],
]

const RISK_SIGNAL_WEIGHTS: Array<[RegExp, number]> = [
  [/scam|known.?bad|impersonat|typosquat|domain mismatch|contradict/i, 1],
  [/payment|spend|subscription|refund|checkout|paid|vendor/i, 0.5],
  [/oauth|app install|install app|permission|broad access/i, 0.45],
  [/production|config|mutation|database write/i, 0.45],
  [/private|client data|secret|credential/i, 0.4],
  [/publish|email|outbound|public/i, 0.35],
  [/irreversible|hard to reverse/i, 0.3],
  [/unknown vendor|unknown source|unverified/i, 0.25],
]

const HUMAN_REVIEW_RISK = /(payment|spend|subscription|refund|checkout|paid|vendor|oauth|app install|permission|production|config|private|client data|publish|email|outbound|irreversible)/i
const BLOCK_RISK = /(scam|known.?bad|impersonat|typosquat|domain mismatch|contradict|excessive unexplained permission)/i

function clampScore(value: number) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2))
}

function uniqueStrings(values: string[] | undefined, fallback: string[] = []) {
  return Array.from(new Set([...(values ?? []), ...fallback]
    .map((value) => value.trim())
    .filter(Boolean)))
}

function signalScore(signals: string[], weights: Array<[RegExp, number]>, base: number) {
  return clampScore(signals.reduce((score, signal) => {
    const match = weights.find(([pattern]) => pattern.test(signal))
    return score + (match?.[1] ?? 0.06)
  }, base))
}

function confidenceFromScores(scores: DecisionTrustScore): DecisionTrustConfidence {
  if (scores.evidenceCompleteness >= 0.75 && scores.relationshipTrust >= 0.65 && scores.decisionRisk < 0.55) return 'high'
  if (scores.evidenceCompleteness >= 0.45 && scores.relationshipTrust >= 0.4 && scores.decisionRisk < 0.75) return 'medium'
  return 'low'
}

function gateFromScores(input: {
  decisionType: AgentDecisionType
  scores: DecisionTrustScore
  riskSignals: string[]
  approvalType: string | null
  reversibility: DecisionTrustReversibility
}): DecisionTrustGate {
  const riskText = input.riskSignals.join(' ')
  if (BLOCK_RISK.test(riskText)) return 'block'
  if (
    input.approvalType ||
    input.decisionType === 'spend' ||
    input.decisionType === 'oauth' ||
    input.decisionType === 'app_install' ||
    input.reversibility === 'irreversible' ||
    HUMAN_REVIEW_RISK.test(riskText)
  ) {
    return 'human_review'
  }
  if (input.scores.decisionRisk >= 0.55 || input.scores.evidenceCompleteness < 0.65 || input.scores.relationshipTrust < 0.55) {
    return 'sandbox'
  }
  return 'allow'
}

export function scoreAgentDecisionTrust(frame: Pick<
  AgentDecisionFrame,
  'decision_type' | 'trust_signals' | 'risk_signals' | 'missing_evidence' | 'approval_type' | 'reversibility'
>): { scores: DecisionTrustScore; recommended_gate: DecisionTrustGate } {
  const scores = {
    relationshipTrust: signalScore(frame.trust_signals, TRUST_SIGNAL_WEIGHTS, 0.25),
    decisionRisk: signalScore(frame.risk_signals, RISK_SIGNAL_WEIGHTS, 0.12),
    evidenceCompleteness: clampScore(0.92 - (frame.missing_evidence.length * 0.16)),
  }

  return {
    scores,
    recommended_gate: gateFromScores({
      decisionType: frame.decision_type,
      scores,
      riskSignals: frame.risk_signals,
      approvalType: frame.approval_type,
      reversibility: frame.reversibility,
    }),
  }
}

export function buildAgentDecisionFrame(input: BuildAgentDecisionFrameInput): AgentDecisionFrame {
  const candidatesConsidered = uniqueStrings(input.candidatesConsidered, [input.selectedCandidate])
  const trustSignals = uniqueStrings(input.trustSignals)
  const riskSignals = uniqueStrings(input.riskSignals)
  const missingEvidence = uniqueStrings(input.missingEvidence)
  const baseFrame = {
    decision_id: stableDecisionId([
      input.agentKey,
      input.decisionType,
      input.objective,
      input.selectedCandidate,
      candidatesConsidered.join('|'),
    ]),
    agent_key: input.agentKey,
    decision_type: input.decisionType,
    objective: input.objective,
    selected_candidate: input.selectedCandidate,
    candidates_considered: candidatesConsidered,
    rejected_candidates: input.rejectedCandidates ?? candidatesConsidered
      .filter((candidate) => candidate !== input.selectedCandidate)
      .map((candidate) => ({ candidate, reason: 'Not selected for this decision frame.' })),
    trust_signals: trustSignals,
    risk_signals: riskSignals,
    missing_evidence: missingEvidence,
    confidence: input.confidence ?? 'medium',
    reversibility: input.reversibility ?? 'moderate',
    approval_type: input.approvalType ?? null,
    linked_run_id: input.linkedRunId ?? null,
  }
  const scored = scoreAgentDecisionTrust(baseFrame)

  return {
    ...baseFrame,
    scores: scored.scores,
    recommended_gate: scored.recommended_gate,
    confidence: input.confidence ?? confidenceFromScores(scored.scores),
  }
}

export function buildDelegationDecisionTrustFrame(input: {
  decision: AgentDelegationDecision
  runId?: string | null
}) {
  const decision = input.decision
  return buildAgentDecisionFrame({
    agentKey: 'chief-of-staff',
    decisionType: decision.risk_class === 'payment_spend' ? 'spend' : 'tool',
    objective: `Route ${decision.task_type.replace(/_/g, ' ')} work to the right agent.`,
    selectedCandidate: decision.selected_agent_key,
    candidatesConsidered: [decision.selected_agent_key, ...decision.alternatives_considered],
    trustSignals: [
      'Agent Ops trace available',
      'Known internal agent routing catalog',
      ...decision.required_evidence.map((item) => `Required evidence: ${item}`),
    ],
    riskSignals: [
      `Risk class: ${decision.risk_class}`,
      ...(decision.approval_gate ? [`Approval gate required: ${decision.approval_gate}`] : []),
    ],
    missingEvidence: [],
    confidence: decision.confidence >= 0.8 ? 'high' : decision.confidence >= 0.55 ? 'medium' : 'low',
    reversibility: decision.risk_class === 'payment_spend' || decision.risk_class === 'production_mutation' ? 'hard' : 'easy',
    approvalType: decision.approval_gate,
    linkedRunId: input.runId ?? null,
  })
}

export function buildTechnologyBakeoffDecisionTrustFrame(input: {
  bakeoff: TechnologyBakeoffInput
  selectedCandidate: TechnologyBakeoffCandidate
  candidates: TechnologyBakeoffCandidate[]
  missingEvidence: string[]
}) {
  const decisionType: AgentDecisionType = input.bakeoff.surface === 'commerce' || input.bakeoff.priority === 'cost'
    ? 'vendor'
    : input.bakeoff.surface === 'agent_runtimes'
      ? 'tool'
      : 'information'

  return buildAgentDecisionFrame({
    agentKey: 'technology-bakeoff',
    decisionType,
    objective: input.bakeoff.objective,
    selectedCandidate: input.selectedCandidate.id,
    candidatesConsidered: input.candidates.map((candidate) => candidate.id),
    rejectedCandidates: input.candidates
      .filter((candidate) => candidate.id !== input.selectedCandidate.id)
      .map((candidate) => ({ candidate: candidate.id, reason: candidate.watchOutFor })),
    trustSignals: [
      'Technology bakeoff evaluator evidence',
      'Alternatives considered before promotion',
      'Rollback path required before default change',
    ],
    riskSignals: [
      `Surface: ${input.bakeoff.surface}`,
      `Priority: ${input.bakeoff.priority}`,
      ...(input.bakeoff.knownFailure ? [`Known failure: ${input.bakeoff.knownFailure}`] : []),
    ],
    missingEvidence: input.missingEvidence,
    reversibility: 'moderate',
  })
}

export function buildPaymentAuthorityDecisionTrustFrame(input: {
  action: AgentAction
  label: string
  sourceRunId: string
  approvalType: string | null
}) {
  const paymentAuthority = isPaymentAuthorityAction(input.action)
  return buildAgentDecisionFrame({
    agentKey: 'chief-of-staff',
    decisionType: paymentAuthority ? 'spend' : 'action',
    objective: `Create approval checkpoint for ${input.label}.`,
    selectedCandidate: input.action,
    candidatesConsidered: [input.action],
    trustSignals: [
      'Agent Ops source run linked',
      'Existing agent approval gate selected',
    ],
    riskSignals: [
      paymentAuthority ? 'Payment or spend authority requested' : 'Approval-gated side effect requested',
      'Action does not execute during checkpoint creation',
    ],
    missingEvidence: [
      'Human approval decision',
      'Post-approval execution trace',
    ],
    confidence: 'medium',
    reversibility: paymentAuthority ? 'hard' : 'moderate',
    approvalType: input.approvalType,
    linkedRunId: input.sourceRunId,
  })
}

function stableDecisionId(parts: string[]) {
  const input = parts.join('::')
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0
  }
  return `decision_${Math.abs(hash).toString(36)}`
}
