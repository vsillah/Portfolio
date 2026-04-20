import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabaseAdmin: null,
  default: null,
}))

import { buildGammaReportInputFromContext } from './gamma-report-builder'

/**
 * Guardrail tests for the Gamma prompt body. Source Fidelity Rules, the Evidence
 * Index, and the "How to use this source material" meta-instruction block used to
 * sit at the top of the prompt body. They competed with real slides (cover, Next
 * Steps, bio) for Gamma's `numCards` budget and were frequently hoisted into the
 * first few rendered slides. We now inject that guidance exclusively via
 * additionalInstructions, so the body must start with real content.
 */

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    contact: { company: 'Acme Widgets', name: 'Jane Doe', email: 'jane@acme.test' },
    audit: {
      id: 'audit-1',
      contact_submission_id: 'sub-1',
      business_name: 'Acme Widgets',
      website_url: 'https://acme.test',
      contact_email: 'jane@acme.test',
      industry_slug: 'professional_services',
      business_challenges: { summary: 'n/a' },
      tech_stack: {},
      automation_needs: {},
      ai_readiness: {},
      budget_timeline: {},
      decision_making: {},
      diagnostic_summary: 'Summary of challenges.',
      key_insights: ['Insight A', 'Insight B'],
      recommended_actions: ['Action A'],
      urgency_score: 7,
      opportunity_score: 6,
      responses_received: { q1: 'a1' },
      questions_by_category: null,
      enriched_tech_stack: {},
      value_estimate: {},
      sales_notes: null,
    },
    valueReport: null,
    services: [],
    painPoints: [],
    benchmarks: [],
    meetings: [],
    painPointEvidence: [],
    ...overrides,
  }
}

describe('Gamma prompt body — meta blocks removed', () => {
  it('audit_summary body does not include Source Fidelity preamble or "How to use this source material"', async () => {
    const ctx = makeCtx()
    const { inputText, options } = await buildGammaReportInputFromContext(
      ctx as unknown as Parameters<typeof buildGammaReportInputFromContext>[0],
      { reportType: 'audit_summary' } as Parameters<typeof buildGammaReportInputFromContext>[1]
    )

    expect(inputText).not.toContain('[SOURCE FIDELITY RULES')
    expect(inputText).not.toContain('[EVIDENCE INDEX]')
    expect(inputText).not.toContain('# How to use this source material')

    expect(inputText).toContain('Acme Widgets — Diagnostic Audit Summary')
    expect(inputText).toContain(`# Let's Talk`)
    expect(inputText).toContain('# Meet Your Advisor')

    const additional = options.additionalInstructions ?? ''
    expect(additional).toContain('[SOURCE FIDELITY RULES')
    expect(additional).toContain('[CLIENT ORGANIZATION]')
    expect(additional).toContain('"Acme Widgets"')
  })

  it('cover slide is at or near the start of the audit_summary body (not buried behind 7k chars)', async () => {
    const ctx = makeCtx()
    const { inputText } = await buildGammaReportInputFromContext(
      ctx as unknown as Parameters<typeof buildGammaReportInputFromContext>[0],
      { reportType: 'audit_summary' } as Parameters<typeof buildGammaReportInputFromContext>[1]
    )
    const coverPos = inputText.indexOf('# Acme Widgets — Diagnostic Audit Summary')
    expect(coverPos).toBeGreaterThanOrEqual(0)
    expect(coverPos).toBeLessThan(200)
  })
})
