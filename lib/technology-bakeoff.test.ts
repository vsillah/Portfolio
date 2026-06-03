import { describe, expect, it } from 'vitest'
import {
  TECHNOLOGY_BAKEOFF_PROFILES,
  TECHNOLOGY_BAKEOFF_SURFACES,
  buildTechnologyBakeoffPlan,
} from './technology-bakeoff'

describe('buildTechnologyBakeoffPlan', () => {
  it('returns a valid plan for every mapped surface', () => {
    for (const surface of TECHNOLOGY_BAKEOFF_SURFACES) {
      const plan = buildTechnologyBakeoffPlan({
        surface,
        objective: `Evaluate ${TECHNOLOGY_BAKEOFF_PROFILES[surface].label}`,
        priority: 'reliability',
      })

      expect(plan.surface).toBe(surface)
      expect(plan.surfaceLabel).toBe(TECHNOLOGY_BAKEOFF_PROFILES[surface].label)
      expect(plan.candidates.length).toBeGreaterThan(0)
      expect(plan.scores.length).toBeGreaterThan(0)
      expect(plan.benchmarkRunbook.join(' ')).toContain('Decision question')
      expect(plan.promotionGate.length).toBeGreaterThan(0)
      expect(plan.rollbackPlan.length).toBeGreaterThan(0)
      expect(plan.decisionTrustFrame.objective).toBe(`Evaluate ${TECHNOLOGY_BAKEOFF_PROFILES[surface].label}`)
      expect(plan.decisionTrustFrame.candidates_considered.length).toBeGreaterThan(0)
      expect(plan.decisionTrustEnforcement.mode).toBe('advisory')
      expect(plan.decisionTrustEnforcement.gate).toBe(plan.decisionTrustFrame.recommended_gate)
      expect(plan.decisionTrustEnforcement.mayProceed).toBe(true)
      expect(plan.nextImplementationStep).toContain(plan.surfaceLabel)
    }
  })

  it('rejects unsupported surfaces clearly', () => {
    expect(() =>
      buildTechnologyBakeoffPlan({
        surface: 'unsupported_surface' as never,
        objective: 'Try an unknown surface',
        priority: 'quality',
      })
    ).toThrow(/Unsupported technology bakeoff surface/)
  })

  it('delegates media generation to the specialist evaluator shape', () => {
    const plan = buildTechnologyBakeoffPlan({
      surface: 'media_generation',
      objective: 'Pick the best media model before changing Portfolio defaults.',
      priority: 'speed',
    })

    expect(plan.specialistSource).toBe('media_generation')
    expect(plan.candidates.map((candidate) => candidate.id)).toEqual(
      expect.arrayContaining(['fal', 'replicate', 'openrouter', 'direct_provider'])
    )
    expect(plan.integrationNotes.join(' ')).toMatch(/provider adapter/i)
  })

  it('delegates presentations to the specialist evaluator shape', () => {
    const plan = buildTechnologyBakeoffPlan({
      surface: 'presentations',
      objective: 'Choose a better deck production path.',
      priority: 'quality',
    })

    expect(plan.specialistSource).toBe('presentation')
    expect(plan.candidates.map((candidate) => candidate.id)).toEqual(
      expect.arrayContaining(['codex_pptx', 'claude_design', 'gamma'])
    )
    expect(plan.promotionGate.join(' ')).toMatch(/unsupported market claims|generic AI voice/i)
  })

  it('reuses Agent Operations framing for agent runtime bakeoffs', () => {
    const plan = buildTechnologyBakeoffPlan({
      surface: 'agent_runtimes',
      objective: 'Compare coding agent runtimes before assigning production work.',
      priority: 'governance',
      knownFailure: 'Runtime cannot be audited.',
    })

    expect(plan.specialistSource).toBe('agent_runtime')
    expect(plan.recommendedAction).toMatch(/Agent Operations/i)
    expect(plan.promotionGate.join(' ')).toMatch(/read-only or sandboxed/i)
  })

  it('adds candidate overrides ahead of generic profile candidates', () => {
    const plan = buildTechnologyBakeoffPlan({
      surface: 'analytics',
      objective: 'Compare analytics tools.',
      priority: 'conversion',
      candidateOverrides: ['New Analytics Tool'],
    })

    expect(plan.candidates[0].label).toBe('New Analytics Tool')
    expect(plan.candidates[0].role).toBe('User-supplied candidate')
    expect(plan.decisionTrustFrame.selected_candidate).toBe('new_analytics_tool')
  })

  it('uses Apify call evidence for lead enrichment bakeoffs', () => {
    const plan = buildTechnologyBakeoffPlan({
      surface: 'lead_enrichment',
      objective: 'Decide whether Apify actors should be replaced before renewal.',
      priority: 'cost',
      currentDefault: 'Apify actors',
    })

    expect(plan.candidates.map((candidate) => candidate.id)).toEqual(expect.arrayContaining(['apify_actors', 'browser_agents']))
    expect(plan.benchmarkRunbook.join(' ')).toContain('docs/apify-call-bakeoff-analysis.md')
    expect(plan.missingEvidence.join(' ')).toContain('Direct Apify run history')
    expect(plan.decisionTrustFrame.decision_type).toBe('vendor')
    expect(plan.decisionTrustFrame.missing_evidence).toContain('Direct Apify run history')
    expect(plan.decisionTrustFrame.recommended_gate).toMatch(/sandbox|human_review/)
    expect(plan.decisionTrustEnforcement.reason).toMatch(/advisory mode/i)
  })
})
