import { describe, expect, it } from 'vitest'
import { AUTOMATION_GOAL_SEEDS, validateAutomationGoalCatalog } from './agent-automation-goals'

describe('agent automation goal catalog', () => {
  it('has valid owners and task definitions', () => {
    expect(validateAutomationGoalCatalog()).toEqual([])
  })

  it('prioritizes Tier 1 goals that can create tracked work immediately', () => {
    const tierOne = AUTOMATION_GOAL_SEEDS.filter((goal) => goal.tier === 1)

    expect(tierOne.map((goal) => goal.id)).toEqual([
      'meeting-intake-follow-up-drafts',
      'warm-lead-review-ready-outreach',
      'cold-lead-draft-sequence',
      'meeting-to-social-drafts',
      'value-evidence-presentation-package',
    ])
    expect(tierOne.every((goal) => goal.tasks.length > 0)).toBe(true)
    expect(tierOne.every((goal) => goal.approvalGate.length > 0)).toBe(true)
  })

  it('marks workflow-generation candidates without treating them as production activation', () => {
    const workflowCandidates = AUTOMATION_GOAL_SEEDS.filter((goal) => goal.requiresNewWorkflow)

    expect(workflowCandidates.length).toBeGreaterThan(0)
    expect(workflowCandidates.every((goal) => goal.approvalGate.toLowerCase().includes('approval'))).toBe(true)
  })
})
