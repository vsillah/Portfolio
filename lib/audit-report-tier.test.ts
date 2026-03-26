import { describe, expect, it } from 'vitest'

import { AUDIT_CATEGORY_ORDER } from './audit-questions'
import { computeReportTier } from './audit-report-tier'
import type { DiagnosticAuditRecord } from './diagnostic'

function buildAudit(
  options: {
    overrides?: Partial<DiagnosticAuditRecord>
    completedCategories?: number
  } = {}
): DiagnosticAuditRecord {
  const { overrides = {}, completedCategories = AUDIT_CATEGORY_ORDER.length } = options
  const categoryPayloads = Object.fromEntries(
    AUDIT_CATEGORY_ORDER.map((category, index) => [
      category,
      index < completedCategories ? { answered: true } : {},
    ])
  ) as Record<(typeof AUDIT_CATEGORY_ORDER)[number], Record<string, unknown>>

  const base: DiagnosticAuditRecord = {
    id: 'audit-1',
    session_id: 'session-1',
    status: 'in_progress',
    business_challenges: categoryPayloads.business_challenges,
    tech_stack: categoryPayloads.tech_stack,
    automation_needs: categoryPayloads.automation_needs,
    ai_readiness: categoryPayloads.ai_readiness,
    budget_timeline: categoryPayloads.budget_timeline,
    decision_making: categoryPayloads.decision_making,
    started_at: '2026-03-25T00:00:00.000Z',
    updated_at: '2026-03-25T00:00:00.000Z',
    contact_email: 'owner@example.com',
    website_url: 'https://example.com',
    industry_slug: 'technology',
  }

  return {
    ...base,
    ...overrides,
  }
}

function getSectionIds(
  sections: Array<{ id: string }>
): string[] {
  return sections.map((section) => section.id)
}

describe('computeReportTier', () => {
  it('returns bronze with locked premium sections when categories and email are missing', () => {
    const audit = buildAudit({
      completedCategories: 0,
      overrides: {
        contact_email: '',
        website_url: '',
        industry_slug: '',
      },
    })

    const result = computeReportTier(audit)

    expect(result.tier).toBe('bronze')
    expect(result.completedCategories).toBe(0)
    expect(getSectionIds(result.availableSections)).toEqual([])

    const valueEstimate = result.lockedSections.find((section) => section.id === 'value_estimate')
    expect(valueEstimate).toBeTruthy()
    expect(valueEstimate?.unlockPrompt).toContain(`Complete all ${AUDIT_CATEGORY_ORDER.length} audit categories`)
    expect(valueEstimate?.unlockPrompt).toContain('Provide your email')
    expect(valueEstimate?.requiredFields).toEqual(['all_categories', 'contact_email'])
  })

  it('returns silver with industry and URL dependent sections still locked', () => {
    const audit = buildAudit({
      overrides: {
        website_url: '',
        industry_slug: '',
      },
    })

    const result = computeReportTier(audit)

    expect(result.tier).toBe('silver')
    expect(getSectionIds(result.availableSections)).toEqual([
      'scores',
      'score_drivers',
      'value_estimate',
      'recommendations',
    ])

    const lockedIds = getSectionIds(result.lockedSections)
    expect(lockedIds).toContain('industry_benchmarks')
    expect(lockedIds).toContain('tech_stack_comparison')
    expect(lockedIds).toContain('website_analysis')
    expect(lockedIds).toContain('strategy_deck')
  })

  it('returns gold and gates website analysis on screenshot or annotations', () => {
    const goldWithoutVisuals = computeReportTier(buildAudit())
    expect(goldWithoutVisuals.tier).toBe('gold')
    expect(getSectionIds(goldWithoutVisuals.availableSections)).toContain('tech_stack_comparison')
    expect(getSectionIds(goldWithoutVisuals.lockedSections)).toContain('website_analysis')

    const goldWithAnnotations = computeReportTier(
      buildAudit({
        overrides: {
          website_annotations: [{ note: 'hero heading is unclear' }],
        },
      })
    )
    expect(goldWithAnnotations.tier).toBe('gold')
    expect(getSectionIds(goldWithAnnotations.availableSections)).toContain('website_analysis')
    expect(getSectionIds(goldWithAnnotations.lockedSections)).not.toContain('website_analysis')
  })

  it('returns platinum when deck availability is provided via compute options', () => {
    const result = computeReportTier(buildAudit(), { hasDeck: true })
    expect(result.tier).toBe('platinum')
    expect(getSectionIds(result.availableSections)).toContain('strategy_deck')
    expect(getSectionIds(result.lockedSections)).not.toContain('strategy_deck')
  })

  it('returns platinum when persisted report tier is already platinum', () => {
    const result = computeReportTier(
      buildAudit({
        overrides: {
          report_tier: 'platinum',
        },
      })
    )
    expect(result.tier).toBe('platinum')
    expect(getSectionIds(result.availableSections)).toContain('strategy_deck')
  })
})
