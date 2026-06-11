import { describe, expect, it } from 'vitest'
import {
  buildDecisionTrustOpenBrainProjection,
  buildDecisionTrustRelationshipEdges,
  buildDecisionTrustRelationshipInsights,
  type DecisionTrustOpenBrainFrame,
} from './decision-trust-open-brain'
import type { OpenBrainRelationshipNode } from './open-brain'

const generatedAt = '2026-05-27T12:00:00.000Z'

function frame(overrides: Partial<DecisionTrustOpenBrainFrame> = {}): DecisionTrustOpenBrainFrame {
  return {
    run_id: 'run-trust-1',
    decision_id: 'decision-trust-1',
    agent_key: 'chief-of-staff',
    decision_type: 'tool',
    objective: 'Choose the official runtime documentation.',
    selected_candidate: 'source:official-docs',
    candidates_considered: ['source:official-docs', 'source:blog-post'],
    trust_signals: ['Official source match', 'Trusted domain'],
    risk_signals: ['Read-only information use'],
    missing_evidence: [],
    scores: {
      relationshipTrust: 0.82,
      decisionRisk: 0.18,
      evidenceCompleteness: 0.9,
    },
    recommended_gate: 'allow',
    approval_type: null,
    reversibility: 'easy',
    occurred_at: generatedAt,
    ...overrides,
  }
}

function nodes(): OpenBrainRelationshipNode[] {
  return [
    {
      id: 'event:decision-trust:decision-trust-1',
      label: 'Decision trust: source:official-docs',
      type: 'event',
      kind: 'agent_decision_trust_observed',
      privacyTier: 'internal_ops',
      summary: 'Decision trust event.',
      path: null,
      health: 'green',
      x: 10,
      y: 10,
    },
    {
      id: 'source:official-docs',
      label: 'Official Docs',
      type: 'source',
      kind: 'runbook',
      privacyTier: 'public_safe',
      summary: 'Official documentation.',
      path: 'https://example.com/docs',
      health: 'green',
      x: 20,
      y: 20,
    },
  ]
}

