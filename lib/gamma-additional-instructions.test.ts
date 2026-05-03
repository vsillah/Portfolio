import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabaseAdmin: null,
  default: null,
}))

import { composeAdditionalInstructions } from './gamma-report-builder'
import { GAMMA_MAX_ADDITIONAL_INSTRUCTIONS } from './gamma-client'
import type { AiLayerFitEvaluation } from './ai-layer-fit-evaluation'

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    contact: null,
    audit: null,
    valueReport: null,
    services: [],
    painPoints: [],
    benchmarks: [],
    meetings: [],
    painPointEvidence: [],
    ...overrides,
  } as Parameters<typeof composeAdditionalInstructions>[0]
}

function makeAiLayerFitEvaluation(): AiLayerFitEvaluation {
  return {
    generated_at: '2026-05-01T00:00:00.000Z',
    inputs_hash: 'ai-layer-fit-test',
    client_stack_source: 'client_verified',
    detected_stack: ['Google Workspace', 'Slack'],
    workflow_signals: ['approval routing'],
    recommended_layer: 'workflow_agent',
    recommended_layer_label: 'Workflow agent',
    candidate_layers: [
      {
        layer: 'workflow_agent',
        label: 'Workflow agent',
        fitHypothesis: 'Recurring cross-tool work needs shared ownership and review.',
      },
    ],
    scores: [
      {
        dimension: 'stackability_and_routing',
        label: 'Stackability and routing',
        score: 5,
        weight: 0.2,
        weightedScore: 1,
        evidence: 'Slack and approval routing create a strong orchestration fit.',
      },
    ],
    weighted_total: 4.2,
    decision: 'prioritize_for_implementation_planning',
    decision_label: 'Prioritize for implementation planning',
    routing_summary: 'Route approval-heavy workflows to a workflow agent layer.',
    pilot_recommendation: 'Start with a reviewed intake-to-handoff pilot.',
    open_questions: ['Which approval steps require human sign-off?'],
  }
}

describe('composeAdditionalInstructions', () => {
  it('returns the full composition when it fits under the Gamma 5000-char cap', () => {
    const result = composeAdditionalInstructions(makeContext(), undefined, undefined, null)
    expect(result).toBeTruthy()
    expect((result as string).length).toBeLessThanOrEqual(GAMMA_MAX_ADDITIONAL_INSTRUCTIONS)
    expect(result).toContain('[SOURCE FIDELITY RULES — read first]')
  })

  it('includes the [CLIENT ORGANIZATION] guardrail with the resolved org name', () => {
    const ctx = makeContext({
      contact: { company: 'Acme Widgets' },
    })
    const result = composeAdditionalInstructions(ctx, undefined, undefined, null)
    expect(result).toBeTruthy()
    const out = result as string
    expect(out).toContain('[CLIENT ORGANIZATION]')
    expect(out).toContain('"Acme Widgets"')
    expect(out).toContain('Do not substitute generic phrases')
  })

  it('preserves the [CLIENT ORGANIZATION] guardrail even when the Evidence Index is truncated', () => {
    const pickedVerbatims = Array.from({ length: 40 }, (_, i) => ({
      id: `m-${i}`,
      sourceLabel: 'Discovery call',
      dateLabel: '2026-01-01',
      verbatim:
        `Meeting ${i} verbatim: ` + 'pain point detail. '.repeat(20),
    }))
    const ctx = makeContext({ contact: { company: 'Berin Psychology' } })
    const result = composeAdditionalInstructions(
      ctx,
      { meetingVerbatims: pickedVerbatims } as Parameters<typeof composeAdditionalInstructions>[1],
      undefined,
      null
    )
    const out = result as string
    expect(out.length).toBeLessThanOrEqual(GAMMA_MAX_ADDITIONAL_INSTRUCTIONS)
    expect(out).toContain('[CLIENT ORGANIZATION]')
    expect(out).toContain('"Berin Psychology"')
    expect(out).toContain('evidence list truncated')
  })

  it('truncates the Evidence Index but preserves rules + custom instructions when over the cap', () => {
    const pickedVerbatims = Array.from({ length: 40 }, (_, i) => ({
      id: `m-${i}`,
      sourceLabel: 'Discovery call',
      dateLabel: '2026-01-01',
      verbatim:
        `Meeting ${i} verbatim: ` + 'pain point detail, staff context, and specific numbers. '.repeat(20),
    }))

    const custom = 'CUSTOM_CALLER_INSTRUCTION_MARKER'
    const result = composeAdditionalInstructions(
      makeContext(),
      { meetingVerbatims: pickedVerbatims, customInstructions: custom } as Parameters<typeof composeAdditionalInstructions>[1],
      undefined,
      null
    )

    expect(result).toBeTruthy()
    const out = result as string
    expect(out.length).toBeLessThanOrEqual(GAMMA_MAX_ADDITIONAL_INSTRUCTIONS)
    expect(out).toContain('[SOURCE FIDELITY RULES — read first]')
    expect(out).toContain(custom)
    expect(out).toContain('evidence list truncated')
  })

  it('includes AI layer-fit anti-fabrication rules when an evaluation is present', () => {
    const result = composeAdditionalInstructions(
      makeContext(),
      undefined,
      undefined,
      null,
      makeAiLayerFitEvaluation()
    )

    expect(result).toBeTruthy()
    const out = result as string
    expect(out).toContain('AI LAYER-FIT RULES:')
    expect(out).toContain('Do NOT invent additional tools, scores, dimensions, or candidate layers')
    expect(out).toContain('Preserve the weighted total, decision label, recommended layer')
  })

  it('preserves AI layer-fit anti-fabrication rules when the Evidence Index is truncated', () => {
    const pickedVerbatims = Array.from({ length: 40 }, (_, i) => ({
      id: `m-${i}`,
      sourceLabel: 'Discovery call',
      dateLabel: '2026-01-01',
      verbatim:
        `Meeting ${i} verbatim: ` + 'approval routing risk and workflow context. '.repeat(20),
    }))

    const result = composeAdditionalInstructions(
      makeContext(),
      { meetingVerbatims: pickedVerbatims } as Parameters<typeof composeAdditionalInstructions>[1],
      undefined,
      null,
      makeAiLayerFitEvaluation()
    )

    expect(result).toBeTruthy()
    const out = result as string
    expect(out.length).toBeLessThanOrEqual(GAMMA_MAX_ADDITIONAL_INSTRUCTIONS)
    expect(out).toContain('AI LAYER-FIT RULES:')
    expect(out).toContain('Do NOT invent additional tools, scores, dimensions, or candidate layers')
    expect(out).toContain('evidence list truncated')
  })
})
