import { describe, expect, it } from 'vitest'
import { buildAgentCapabilityProfiles, buildAgentGovernanceSnapshot, parseDecisionTrustFrames } from './agent-governance'

describe('agent governance', () => {
  it('derives least-privilege capability profiles from the agent organization', () => {
    const profiles = buildAgentCapabilityProfiles()
    const shaka = profiles.find((profile) => profile.agent_key === 'chief-of-staff')
    const automation = profiles.find((profile) => profile.agent_key === 'automation-systems')
    const planned = profiles.find((profile) => profile.agent_key === 'proposal-business-model')

    expect(shaka).toMatchObject({
      display_name: 'Shaka (Zulu) - Chief of Staff',
      review_status: 'reviewed',
    })
    expect(shaka?.allowed_data_classes).toContain('cross_agent_status')
    expect(automation?.spend_authority).toBe('approval_required')
    expect(automation?.approval_required_for).toContain('create_checkout_session')
    expect(planned?.allowed_write_classes).toEqual(['none_until_reviewed'])
  })

  it('builds a mission-control governance snapshot with payment and delegation signals', () => {
    const snapshot = buildAgentGovernanceSnapshot({
      approvals: [
        {
          id: 'approval-payment',
          run_id: 'run-payment',
          approval_type: 'payment_create_refund',
          status: 'pending',
          requested_at: '2026-05-21T00:00:00.000Z',
          requested_by_agent_key: 'chief-of-staff',
          metadata: {
            action_payload: {
              source_run_id: 'run-source',
              action: 'create_refund',
              label: 'Create refund',
              risk_level: 'high',
              side_effect_boundary: 'No refund is issued until this payment authority checkpoint is approved and linked to a trace.',
              executes_action: false,
            },
            decision_trust_enforcement: {
              mode: 'soft_gate',
              gate: 'human_review',
              mayProceed: false,
              requiresApproval: true,
              shouldBlock: false,
              approvalType: 'payment_create_refund',
              reason: 'Soft-gate mode requires human approval before this Decision Trust frame can produce a side effect.',
              evidence: {
                decisionId: 'decision-refund',
                linkedRunId: 'run-source',
                selectedCandidate: 'create_refund',
                missingEvidence: ['Human approval decision', 'private chat export payment notes'],
              },
            },
          },
        },
      ],
      events: [
        {
          run_id: 'run-shaka',
          event_type: 'delegation_decision_recorded',
          severity: 'warning',
          message: 'Yaa Asantewaa matches payment work.',
          occurred_at: '2026-05-21T00:01:00.000Z',
          metadata: {
            selected_agent_key: 'automation-systems',
            selected_agent_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
            task_type: 'payment',
            risk_class: 'payment_spend',
            confidence: 0.9,
            required_evidence: ['approval_record', 'payment_object', 'trace_id'],
            approval_gate: 'payment_create_refund',
            fallback_agent_key: 'chief-of-staff',
            alternatives_considered: ['chief-of-staff'],
            decision_trust_enforcement: {
              mode: 'advisory',
              gate: 'human_review',
              mayProceed: true,
              requiresApproval: false,
              shouldBlock: false,
              approvalType: 'payment_create_refund',
              reason: 'Advisory mode warns that this Decision Trust frame needs human review before side effects.',
              evidence: {
                decisionId: 'decision-delegation',
                linkedRunId: 'run-shaka',
                selectedCandidate: 'automation-systems',
                missingEvidence: ['private message export routing detail'],
              },
            },
          },
        },
        {
          run_id: 'run-trust',
          event_type: 'agent_decision_trust_recorded',
          severity: 'warning',
          message: 'payment_make_vendor_payment: human_review',
          occurred_at: '2026-05-21T00:01:30.000Z',
          metadata: {
            decision_id: 'decision-payment',
            agent_key: 'chief-of-staff',
            decision_type: 'spend',
            objective: 'Create a vendor payment checkpoint.',
            selected_candidate: 'make_vendor_payment',
            candidates_considered: ['make_vendor_payment'],
            trust_signals: ['Agent Ops source run linked', 'Existing agent approval gate selected'],
            risk_signals: ['Payment or spend authority requested'],
            missing_evidence: ['Human approval decision', 'private chat export abc123'],
            scores: {
              relationshipTrust: 0.57,
              decisionRisk: 0.62,
              evidenceCompleteness: 0.6,
            },
            recommended_gate: 'human_review',
            approval_type: 'payment_make_vendor_payment',
            reversibility: 'hard',
            decision_trust_enforcement: {
              mode: 'soft_gate',
              gate: 'human_review',
              mayProceed: false,
              requiresApproval: true,
              shouldBlock: false,
              approvalType: 'payment_make_vendor_payment',
              reason: 'Soft-gate mode requires human approval before this Decision Trust frame can produce a side effect.',
              evidence: {
                decisionId: 'decision-payment',
                linkedRunId: 'run-trust',
                selectedCandidate: 'make_vendor_payment',
                missingEvidence: ['Human approval decision', 'private message export detail'],
              },
            },
          },
        },
        {
          run_id: 'run-malformed',
          event_type: 'agent_decision_trust_recorded',
          severity: 'info',
          message: 'Malformed frame ignored.',
          occurred_at: '2026-05-21T00:01:20.000Z',
          metadata: {
            decision_id: 'decision-bad',
            decision_type: 'not_real',
          },
        },
      ],
      exports: [
        {
          id: 'export-1',
          export_type: 'agent_governance_client_audit',
          format: 'markdown',
          classification: 'client_safe',
          run_id: 'run-shaka',
          client_project_id: 'client-456',
          from_at: '2026-05-01T00:00:00.000Z',
          to_at: '2026-05-21T23:59:59.999Z',
          matching_run_count: 1,
          requested_by_user_id: 'admin-user',
          generated_at: '2026-05-21T00:02:00.000Z',
          created_at: '2026-05-21T00:02:01.000Z',
        },
      ],
    })

    expect(snapshot.summary.payment_authority_actions).toBe(6)
    expect(snapshot.summary.pending_authority_approvals).toBe(1)
    expect(snapshot.pending_authority_approvals[0]?.approval_type).toBe('payment_create_refund')
    expect(snapshot.pending_authority_approvals[0]?.metadata?.authority_packet).toMatchObject({
      approval_id: 'approval-payment',
      source_run_id: 'run-source',
      action: 'create_refund',
      label: 'Create refund',
      risk_level: 'high',
      executes_action: false,
    })
    expect(snapshot.pending_authority_approvals[0]?.metadata?.decision_trust_enforcement).toMatchObject({
      mode: 'soft_gate',
      gate: 'human_review',
      requires_approval: true,
      approval_type: 'payment_create_refund',
      evidence: {
        missing_evidence: ['Human approval decision', 'private source summary'],
      },
    })
    expect(snapshot.recent_delegation_decisions[0]).toMatchObject({
      selected_agent_key: 'automation-systems',
      task_type: 'payment',
      risk_class: 'payment_spend',
      required_evidence: ['approval_record', 'payment_object', 'trace_id'],
      approval_gate: 'payment_create_refund',
      fallback_agent_key: 'chief-of-staff',
      alternatives_considered: ['chief-of-staff'],
      decision_trust_enforcement: {
        mode: 'advisory',
        gate: 'human_review',
        may_proceed: true,
        requires_approval: false,
        should_block: false,
        approval_type: 'payment_create_refund',
        evidence: {
          missing_evidence: ['private source summary'],
        },
      },
    })
    expect(snapshot.recent_decision_trust_frames).toHaveLength(1)
    expect(snapshot.recent_decision_trust_frames[0]).toMatchObject({
      run_id: 'run-trust',
      decision_id: 'decision-payment',
      agent_key: 'chief-of-staff',
      decision_type: 'spend',
      selected_candidate: 'make_vendor_payment',
      recommended_gate: 'human_review',
      approval_type: 'payment_make_vendor_payment',
      decision_trust_enforcement: {
        mode: 'soft_gate',
        gate: 'human_review',
        may_proceed: false,
        requires_approval: true,
        should_block: false,
        approval_type: 'payment_make_vendor_payment',
        evidence: {
          missing_evidence: ['Human approval decision', 'private source summary'],
        },
      },
    })
    expect(snapshot.recent_decision_trust_frames[0]?.missing_evidence.join(' ')).toContain('private source summary')
    expect(snapshot.recent_decision_trust_frames[0]?.missing_evidence.join(' ')).not.toContain('private chat export')
    expect(snapshot.recent_governance_exports[0]).toMatchObject({
      id: 'export-1',
      format: 'markdown',
      run_id: 'run-shaka',
      client_project_id: 'client-456',
    })
  })

  it('exports a safe decision trust parser with configurable limits', () => {
    const events = Array.from({ length: 7 }, (_, index) => ({
      run_id: `run-${index}`,
      event_type: 'agent_decision_trust_recorded',
      severity: 'info',
      message: 'Decision trust recorded.',
      occurred_at: `2026-05-21T00:0${index}:00.000Z`,
      metadata: {
        decision_id: `decision-${index}`,
        agent_key: 'chief-of-staff',
        decision_type: 'tool',
        objective: 'Choose a tool.',
        selected_candidate: `tool-${index}`,
        candidates_considered: [`tool-${index}`],
        trust_signals: ['Official source match'],
        risk_signals: ['Read-only use'],
        missing_evidence: [],
        scores: {
          relationshipTrust: 0.75,
          decisionRisk: 0.2,
          evidenceCompleteness: 0.88,
        },
        recommended_gate: 'allow',
        approval_type: null,
        reversibility: 'easy',
      },
    }))

    expect(parseDecisionTrustFrames(events, 3)).toHaveLength(3)
    expect(parseDecisionTrustFrames([
      {
        run_id: 'run-bad',
        event_type: 'agent_decision_trust_recorded',
        severity: 'info',
        message: 'Malformed frame ignored.',
        occurred_at: '2026-05-21T00:00:00.000Z',
        metadata: { decision_id: 'bad', recommended_gate: 'allow' },
      },
    ])).toEqual([])
  })
})
