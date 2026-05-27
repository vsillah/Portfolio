import { createHash } from 'crypto'
import { AGENT_DECISION_TRUST_EVENT } from '@/lib/agent-decision-trust'
import type { AgentGovernanceSnapshot } from '@/lib/agent-governance'
import type {
  OpenBrainEventRecord,
  OpenBrainRelationshipEdge,
  OpenBrainRelationshipInsight,
  OpenBrainRelationshipNode,
  OpenBrainSourceRecord,
} from '@/lib/open-brain'

export type DecisionTrustOpenBrainFrame = AgentGovernanceSnapshot['recent_decision_trust_frames'][number]

export type DecisionTrustOpenBrainProjection = {
  sources: OpenBrainSourceRecord[]
  events: OpenBrainEventRecord[]
}

const SECRETISH_PATTERN =
  /(sk-[A-Za-z0-9_-]{8,}|github_pat_[A-Za-z0-9_]{8,}|[A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Za-z0-9_]*\s*[:=]\s*["']?[^"'\s,}]+)/gi

export function buildDecisionTrustOpenBrainProjection(
  frames: DecisionTrustOpenBrainFrame[],
  options: { generatedAt?: string; maxFrames?: number } = {},
): DecisionTrustOpenBrainProjection {
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const frameLimit = options.maxFrames ?? 25
  const validFrames = frames.filter(isDecisionTrustFrame).slice(0, frameLimit)

  return {
    sources: validFrames.map((frame) => decisionTrustSource(frame, generatedAt)),
    events: validFrames.map((frame) => decisionTrustEvent(frame)),
  }
}

export function buildDecisionTrustRelationshipEdges(
  events: OpenBrainEventRecord[],
  nodes: OpenBrainRelationshipNode[],
): OpenBrainRelationshipEdge[] {
  return decisionTrustEvents(events).flatMap((event) => {
    const metadata = decisionTrustMetadata(event)
    if (!metadata || metadata.recommended_gate === 'block') return []

    const candidateNode = findCandidateNode(nodes, metadata.selected_candidate)
    if (!candidateNode) return []
    if (
      metadata.recommended_gate === 'allow' &&
      (metadata.scores.relationshipTrust < 0.65 || metadata.scores.evidenceCompleteness < 0.75)
    ) {
      return []
    }

    const relationship = metadata.recommended_gate === 'allow'
      ? 'trusted_for_decision'
      : metadata.recommended_gate === 'sandbox'
        ? 'sandbox_candidate_for'
        : 'requires_review_for_decision'
    const strength = metadata.recommended_gate === 'allow' ? 'medium' : 'weak'

    return [{
      id: `edge:decision-trust:${fingerprint([event.id, candidateNode.id, relationship]).slice(0, 16)}`,
      fromId: event.id,
      toId: candidateNode.id,
      relationship,
      strength,
      confidence: clampScore(Math.min(metadata.scores.relationshipTrust, metadata.scores.evidenceCompleteness)),
      evidence: sanitizeDecisionTrustText([
        `Decision ${metadata.decision_id} selected ${metadata.selected_candidate}.`,
        `Gate: ${metadata.recommended_gate}.`,
        metadata.evidence_summary,
      ].join(' '), 280),
      status: metadata.recommended_gate === 'allow' ? 'inferred' : 'recommended',
    } satisfies OpenBrainRelationshipEdge]
  })
}

export function buildDecisionTrustRelationshipInsights(
  events: OpenBrainEventRecord[],
  nodes: OpenBrainRelationshipNode[],
): OpenBrainRelationshipInsight[] {
  return decisionTrustEvents(events)
    .flatMap((event) => {
      const metadata = decisionTrustMetadata(event)
      if (!metadata) return []
      const candidateNode = findCandidateNode(nodes, metadata.selected_candidate)
      const needsReview = metadata.recommended_gate === 'human_review' ||
        metadata.recommended_gate === 'block' ||
        !candidateNode ||
        metadata.missing_evidence.length > 0

      if (!needsReview) return []

      const severity = metadata.recommended_gate === 'block'
        ? 'high'
        : metadata.recommended_gate === 'human_review' || metadata.scores.decisionRisk >= 0.55
          ? 'medium'
          : 'low'
      const missingEvidence = metadata.missing_evidence.length
        ? ` Missing evidence: ${metadata.missing_evidence.slice(0, 3).join(', ')}.`
        : ''

      return [{
        id: `insight:decision-trust:${metadata.decision_id}`,
        kind: 'decision_trust_review',
        severity,
        title: `Review decision trust: ${metadata.selected_candidate}`,
        detail: sanitizeDecisionTrustText(
          `Decision ${metadata.decision_id} recommended ${metadata.recommended_gate} for ${metadata.decision_type}. ${metadata.evidence_summary}${missingEvidence}`,
          360,
        ),
        recommendation: candidateNode
          ? 'Keep this relationship proposal-gated until the linked run and missing evidence are reviewed.'
          : 'Resolve the candidate to a durable Open Brain source, vendor, tool, or approval record before relying on this decision as trust evidence.',
        actionLabel: candidateNode ? 'Propose review link' : 'Record review proposal',
        sourceNodeId: event.id,
        targetNodeId: candidateNode?.id ?? null,
        decisionTrust: {
          decisionId: metadata.decision_id,
          linkedRunId: metadata.linked_run_id,
          selectedCandidate: metadata.selected_candidate,
          recommendedGate: metadata.recommended_gate,
          scores: metadata.scores,
          evidenceSummary: metadata.evidence_summary,
        },
      } satisfies OpenBrainRelationshipInsight]
    })
    .slice(0, 10)
}

function decisionTrustSource(frame: DecisionTrustOpenBrainFrame, generatedAt: string): OpenBrainSourceRecord {
  return {
    id: decisionTrustSourceId(frame),
    kind: 'agent_run',
    title: `Decision trust run ${shortId(frame.run_id)}`,
    summary: sanitizeDecisionTrustText(`${frame.agent_key} recorded ${frame.recommended_gate} for ${frame.selected_candidate}. ${evidenceSummary(frame)}`),
    path: `/admin/agents/runs/${encodeURIComponent(frame.run_id)}`,
    privacyTier: 'internal_ops',
    confidence: clampScore(frame.scores.evidenceCompleteness),
    lastObservedAt: frame.occurred_at || generatedAt,
    fingerprint: fingerprint(['decision-trust-source', frame.run_id, frame.decision_id, frame.occurred_at]),
  }
}

function decisionTrustEvent(frame: DecisionTrustOpenBrainFrame): OpenBrainEventRecord {
  return {
    id: decisionTrustEventId(frame.decision_id),
    kind: 'agent_decision_trust_observed',
    title: `Decision trust: ${frame.selected_candidate}`,
    summary: sanitizeDecisionTrustText(`${frame.decision_type.replace(/_/g, ' ')} decision recommended ${frame.recommended_gate}. ${evidenceSummary(frame)}`),
    privacyTier: 'internal_ops',
    confidence: clampScore(frame.scores.evidenceCompleteness),
    sourceIds: [decisionTrustSourceId(frame)],
    createdAt: frame.occurred_at,
    fingerprint: fingerprint(['decision-trust-event', frame.decision_id, frame.run_id, frame.occurred_at]),
    metadata: {
      agentRunEventType: AGENT_DECISION_TRUST_EVENT,
      decisionTrust: {
        decision_id: frame.decision_id,
        linked_run_id: frame.run_id,
        agent_key: frame.agent_key,
        decision_type: frame.decision_type,
        objective: sanitizeDecisionTrustText(frame.objective),
        selected_candidate: sanitizeDecisionTrustText(frame.selected_candidate, 180),
        candidates_considered: frame.candidates_considered.map((candidate) => sanitizeDecisionTrustText(candidate, 140)).slice(0, 8),
        recommended_gate: frame.recommended_gate,
        approval_type: frame.approval_type ? sanitizeDecisionTrustText(frame.approval_type, 140) : null,
        reversibility: sanitizeDecisionTrustText(frame.reversibility, 80),
        scores: frame.scores,
        trust_signals: frame.trust_signals.map((signal) => sanitizeDecisionTrustText(signal, 160)).slice(0, 6),
        risk_signals: frame.risk_signals.map((signal) => sanitizeDecisionTrustText(signal, 160)).slice(0, 6),
        missing_evidence: frame.missing_evidence.map((item) => sanitizeDecisionTrustText(item, 160)).slice(0, 6),
        evidence_summary: evidenceSummary(frame),
      },
    },
  }
}

function decisionTrustEvents(events: OpenBrainEventRecord[]) {
  return events.filter((event) => event.kind === 'agent_decision_trust_observed')
}

function decisionTrustMetadata(event: OpenBrainEventRecord) {
  const value = event.metadata?.decisionTrust
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const scores = scoreRecord(record.scores)
  const recommendedGate = stringField(record.recommended_gate)
  const decisionId = stringField(record.decision_id)
  const selectedCandidate = stringField(record.selected_candidate)
  const decisionType = stringField(record.decision_type)
  if (!scores || !decisionId || !selectedCandidate || !decisionType || !isDecisionTrustGate(recommendedGate)) return null
  return {
    decision_id: decisionId,
    linked_run_id: stringField(record.linked_run_id),
    agent_key: stringField(record.agent_key),
    decision_type: decisionType,
    objective: stringField(record.objective) || 'Decision trust frame recorded.',
    selected_candidate: selectedCandidate,
    candidates_considered: stringArrayField(record.candidates_considered),
    recommended_gate: recommendedGate,
    approval_type: stringField(record.approval_type),
    reversibility: stringField(record.reversibility) || 'unknown',
    scores,
    trust_signals: stringArrayField(record.trust_signals),
    risk_signals: stringArrayField(record.risk_signals),
    missing_evidence: stringArrayField(record.missing_evidence),
    evidence_summary: stringField(record.evidence_summary) || event.summary,
  }
}

function findCandidateNode(nodes: OpenBrainRelationshipNode[], candidate: string) {
  const normalizedCandidate = normalizeIdentifier(candidate)
  if (!normalizedCandidate) return null
  return nodes.find((node) => (
    node.id === candidate ||
    normalizeIdentifier(node.id) === normalizedCandidate ||
    normalizeIdentifier(node.label) === normalizedCandidate ||
    normalizeIdentifier(node.id.split(':').at(-1) || '') === normalizedCandidate
  )) ?? null
}

function evidenceSummary(frame: DecisionTrustOpenBrainFrame) {
  return sanitizeDecisionTrustText([
    `Trust ${Math.round(frame.scores.relationshipTrust * 100)}%.`,
    `Risk ${Math.round(frame.scores.decisionRisk * 100)}%.`,
    `Evidence ${Math.round(frame.scores.evidenceCompleteness * 100)}%.`,
    frame.missing_evidence.length ? `Missing: ${frame.missing_evidence.slice(0, 3).join(', ')}.` : 'No missing evidence recorded.',
  ].join(' '), 320)
}

function isDecisionTrustFrame(frame: DecisionTrustOpenBrainFrame) {
  return Boolean(
    frame?.decision_id &&
    frame.run_id &&
    frame.selected_candidate &&
    isDecisionTrustGate(frame.recommended_gate) &&
    scoreRecord(frame.scores),
  )
}

function isDecisionTrustGate(value: unknown): value is 'allow' | 'sandbox' | 'human_review' | 'block' {
  return value === 'allow' || value === 'sandbox' || value === 'human_review' || value === 'block'
}

function scoreRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const relationshipTrust = Number(record.relationshipTrust)
  const decisionRisk = Number(record.decisionRisk)
  const evidenceCompleteness = Number(record.evidenceCompleteness)
  if (![relationshipTrust, decisionRisk, evidenceCompleteness].every(Number.isFinite)) return null
  return {
    relationshipTrust: clampScore(relationshipTrust),
    decisionRisk: clampScore(decisionRisk),
    evidenceCompleteness: clampScore(evidenceCompleteness),
  }
}

function stringField(value: unknown) {
  return typeof value === 'string' && value.trim() ? sanitizeDecisionTrustText(value) : null
}

function stringArrayField(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => sanitizeDecisionTrustText(item))
}

function decisionTrustSourceId(frame: DecisionTrustOpenBrainFrame) {
  return `agent-run:${frame.run_id}:decision-trust`
}

function decisionTrustEventId(decisionId: string) {
  return `event:decision-trust:${decisionId}`
}

function shortId(value: string) {
  return value.slice(0, 8)
}

function normalizeIdentifier(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function clampScore(value: number) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2))
}

function sanitizeDecisionTrustText(value: string, maxLength = 220) {
  return value
    .replace(SECRETISH_PATTERN, '[redacted]')
    .replace(/private (chat|message|transcript|export)[^,.]*/gi, 'private source summary')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function fingerprint(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part)).join('\u001f')).digest('hex')
}