describe('decision trust Open Brain projection', () => {
  it('turns an allow frame into an Open Brain event node and evidence edge', () => {
    const projection = buildDecisionTrustOpenBrainProjection([frame()], { generatedAt })
    const edges = buildDecisionTrustRelationshipEdges(projection.events, nodes())

    expect(projection.sources[0]).toEqual(expect.objectContaining({
      kind: 'agent_run',
      path: '/admin/agents/runs/run-trust-1',
    }))
    expect(projection.events[0]).toEqual(expect.objectContaining({
      kind: 'agent_decision_trust_observed',
      sourceIds: ['agent-run:run-trust-1:decision-trust'],
    }))
    expect(edges).toEqual([
      expect.objectContaining({
        fromId: 'event:decision-trust:decision-trust-1',
        toId: 'source:official-docs',
        relationship: 'trusted_for_decision',
        strength: 'medium',
        status: 'inferred',
      }),
    ])
  })

  it('creates a review insight for a human-review frame', () => {
    const projection = buildDecisionTrustOpenBrainProjection([
      frame({
        decision_type: 'spend',
        recommended_gate: 'human_review',
        risk_signals: ['Payment or spend authority requested'],
        missing_evidence: ['Human approval decision'],
        scores: {
          relationshipTrust: 0.78,
          decisionRisk: 0.72,
          evidenceCompleteness: 0.62,
        },
      }),
    ], { generatedAt })
    const insights = buildDecisionTrustRelationshipInsights(projection.events, nodes())

    expect(insights[0]).toEqual(expect.objectContaining({
      kind: 'decision_trust_review',
      severity: 'medium',
      sourceNodeId: 'event:decision-trust:decision-trust-1',
      targetNodeId: 'source:official-docs',
      decisionTrust: expect.objectContaining({
        decisionId: 'decision-trust-1',
        recommendedGate: 'human_review',
      }),
    }))
  })

  it('does not create a positive edge for a blocked frame', () => {
    const projection = buildDecisionTrustOpenBrainProjection([
      frame({
        recommended_gate: 'block',
        risk_signals: ['Domain mismatch and impersonation marker'],
        scores: {
          relationshipTrust: 0.2,
          decisionRisk: 0.98,
          evidenceCompleteness: 0.7,
        },
      }),
    ], { generatedAt })

    expect(buildDecisionTrustRelationshipEdges(projection.events, nodes())).toEqual([])
    expect(buildDecisionTrustRelationshipInsights(projection.events, nodes())).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'decision_trust_review',
        severity: 'high',
        title: 'Blocked or scam-marked decision: source:official-docs',
      }),
    ]))
  })

  it('creates an insight instead of a fake node for an unresolved candidate', () => {
    const projection = buildDecisionTrustOpenBrainProjection([
      frame({
        selected_candidate: 'unknown-vendor',
        recommended_gate: 'sandbox',
        missing_evidence: ['Official docs not found'],
      }),
    ], { generatedAt })
    const graphNodes = nodes().filter((node) => node.id !== 'source:official-docs')

    expect(buildDecisionTrustRelationshipEdges(projection.events, graphNodes)).toEqual([])
    expect(buildDecisionTrustRelationshipInsights(projection.events, graphNodes)).toEqual(expect.arrayContaining([
      expect.objectContaining({
      targetNodeId: null,
      recommendation: expect.stringContaining('Resolve the candidate'),
      }),
    ]))
  })

  it('sanitizes private evidence and secret-like text', () => {
    const projection = buildDecisionTrustOpenBrainProjection([
      frame({
        trust_signals: ['Credential marker API_KEY=secret-value'],
        missing_evidence: ['private chat export with API_KEY=secret-value'],
      }),
    ], { generatedAt })
    const serialized = JSON.stringify(projection)

    expect(serialized).toContain('private source summary')
    expect(serialized).toContain('[redacted]')
    expect(serialized).not.toContain('private chat export')
    expect(serialized).not.toContain('secret-value')
  })

  it('surfaces repeated unresolved candidates without creating fake trust nodes', () => {
    const projection = buildDecisionTrustOpenBrainProjection([
      frame({
        run_id: 'run-unknown-1',
        decision_id: 'decision-unknown-1',
        selected_candidate: 'unknown-vendor',
        recommended_gate: 'sandbox',
      }),
      frame({
        run_id: 'run-unknown-2',
        decision_id: 'decision-unknown-2',
        selected_candidate: 'unknown-vendor',
        recommended_gate: 'sandbox',
        occurred_at: '2026-05-27T13:00:00.000Z',
      }),
    ], { generatedAt })
    const graphNodes = nodes().filter((node) => node.id !== 'source:official-docs')

    expect(buildDecisionTrustRelationshipEdges(projection.events, graphNodes)).toEqual([])
    expect(buildDecisionTrustRelationshipInsights(projection.events, graphNodes)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Repeated unresolved Decision Trust candidate: unknown-vendor',
        severity: 'medium',
        targetNodeId: null,
        decisionTrust: expect.objectContaining({
          decisionId: 'decision-unknown-2',
          selectedCandidate: 'unknown-vendor',
        }),
      }),
    ]))
  })

  it('surfaces repeated human-review gates as a pattern', () => {
    const projection = buildDecisionTrustOpenBrainProjection([
      frame({
        run_id: 'run-review-1',
        decision_id: 'decision-review-1',
        selected_candidate: 'source:official-docs',
        recommended_gate: 'human_review',
        risk_signals: ['Payment or spend authority requested'],
        scores: {
          relationshipTrust: 0.72,
          decisionRisk: 0.62,
          evidenceCompleteness: 0.68,
        },
      }),
      frame({
        run_id: 'run-review-2',
        decision_id: 'decision-review-2',
        selected_candidate: 'source:official-docs',
        recommended_gate: 'human_review',
        risk_signals: ['Payment or spend authority requested'],
        occurred_at: '2026-05-27T13:00:00.000Z',
        scores: {
          relationshipTrust: 0.74,
          decisionRisk: 0.74,
          evidenceCompleteness: 0.66,
        },
      }),
    ], { generatedAt })

    expect(buildDecisionTrustRelationshipInsights(projection.events, nodes())).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Repeated human review gate: source:official-docs',
        severity: 'high',
        targetNodeId: 'source:official-docs',
        decisionTrust: expect.objectContaining({
          decisionId: 'decision-review-2',
          recommendedGate: 'human_review',
        }),
      }),
    ]))
  })

  it('surfaces stale or weak evidence before it strengthens trust', () => {
    const projection = buildDecisionTrustOpenBrainProjection([
      frame({
        run_id: 'run-stale',
        decision_id: 'decision-stale',
        selected_candidate: 'source:official-docs',
        missing_evidence: ['Source freshness check is stale'],
        occurred_at: '2026-05-01T12:00:00.000Z',
        scores: {
          relationshipTrust: 0.72,
          decisionRisk: 0.25,
          evidenceCompleteness: 0.42,
        },
      }),
    ], { generatedAt })

    expect(buildDecisionTrustRelationshipInsights(projection.events, nodes(), { now: '2026-05-27T12:00:00.000Z' })).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Refresh stale Decision Trust evidence: source:official-docs',
        severity: 'high',
        targetNodeId: 'source:official-docs',
      }),
    ]))
  })

  it('surfaces blocked scam or domain-mismatch markers as high-severity review', () => {
    const projection = buildDecisionTrustOpenBrainProjection([
      frame({
        run_id: 'run-scam',
        decision_id: 'decision-scam',
        selected_candidate: 'lookalike-vendor',
        recommended_gate: 'block',
        risk_signals: ['Domain mismatch and scam marker'],
        scores: {
          relationshipTrust: 0.12,
          decisionRisk: 0.98,
          evidenceCompleteness: 0.7,
        },
      }),
    ], { generatedAt })

    expect(buildDecisionTrustRelationshipInsights(projection.events, nodes())).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Blocked or scam-marked decision: lookalike-vendor',
        severity: 'high',
        targetNodeId: null,
      }),
    ]))
  })
})
