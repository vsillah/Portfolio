import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

vi.mock('@/lib/agent-run', () => ({
  recordAgentEvent: vi.fn(),
}))

import {
  scoreAgentRunAgainstRubric,
  summarizeAgentQuality,
  validateAgentEvalRubric,
  type AgentEvalRubricRow,
  type AgentEvalRunRow,
  type AgentRunEvaluationRow,
} from '@/lib/agent-evaluations'

const rubric: AgentEvalRubricRow = {
  id: 'rubric-1',
  key: 'chief-of-staff-synthesis-quality',
  agent_key: 'chief-of-staff',
  workflow_key: 'agent_war_room_standup',
  name: 'Chief of Staff Synthesis Quality',
  description: null,
  dimensions: [
    { key: 'grounding', label: 'Grounded in current traces', weight: 0.25 },
    { key: 'synthesis', label: 'Clear executive synthesis', weight: 0.25 },
    { key: 'next_actions', label: 'Specific next actions', weight: 0.25 },
    { key: 'approval_gates', label: 'Approval gates are explicit', weight: 0.25 },
  ],
  threshold: 82,
  active: true,
  metadata: {},
}

const run: AgentEvalRunRow = {
  id: 'run-1',
  agent_key: 'chief-of-staff',
  runtime: 'manual',
  kind: 'agent_war_room_standup',
  title: 'War Room standup',
  status: 'completed',
  subject_label: null,
  current_step: 'Standup synthesized',
  error_message: null,
  started_at: '2026-05-10T10:00:00.000Z',
  completed_at: '2026-05-10T10:01:00.000Z',
  outcome: { synthesis: 'Clear status and next actions.' },
  metadata: { requires_approval: true },
}

function evaluation(overrides: Partial<AgentRunEvaluationRow>): AgentRunEvaluationRow {
  return {
    id: 'eval-1',
    run_id: 'run-1',
    rubric_id: 'rubric-1',
    rubric_key: 'chief-of-staff-synthesis-quality',
    agent_key: 'chief-of-staff',
    workflow_key: 'agent_war_room_standup',
    score: 90,
    passed: true,
    dimension_scores: { grounding: 90 },
    judge_model: 'deterministic-agent-eval-v1',
    summary: 'Passed',
    failure_reasons: [],
    metadata: {},
    created_at: '2026-05-10T10:00:00.000Z',
    ...overrides,
  }
}

describe('agent evaluation helpers', () => {
  it('validates rubric dimensions and threshold range', () => {
    expect(validateAgentEvalRubric(rubric)).toHaveLength(4)
    expect(() => validateAgentEvalRubric({ ...rubric, dimensions: [] })).toThrow('Rubric requires at least one dimension')
    expect(() => validateAgentEvalRubric({ ...rubric, threshold: 101 })).toThrow('Rubric threshold must be between 0 and 100')
  })

  it('scores completed runs and keeps mutations approval-gated', () => {
    const scored = scoreAgentRunAgainstRubric(run, rubric)

    expect(scored.score).toBeGreaterThanOrEqual(82)
    expect(scored.passed).toBe(true)
    expect(scored.dimension_scores).toMatchObject({
      grounding: expect.any(Number),
      synthesis: expect.any(Number),
      next_actions: expect.any(Number),
      approval_gates: expect.any(Number),
    })
    expect(scored.metadata).toMatchObject({
      mutation_policy: 'approval_gated',
      autonomous_mutation: false,
    })
  })

  it('turns failed evaluations into coaching signals without prompt mutation', () => {
    const scored = scoreAgentRunAgainstRubric({
      ...run,
      status: 'failed',
      error_message: 'LLM request failed',
      outcome: null,
    }, rubric)

    expect(scored.passed).toBe(false)
    expect(scored.failure_reasons).toEqual(expect.arrayContaining([
      'Run failed before producing a reviewable output.',
      'Run error: LLM request failed',
    ]))
    expect(scored.metadata.autonomous_mutation).toBe(false)
  })

  it('groups quality summary by agent, workflow, and rubric trend', () => {
    const summary = summarizeAgentQuality({
      rubrics: [rubric],
      evaluations: [
        evaluation({ id: 'eval-2', run_id: 'run-2', score: 72, passed: false, created_at: '2026-05-10T11:00:00.000Z' }),
        evaluation({ id: 'eval-1', run_id: 'run-1', score: 90, passed: true, created_at: '2026-05-10T10:00:00.000Z' }),
      ],
    })

    expect(summary.evaluation_count).toBe(2)
    expect(summary.average_score).toBe(81)
    expect(summary.by_agent[0]).toMatchObject({
      agent_key: 'chief-of-staff',
      evaluation_count: 2,
      pass_rate: 0.5,
    })
    expect(summary.rubric_trends[0]).toMatchObject({
      rubric_key: 'chief-of-staff-synthesis-quality',
      workflow_key: 'agent_war_room_standup',
      latest_score: 72,
      direction: 'down',
    })
    expect(summary.needs_coaching[0]).toMatchObject({
      agent_key: 'chief-of-staff',
      rubric_key: 'chief-of-staff-synthesis-quality',
      run_id: 'run-2',
    })
  })
})
