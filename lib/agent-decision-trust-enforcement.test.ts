import { describe, expect, it } from 'vitest'
import { buildAgentDecisionFrame } from './agent-decision-trust'
import { recommendDecisionTrustEnforcement } from './agent-decision-trust-enforcement'

describe('agent decision trust enforcement recommendation', () => {
  it('keeps shadow mode non-blocking even for blocked frames', () => {
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

    const recommendation = recommendDecisionTrustEnforcement({ frame })

    expect(frame.recommended_gate).toBe('block')
    expect(recommendation).toMatchObject({
      mode: 'shadow',
      gate: 'block',
      mayProceed: true,
      requiresApproval: false,
      shouldBlock: false,
    })
  })

  it('warns in advisory mode without changing execution posture', () => {
    const frame = buildAgentDecisionFrame({
      agentKey: 'technology-bakeoff',
      decisionType: 'tool',
      objective: 'Compare tooling candidates.',
      selectedCandidate: 'new-tool',
      trustSignals: ['Candidate suggested'],
      riskSignals: ['Unknown source'],
      missingEvidence: ['Official docs', 'Current pricing', 'Source freshness', 'Rollback evidence'],
    })

    const recommendation = recommendDecisionTrustEnforcement({ frame, mode: 'advisory' })

    expect(frame.recommended_gate).toBe('sandbox')
    expect(recommendation.mayProceed).toBe(true)
    expect(recommendation.requiresApproval).toBe(false)
    expect(recommendation.shouldBlock).toBe(false)
    expect(recommendation.reason).toMatch(/sandboxed or read-only/i)
  })

  it('turns human review frames into soft approval requirements', () => {
    const frame = buildAgentDecisionFrame({
      agentKey: 'chief-of-staff',
      decisionType: 'spend',
      objective: 'Create a vendor payment checkpoint.',
      selectedCandidate: 'known-vendor',
      trustSignals: ['Prior approval recorded', 'Official source verified'],
      riskSignals: ['Vendor payment requested'],
      missingEvidence: [],
      reversibility: 'hard',
      approvalType: 'payment_make_vendor_payment',
    })

    const recommendation = recommendDecisionTrustEnforcement({
      frame,
      mode: 'soft_gate',
      action: 'make_vendor_payment',
      runtime: 'codex',
    })

    expect(recommendation).toMatchObject({
      mode: 'soft_gate',
      gate: 'human_review',
      mayProceed: false,
      requiresApproval: true,
      shouldBlock: false,
      approvalType: 'payment_make_vendor_payment',
    })
  })

  it('derives approval type from runtime policy when the frame does not carry one', () => {
    const frame = buildAgentDecisionFrame({
      agentKey: 'chief-of-staff',
      decisionType: 'action',
      objective: 'Send a client-facing email.',
      selectedCandidate: 'send_email',
      trustSignals: ['Agent Ops source run linked'],
      riskSignals: ['Outbound email requested'],
      missingEvidence: ['Human approval decision'],
      reversibility: 'moderate',
    })

    const recommendation = recommendDecisionTrustEnforcement({
      frame,
      mode: 'soft_gate',
      action: 'send_email',
      runtime: 'codex',
    })

    expect(frame.recommended_gate).toBe('human_review')
    expect(recommendation.requiresApproval).toBe(true)
    expect(recommendation.approvalType).toBe('send_email')
  })

  it('hard-blocks blocked frames without creating an approval bypass', () => {
    const frame = buildAgentDecisionFrame({
      agentKey: 'chief-of-staff',
      decisionType: 'oauth',
      objective: 'Authorize an app.',
      selectedCandidate: 'unknown-oauth-app',
      trustSignals: ['Search result found'],
      riskSignals: ['Typosquat app domain', 'OAuth app install requested', 'Broad access permissions requested'],
      missingEvidence: ['Official source confirmation'],
      reversibility: 'irreversible',
    })

    const recommendation = recommendDecisionTrustEnforcement({
      frame,
      mode: 'hard_block',
      action: 'external_api_call',
      runtime: 'codex',
    })

    expect(frame.recommended_gate).toBe('block')
    expect(recommendation).toMatchObject({
      mode: 'hard_block',
      gate: 'block',
      mayProceed: false,
      requiresApproval: false,
      shouldBlock: true,
    })
  })

  it('allows strong low-risk frames in soft-gate mode', () => {
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

    const recommendation = recommendDecisionTrustEnforcement({ frame, mode: 'soft_gate' })

    expect(frame.recommended_gate).toBe('allow')
    expect(recommendation).toMatchObject({
      mayProceed: true,
      requiresApproval: false,
      shouldBlock: false,
    })
    expect(recommendation.evidence).toMatchObject({
      decisionId: frame.decision_id,
      selectedCandidate: 'official-docs',
      linkedRunId: null,
    })
  })
})
