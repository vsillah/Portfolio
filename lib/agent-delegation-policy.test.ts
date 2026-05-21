import { describe, expect, it } from 'vitest'
import {
  applyDelegationDecisionToEngagements,
  evaluateAgentDelegationPolicy,
  inferDelegationRule,
} from './agent-delegation-policy'

describe('agent delegation policy', () => {
  it('routes payment and spend work to the automation systems owner with payment risk', () => {
    const decision = evaluateAgentDelegationPolicy({
      message: 'Can an agent create a refund or checkout session for this client?',
      proposedAgentKeys: ['research-source-register'],
    })

    expect(decision.task_type).toBe('payment')
    expect(decision.risk_class).toBe('payment_spend')
    expect(decision.selected_agent_key).toBe('automation-systems')
    expect(decision.required_evidence).toContain('approval')
  })

  it('keeps research requests on the source-register lane', () => {
    const rule = inferDelegationRule('Find source-backed evidence for this claim before publishing.')
    expect(rule.taskType).toBe('research')
  })

  it('places the deterministic selected agent first in engagement proposals', () => {
    const decision = evaluateAgentDelegationPolicy({
      message: 'Route this n8n workflow proposal.',
      proposedAgentKeys: ['engineering-copilot'],
    })
    const engagements = applyDelegationDecisionToEngagements([
      {
        agentKey: 'engineering-copilot',
        agentName: 'Piye (Kush) - Engineering Copilot',
        label: 'Run Piye',
        rationale: 'Implement code.',
        status: 'partial',
        executionMode: 'read_only',
      },
    ], decision)

    expect(engagements[0]?.agentKey).toBe('automation-systems')
    expect(engagements[1]?.agentKey).toBe('engineering-copilot')
  })
})
