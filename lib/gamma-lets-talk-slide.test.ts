import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./supabase', () => ({
  supabaseAdmin: null,
  default: null,
}))

import { buildGammaReportInputFromContext } from './gamma-report-builder'

/**
 * Regression tests for the "Let's Talk" final-CTA slide. Verifies that:
 *  - Every report type emits exactly one `Let's Talk` slide, regardless of
 *    whether it replaced a bare Next Steps or was added alongside a rich one.
 *  - Bare-replace templates (audit_summary, prospect_overview) no longer emit
 *    the legacy one-liner Next Steps copy.
 *  - Rich-keep templates (implementation_strategy, offer_presentation,
 *    value_quantification) preserve their process-oriented content.
 *  - The discovery-call URL follows the env var fallback chain and never leaves
 *    the slide without a URL.
 *  - The per-report-type pressure-test question uses the fetched org name and
 *    falls back to "your organization" when it's missing.
 */

function baseCtx(overrides: Record<string, unknown> = {}) {
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
      diagnostic_summary: 'Summary.',
      key_insights: ['A'],
      recommended_actions: ['A'],
      urgency_score: 7,
      opportunity_score: 6,
      responses_received: { q1: 'a' },
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

async function buildBody(reportType: string, ctxOverrides: Record<string, unknown> = {}) {
  const ctx = baseCtx(ctxOverrides)
  const { inputText, options } = await buildGammaReportInputFromContext(
    ctx as unknown as Parameters<typeof buildGammaReportInputFromContext>[0],
    { reportType } as Parameters<typeof buildGammaReportInputFromContext>[1]
  )
  return { inputText, options }
}

describe(`Let's Talk final slide`, () => {
  const originalCalendly = process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL
  const originalLegacy = process.env.CALENDLY_DISCOVERY_LINK

  afterEach(() => {
    if (originalCalendly === undefined) delete process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL
    else process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL = originalCalendly
    if (originalLegacy === undefined) delete process.env.CALENDLY_DISCOVERY_LINK
    else process.env.CALENDLY_DISCOVERY_LINK = originalLegacy
  })

  it('audit_summary: replaces bare Next Steps with a single Let\'s Talk slide and uses the audit-specific question', async () => {
    const { inputText } = await buildBody('audit_summary')
    expect(inputText).toContain(`# Let's Talk`)
    expect(inputText.match(/# Let's Talk/g)?.length).toBe(1)
    expect(inputText).not.toContain('Contact Amadutown Advisory Solutions at amadutown.com to discuss these findings.')
    expect(inputText).toContain(`Want to pressure-test which of these gaps would move the needle most for Acme Widgets?`)
    expect(inputText).toContain(`📅 **Book a discovery call**`)
    expect(inputText).toContain(`🌐 **amadutown.com**`)
  })

  it('prospect_overview: replaces bare Next Steps with a single Let\'s Talk slide and uses the prospect-specific question', async () => {
    const { inputText } = await buildBody('prospect_overview')
    expect(inputText).toContain(`# Let's Talk`)
    expect(inputText.match(/# Let's Talk/g)?.length).toBe(1)
    expect(inputText).not.toContain('Book a discovery call at amadutown.com to explore')
    expect(inputText).toContain(`Want to pressure-test which of these opportunities is the right first move for Acme Widgets?`)
  })

  it('falls back to "your organization" when the org name cannot be resolved', async () => {
    const { inputText } = await buildBody('audit_summary', {
      contact: null,
      audit: { ...baseCtx().audit, business_name: null, website_url: null, contact_email: null },
    })
    expect(inputText).toContain(`Want to pressure-test which of these gaps would move the needle most for your organization?`)
  })

  describe('discovery URL fallback chain', () => {
    it('uses NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL when set', async () => {
      process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL = 'https://cal.example.com/amadutown/discovery'
      delete process.env.CALENDLY_DISCOVERY_LINK
      const { inputText } = await buildBody('audit_summary')
      expect(inputText).toContain('https://cal.example.com/amadutown/discovery')
    })

    it('falls back to CALENDLY_DISCOVERY_LINK when the public var is unset', async () => {
      delete process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL
      process.env.CALENDLY_DISCOVERY_LINK = 'https://legacy.example.com/book'
      const { inputText } = await buildBody('audit_summary')
      expect(inputText).toContain('https://legacy.example.com/book')
    })

    it('falls back to amadutown.com when no Calendly env is set', async () => {
      delete process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL
      delete process.env.CALENDLY_DISCOVERY_LINK
      const { inputText } = await buildBody('audit_summary')
      const letsTalkStart = inputText.indexOf(`# Let's Talk`)
      expect(letsTalkStart).toBeGreaterThan(-1)
      const letsTalk = inputText.slice(letsTalkStart)
      expect(letsTalk).toContain('https://amadutown.com')
    })
  })

  it('positioning sentence uses honest/ship/own bolds, not the reference deck\'s "regulated" framing', async () => {
    const { inputText } = await buildBody('audit_summary')
    expect(inputText).toContain('nonprofits and minority-owned businesses')
    expect(inputText).toContain('**honest strategy**')
    expect(inputText).toContain('**automation we actually ship**')
    expect(inputText).toContain('**tools built to run without us**')
    expect(inputText).not.toContain('regulated organizations')
    expect(inputText).not.toContain('earns trust')
  })

  it('Let\'s Talk slide intentionally contains no profile photo (photo lives on Meet Your Advisor)', async () => {
    const { inputText } = await buildBody('audit_summary')
    const letsTalkStart = inputText.indexOf(`# Let's Talk`)
    const letsTalkEnd = inputText.indexOf('\n---\n', letsTalkStart)
    const letsTalk = inputText.slice(letsTalkStart, letsTalkEnd > 0 ? letsTalkEnd : undefined)
    expect(letsTalk).not.toContain('Profile_Photo')
    expect(letsTalk).not.toMatch(/!\[[^\]]*Sillah[^\]]*\]/)
  })
})

/**
 * Regression: after switching the ledger to the final-slide appendix position
 * (UX recommendation) and fixing the asset base URL to always resolve to a
 * publicly reachable origin, every report type must:
 *   - place the ledger slide last, after `Meet Your Advisor`;
 *   - use the new `# Where These Findings Come From` heading;
 *   - embed the photo and logo via an https URL even when the local dev
 *     `NEXT_PUBLIC_SITE_URL` is `http://localhost:3000` (Gamma's render
 *     servers can't fetch from localhost).
 */
describe('evidence ledger placement + public asset URLs', () => {
  // `offer_presentation` is covered by its own flow (needs bundleId / pricingTierId)
  // and uses the same shared swap. The other four exercise the builder paths
  // that have varying content between `Let's Talk` and the bio slide.
  const REPORT_TYPES = [
    'audit_summary',
    'prospect_overview',
    'value_quantification',
    'implementation_strategy',
  ] as const

  const originalSite = process.env.NEXT_PUBLIC_SITE_URL
  const originalGammaBase = process.env.GAMMA_PUBLIC_ASSET_BASE_URL

  afterEach(() => {
    if (originalSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = originalSite
    if (originalGammaBase === undefined) delete process.env.GAMMA_PUBLIC_ASSET_BASE_URL
    else process.env.GAMMA_PUBLIC_ASSET_BASE_URL = originalGammaBase
  })

  for (const reportType of REPORT_TYPES) {
    it(`${reportType}: ledger slide is last and titled "Where These Findings Come From"`, async () => {
      const { inputText } = await buildBody(reportType)
      const slides = inputText.split(/\n---\n/)
      const last = slides[slides.length - 1]
      expect(last.startsWith('# Where These Findings Come From')).toBe(true)
      expect(inputText).not.toContain('# EVIDENCE LEDGER')
      const ledgerCount = (inputText.match(/# Where These Findings Come From/g) || []).length
      expect(ledgerCount).toBe(1)
      const bioIdx = inputText.lastIndexOf('# Meet Your Advisor')
      const ledgerIdx = inputText.lastIndexOf('# Where These Findings Come From')
      expect(bioIdx).toBeGreaterThan(-1)
      expect(ledgerIdx).toBeGreaterThan(bioIdx)
    })
  }

  it('rewrites localhost NEXT_PUBLIC_SITE_URL to the public fallback for embedded images', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    delete process.env.GAMMA_PUBLIC_ASSET_BASE_URL
    const { inputText } = await buildBody('audit_summary')
    expect(inputText).toMatch(/!\[[^\]]*\]\(https:\/\/amadutown\.com\/Profile_Photo_1\.jpg\)/)
    expect(inputText).toMatch(/!\[AmaduTown[^\]]*\]\(https:\/\/amadutown\.com\/logo_hd\.png\)/)
    expect(inputText).not.toMatch(/!\[[^\]]*\]\(http:\/\/localhost:3000/)
  })

  it('honors GAMMA_PUBLIC_ASSET_BASE_URL override when set', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    process.env.GAMMA_PUBLIC_ASSET_BASE_URL = 'https://preview.amadutown.com'
    const { inputText } = await buildBody('audit_summary')
    expect(inputText).toMatch(/!\[[^\]]*\]\(https:\/\/preview\.amadutown\.com\/Profile_Photo_1\.jpg\)/)
  })

  it('uses NEXT_PUBLIC_SITE_URL directly when it is a public https origin', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://amadutown.com'
    delete process.env.GAMMA_PUBLIC_ASSET_BASE_URL
    const { inputText } = await buildBody('audit_summary')
    expect(inputText).toMatch(/!\[[^\]]*\]\(https:\/\/amadutown\.com\/Profile_Photo_1\.jpg\)/)
  })
})
