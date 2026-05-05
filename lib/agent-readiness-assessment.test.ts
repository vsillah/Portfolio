import { describe, expect, it } from 'vitest'
import { buildAgentReadinessAssessment } from './agent-readiness-assessment'

describe('buildAgentReadinessAssessment', () => {
  it('routes scattered document-heavy organizations to context layer first', () => {
    const result = buildAgentReadinessAssessment({
      systems: ['google_drive', 'email', 'spreadsheets'],
      ownership_clarity: 'partial',
      assignee_clarity: 'none',
      status_tracking: 'none',
      handoff_clarity: 'partial',
      audit_trails: 'none',
      permission_controls: 'partial',
      api_access: 'some',
      data_quality: 'partial',
      reversibility: 'partial',
      business_risk: 'medium',
    })

    expect(result.overallLevel).toBe('context_layer_first')
    expect(result.recommendationTier).toBe(2)
    expect(result.systems.some((system) => system.classification === 'context_only')).toBe(true)
  })

  it('recommends workflow copilots when systems are structured but not autonomous-ready', () => {
    const result = buildAgentReadinessAssessment({
      systems: ['hubspot', 'asana'],
      ownership_clarity: 'documented',
      assignee_clarity: 'documented',
      status_tracking: 'documented',
      handoff_clarity: 'partial',
      audit_trails: 'partial',
      permission_controls: 'documented',
      api_access: 'some',
      data_quality: 'mostly',
      reversibility: 'partial',
      business_risk: 'medium',
    })

    expect(result.overallLevel).toBe('workflow_copilot')
    expect(result.recommendationTier).toBe(3)
  })

  it('keeps high-risk systems approval-gated even when structure is strong', () => {
    const result = buildAgentReadinessAssessment({
      systems: ['workday', 'payroll', 'jira'],
      ownership_clarity: 'strong',
      assignee_clarity: 'strong',
      status_tracking: 'strong',
      handoff_clarity: 'strong',
      audit_trails: 'strong',
      permission_controls: 'strong',
      api_access: 'strong',
      data_quality: 'strong',
      reversibility: 'strong',
      business_risk: 'high',
    })

    expect(result.overallLevel).toBe('approval_gated_agent')
    expect(result.recommendationTier).toBe(4)
    expect(result.systems.find((system) => system.category === 'payroll')?.recommendedAiRole).toBe('draft_with_approval')
  })

  it('allows bounded autonomy for low-risk mature workflow systems', () => {
    const result = buildAgentReadinessAssessment({
      systems: ['jira', 'linear', 'service_now'],
      ownership_clarity: 'mature',
      assignee_clarity: 'mature',
      status_tracking: 'mature',
      handoff_clarity: 'mature',
      audit_trails: 'mature',
      permission_controls: 'mature',
      api_access: 'mature',
      data_quality: 'mature',
      reversibility: 'mature',
      business_risk: 'low',
    })

    expect(result.overallLevel).toBe('bounded_autonomy')
    expect(result.recommendationTier).toBe(5)
  })
})
