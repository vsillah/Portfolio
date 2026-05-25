import { describe, expect, it } from 'vitest'
import {
  buildAgentDecisionFrame,
  buildPaymentAuthorityDecisionTrustFrame,
  scoreAgentDecisionTrust,
} from './agent-decision-trust'

describe('agent decision trust', () => {
  it('allows official read-only source use when evidence is complete', () => {
    const frame = buildAgentDecisionFrame({
      agentKey: 'research-source-register',
      decisionType: 'information',
      objective: 'Use official vendor docs for a read-only comparison.',
      selectedCandidate: 'official-docs',
      candidatesConsidered: ['official-docs', 'blog-summary'],
      trustSignals: ['Official source verified', 'Domain match confirmed', 'Source evidence linked'],
      riskSignals: ['Read-only source review'],
      missingEvidence: [],
      reversibility: 'easy',
    })

    expect(frame.recommended_gate).toBe('allow')
    expect(frame.scores.relationshipTrust).toBeGreaterThanOrEqual(0.65)
    expect(frame.scores.evidenceCompleteness).toBeGreaterThanOrEqual(0.9)
  })

  it('routes unknown paid vendor decisions to human review', () => {
    const frame = buildAgentDecisionFrame({
      agentKey: 'automation-systems',
      decisionType: 'spend',
      objective: 'Start a paid external scraping job.',
      selectedCandidate: 'unknown-vendor',
      trustSignals: ['Vendor website found'],
      riskSignals: ['Unknown vendor', 'Paid external job requested'],
      missingEvidence: ['Official docs', 'Pricing terms', 'Cancellation terms'],
      reversibility: 'hard',
      approvalType: 'payment_start_paid_external_job',
    })

    expect(frame.recommended_gate).toBe('human_review')
    expect(frame.scores.decisionRisk).toBeGreaterThanOrEqual(0.55)
  })

  it('blocks suspicious domain mismatch decisions', () => {
    const frame = buildAgentDecisionFrame({
      agentKey: 'chief-of-staff',
      decisionType: 'vendor',
      objective: 'Choose a payment destination.',
      selectedCandidate: 'stripe-support-payments.example',
      trustSignals: ['Search result appeared high on the page'],
      riskSignals: ['Domain mismatch', 'Possible impersonation', 'Payment requested'],
      missingEvidence: ['Official source confirmation'],
      reversibility: 'irreversible',
    })

    expect(frame.recommended_gate).toBe('block')
  })

  it('uses prior approval as trust evidence without bypassing payment review', () => {
    const frame = buildAgentDecisionFrame({
      agentKey: 'chief-of-staff',
      decisionType: 'spend',
      objective: 'Create a vendor payment checkpoint.',
      selectedCandidate: 'known-vendor',
      trustSignals: ['Prior approval recorded', 'Prior successful use recorded', 'Official source verified'],
      riskSignals: ['Vendor payment requested'],
      missingEvidence: [],
      reversibility: 'hard',
      approvalType: 'payment_make_vendor_payment',
    })

    expect(frame.scores.relationshipTrust).toBeGreaterThanOrEqual(0.8)
    expect(frame.recommended_gate).toBe('human_review')
  })

  it('lowers evidence completeness when evidence is stale or missing', () => {
    const complete = buildAgentDecisionFrame({
      agentKey: 'technology-bakeoff',
      decisionType: 'tool',
      objective: 'Compare tooling candidates.',
      selectedCandidate: 'current-default',
      trustSignals: ['Known internal source'],
      riskSignals: ['Read-only planning'],
      missingEvidence: [],
    })
    const incomplete = buildAgentDecisionFrame({
      agentKey: 'technology-bakeoff',
      decisionType: 'tool',
      objective: 'Compare tooling candidates.',
      selectedCandidate: 'new-tool',
      trustSignals: ['Candidate suggested'],
      riskSignals: ['Unknown source'],
      missingEvidence: ['Official docs', 'Current pricing', 'Source freshness', 'Rollback evidence'],
    })

    expect(incomplete.scores.evidenceCompleteness).toBeLessThan(complete.scores.evidenceCompleteness)
    expect(incomplete.recommended_gate).toBe('sandbox')
  })

  it('routes OAuth and broad app permissions to human review', () => {
    const result = scoreAgentDecisionTrust({
      decision_type: 'oauth',
      trust_signals: ['Official source verified'],
      risk_signals: ['OAuth app install requested', 'Broad access permissions requested'],
      missing_evidence: ['Permission minimization proof'],
      approval_type: null,
      reversibility: 'hard',
    })

    expect(result.recommended_gate).toBe('human_review')
  })

  it('builds payment authority frames with human review as the minimum gate', () => {
    const frame = buildPaymentAuthorityDecisionTrustFrame({
      action: 'create_refund',
      label: 'Create refund',
      sourceRunId: 'run-source',
      approvalType: 'payment_create_refund',
    })

    expect(frame.decision_type).toBe('spend')
    expect(frame.linked_run_id).toBe('run-source')
    expect(frame.recommended_gate).toBe('human_review')
  })
})
