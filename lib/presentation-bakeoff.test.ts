import { describe, expect, it } from 'vitest'
import { buildPresentationBakeoffPlan } from './presentation-bakeoff'

describe('buildPresentationBakeoffPlan', () => {
  it('recommends Codex/PPTX when editability, demos, and source validation matter', () => {
    const plan = buildPresentationBakeoffPlan({
      title: 'Accelerated',
      thesis: 'AI made artifacts cheaper. Product discipline turns speed into learning.',
      audience: 'colleagues',
      format: 'one_hour_course',
      durationMinutes: 60,
      proofAssets: ['Audit tool', 'Value Evidence Pipeline'],
      demoRoutes: ['/tools/audit', '/admin/value-evidence'],
      sourceAnchors: ['Stanford AI Index', 'McKinsey State of AI'],
      brandSystem: 'amadutown',
      needsEditablePptx: true,
      needsLiveDemos: true,
      needsSourceValidation: true,
      needsFacilitatorNotes: true,
    })

    expect(plan.recommendedTool).toBe('codex_pptx')
    expect(plan.candidates[0].label).toBe('Codex / PPTX build')
    expect(plan.qaChecklist).toContain('No unsupported market claims.')
    expect(plan.demoPlan[0]).toContain('/tools/audit')
  })

  it('keeps Gamma as a candidate instead of the only workflow', () => {
    const plan = buildPresentationBakeoffPlan({
      title: 'Client Offer Presentation',
      thesis: 'The product stays the same. The wrapping changes by operating capacity.',
      audience: 'clients',
      format: 'sales_presentation',
      durationMinutes: 20,
      brandSystem: 'amadutown',
    })

    expect(plan.candidates.map((candidate) => candidate.tool)).toEqual(
      expect.arrayContaining(['codex_pptx', 'claude_design', 'gamma'])
    )
    expect(plan.candidates.find((candidate) => candidate.tool === 'gamma')?.generationPrompt).toMatch(
      /fast alternate direction/i
    )
  })
})
