import { describe, expect, it } from 'vitest'
import { AUTOMATION_GOAL_SEEDS, validateAutomationGoalCatalog } from './agent-automation-goals'

describe('agent automation goal catalog', () => {
  it('has valid owners and task definitions', () => {
    expect(validateAutomationGoalCatalog()).toEqual([])
  })

  it('prioritizes Tier 1 goals that can create tracked work immediately', () => {
    const tierOne = AUTOMATION_GOAL_SEEDS.filter((goal) => goal.tier === 1)

    expect(tierOne.map((goal) => goal.id)).toEqual([
      'inbound-lead-triage-to-booking',
      'meeting-intake-follow-up-drafts',
      'warm-lead-review-ready-outreach',
      'cold-lead-draft-sequence',
      'meeting-to-social-drafts',
      'value-evidence-presentation-package',
    ])
    expect(tierOne.every((goal) => goal.tasks.length > 0)).toBe(true)
    expect(tierOne.every((goal) => goal.approvalGate.length > 0)).toBe(true)
  })

  it('covers the portfolio automation backlog families before aesthetic expansion', () => {
    const families = new Set(AUTOMATION_GOAL_SEEDS.map((goal) => goal.workflowFamily))

    expect([...families]).toEqual(expect.arrayContaining([
      'inbound_sales',
      'warm_lead_capture',
      'cold_outreach',
      'social_content',
      'video_content',
      'lead_value_package',
      'meeting_follow_up',
      'client_reporting',
      'client_delivery',
      'revenue_operations',
      'knowledge_governance',
      'risk_compliance',
    ]))
  })

  it('marks workflow-generation candidates without treating them as production activation', () => {
    const workflowCandidates = AUTOMATION_GOAL_SEEDS.filter((goal) => goal.requiresNewWorkflow)

    expect(workflowCandidates.length).toBeGreaterThan(0)
    expect(workflowCandidates.every((goal) => goal.approvalGate.toLowerCase().includes('approval'))).toBe(true)
  })
})
