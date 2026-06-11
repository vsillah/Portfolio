import { describe, expect, it } from 'vitest'

import {
  evaluateContentGoalOrchestration,
  initialContentOrchestrationReview,
} from './goal-orchestration'

const done = { status: 'ready_for_review', validation_summary: 'done' }

describe('goal orchestration', () => {
  it('starts content review below the human approval gate', () => {
    expect(initialContentOrchestrationReview({
      goalType: 'social_outreach_linkedin_post',
      approvalBoundary: 'Publishing remains separately approved.',
    })).toMatchObject({
      current_gate: 'research_context_evidence',
      gate_status: 'research_pending',
      challenger_status: 'pending',
      pass_to_human: false,
      approval_status: 'not_ready',
    })
  })

  it('blocks challenger clearance until research is complete', () => {
    const packet = evaluateContentGoalOrchestration([
      { title: 'Capture the industry signal', status: 'assigned' },
      { title: 'Pull approved Open Brain context', ...done },
      { title: 'Attach manual Chronicle evidence packet', ...done },
    ])

    expect(packet).toMatchObject({
      current_gate: 'research_context_evidence',
      gate_status: 'research_pending',
      pass_to_human: false,
      challenger_status: 'pending',
    })
  })

  it('routes challenger findings to repair instead of human review', () => {
    const packet = evaluateContentGoalOrchestration([
      { title: 'Capture the industry signal', ...done },
      { title: 'Pull approved Open Brain context', ...done },
      { title: 'Attach manual Chronicle evidence packet', ...done },
      { title: 'Select AmaduTown proof points', ...done },
      { title: 'Draft the LinkedIn post', ...done },
      { title: 'Create the visual brief', ...done },
      {
        title: 'Run content QA and governance review',
        status: 'ready_for_review',
        metadata: { challenger_status: 'needs_revision', unsupported_claims: ['autonomous production mutation'] },
      },
    ])

    expect(packet).toMatchObject({
      current_gate: 'repair_loop',
      gate_status: 'needs_revision',
      challenger_status: 'needs_revision',
      pass_to_human: false,
    })
    expect(packet.residual_risks_for_human).toContain('Unsupported claim: autonomous production mutation')
  })

  it('passes clean challenger review to human review', () => {
    const packet = evaluateContentGoalOrchestration([
      { title: 'Capture the industry signal', ...done },
      { title: 'Pull approved Open Brain context', ...done },
      { title: 'Attach manual Chronicle evidence packet', ...done },
      { title: 'Select AmaduTown proof points', ...done },
      { title: 'Draft the LinkedIn post', ...done },
      { title: 'Create the visual brief', ...done },
      {
        title: 'Run content QA and governance review',
        status: 'ready_for_review',
        validation_summary: 'Amina challenger pass recorded.',
        metadata: { challenger_status: 'passed' },
      },
    ])

    expect(packet).toMatchObject({
      current_gate: 'human_review',
      gate_status: 'human_review_ready',
      challenger_status: 'passed',
      pass_to_human: true,
    })
  })
})
