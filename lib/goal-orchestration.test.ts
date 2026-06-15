import { describe, expect, it } from 'vitest'

import {
  evaluateGoalOrchestration,
  evaluateContentGoalOrchestration,
  inferWorkItemOrchestrationGate,
  initialContentOrchestrationReview,
} from './goal-orchestration'

const done = { status: 'ready_for_review', validation_summary: 'done' }

const contentResearchAndDraftDone = [
  { title: 'Capture the industry signal', ...done },
  { title: 'Pull approved Open Brain context', ...done },
  { title: 'Attach manual Chronicle evidence packet', ...done },
  { title: 'Select AmaduTown proof points', ...done },
  { title: 'Draft the LinkedIn post', ...done },
  { title: 'Create the visual brief', ...done },
]

const productionPacketDone = [
  { title: 'Reference and citation check for LinkedIn claims', ...done },
  { title: 'Carousel and illustration production packet', ...done },
  { title: 'Human editorial review bundle', ...done },
  { title: 'Social Content draft handoff', ...done },
]

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

  it('blocks human review until production packet work is complete', () => {
    const packet = evaluateContentGoalOrchestration([
      ...contentResearchAndDraftDone,
      { title: 'Reference and citation check for LinkedIn claims', ...done },
      { title: 'Carousel and illustration production packet', status: 'in_progress' },
      { title: 'Human editorial review bundle', ...done },
      { title: 'Social Content draft handoff', ...done },
      {
        title: 'Run content QA and governance review',
        status: 'ready_for_review',
        validation_summary: 'Amina challenger pass recorded.',
        metadata: { challenger_status: 'passed' },
      },
    ])

    expect(packet).toMatchObject({
      current_gate: 'draft_build',
      gate_status: 'drafting',
      challenger_status: 'pending',
      pass_to_human: false,
      residual_risks_for_human: ['Production packet work is incomplete.'],
    })
  })

  it('keeps visual QA as a challenger gate before human review', () => {
    const packet = evaluateContentGoalOrchestration([
      ...contentResearchAndDraftDone,
      ...productionPacketDone,
      { title: 'Visual QA and accessibility review', status: 'assigned' },
      {
        title: 'Run content QA and governance review',
        status: 'ready_for_review',
        validation_summary: 'Amina challenger pass recorded.',
        metadata: { challenger_status: 'passed' },
      },
    ])

    expect(packet).toMatchObject({
      current_gate: 'challenger_qa',
      gate_status: 'challenger_pending',
      challenger_status: 'pending',
      pass_to_human: false,
      residual_risks_for_human: ['Visual QA and accessibility review are incomplete.'],
    })
  })

  it('does not pass production-ready content to humans until content QA passes', () => {
    const packet = evaluateContentGoalOrchestration([
      ...contentResearchAndDraftDone,
      ...productionPacketDone,
      { title: 'Visual QA and accessibility review', ...done },
      { title: 'Run content QA and governance review', status: 'assigned' },
    ])

    expect(packet).toMatchObject({
      current_gate: 'challenger_qa',
      gate_status: 'challenger_pending',
      challenger_status: 'pending',
      pass_to_human: false,
      residual_risks_for_human: ['Content QA/governance review has not passed.'],
    })
  })

  it('infers generic task gates from work item metadata and title', () => {
    expect(inferWorkItemOrchestrationGate({
      title: 'Review risk, governance, and rollout path',
      status: 'assigned',
    })).toBe('challenger_qa')
    expect(inferWorkItemOrchestrationGate({
      title: 'Custom task',
      status: 'assigned',
      metadata: { orchestration_gate: 'draft_build' },
    })).toBe('draft_build')
  })

  it('evaluates non-content goals with the shared gate model', () => {
    const packet = evaluateGoalOrchestration({
      goalType: 'general',
      approvalBoundary: 'Human approval remains the final authority boundary.',
      items: [
        { title: 'Frame the goal and acceptance gate', ...done, metadata: { orchestration_gate: 'readiness_packet' } },
        { title: 'Implement the primary change set', status: 'in_progress', metadata: { orchestration_gate: 'draft_build' } },
        { title: 'Review risk, governance, and rollout path', status: 'assigned', metadata: { orchestration_gate: 'challenger_qa' } },
      ],
    })

    expect(packet).toMatchObject({
      goal_type: 'general',
      current_gate: 'draft_build',
      gate_status: 'drafting',
      pass_to_human: false,
    })
  })

  it('routes generic blockers to the active gate', () => {
    const packet = evaluateGoalOrchestration({
      goalType: 'general',
      approvalBoundary: 'Human approval remains the final authority boundary.',
      items: [
        {
          title: 'Review risk, governance, and rollout path',
          status: 'blocked',
          blocker_summary: 'Rollback path is missing.',
          metadata: { orchestration_gate: 'challenger_qa' },
        },
      ],
    })

    expect(packet).toMatchObject({
      current_gate: 'challenger_qa',
      gate_status: 'blocked',
      challenger_status: 'blocked',
      pass_to_human: false,
      residual_risks_for_human: ['Rollback path is missing.'],
    })
  })

  it('passes completed generic goals to human review', () => {
    const packet = evaluateGoalOrchestration({
      goalType: 'general',
      approvalBoundary: 'Human approval remains the final authority boundary.',
      items: [
        { title: 'Frame the goal and acceptance gate', ...done, metadata: { orchestration_gate: 'readiness_packet' } },
        { title: 'Implement the primary change set', ...done, metadata: { orchestration_gate: 'draft_build' } },
        { title: 'Review risk, governance, and rollout path', ...done, metadata: { orchestration_gate: 'challenger_qa', challenger_status: 'passed' } },
      ],
    })

    expect(packet).toMatchObject({
      current_gate: 'human_review',
      gate_status: 'human_review_ready',
      challenger_status: 'passed',
      pass_to_human: true,
    })
  })
})
