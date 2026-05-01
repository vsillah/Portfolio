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

async function buildBody(
  reportType: string,
  ctxOverrides: Record<string, unknown> = {},
  paramOverrides: Record<string, unknown> = {}
) {
  const ctx = baseCtx(ctxOverrides)
  const { inputText, options } = await buildGammaReportInputFromContext(
    ctx as unknown as Parameters<typeof buildGammaReportInputFromContext>[0],
    { reportType, ...paramOverrides } as Parameters<typeof buildGammaReportInputFromContext>[1]
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
    // audit_summary defaults to the Discovery Call (pre-commit).
    expect(inputText).toContain(`📅 **Book a Discovery Call**`)
    expect(inputText).toContain(`🌐 **amadutown.com**`)
  })

  it('prospect_overview: replaces bare Next Steps with a single Let\'s Talk slide and uses the prospect-specific question', async () => {
    const { inputText } = await buildBody('prospect_overview')
    expect(inputText).toContain(`# Let's Talk`)
    expect(inputText.match(/# Let's Talk/g)?.length).toBe(1)
    expect(inputText).not.toContain('Book a discovery call at amadutown.com to explore')
    expect(inputText).toContain(`Want to pressure-test which of these opportunities is the right first move for Acme Widgets?`)
    expect(inputText).toContain(`📅 **Book a Discovery Call**`)
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
 * Regression: per-report-type Calendly routing (pre-commit → Discovery Call,
 * post-commit → Onboarding Call) with admin override support. See
 * `lib/calendly-events.ts` and `.cursor/plans/calendly-per-report-type_d49ba7dc.plan.md`.
 */
describe(`Let's Talk — per-report-type Calendly routing`, () => {
  const envSnap: Record<string, string | undefined> = {
    NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL: process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL,
    CALENDLY_DISCOVERY_LINK: process.env.CALENDLY_DISCOVERY_LINK,
    CALENDLY_ONBOARDING_CALL_URL: process.env.CALENDLY_ONBOARDING_CALL_URL,
    CALENDLY_KICKOFF_MEETING_URL: process.env.CALENDLY_KICKOFF_MEETING_URL,
    CALENDLY_RENEWAL_REVIEW_URL: process.env.CALENDLY_RENEWAL_REVIEW_URL,
  }

  // Silence the "env var not set, falling back" warnings that
  // `getCalendlyUrlForEvent` emits during these tests — they're expected.
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    for (const [k, v] of Object.entries(envSnap)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('value_quantification defaults to the Onboarding Call', async () => {
    process.env.CALENDLY_ONBOARDING_CALL_URL = 'https://cal.example.com/onboarding'
    const { inputText } = await buildBody('value_quantification')
    expect(inputText).toContain('📅 **Book a Onboarding Call**')
    expect(inputText).toContain('45 minutes.')
    expect(inputText).toContain('https://cal.example.com/onboarding')
    expect(inputText).not.toContain('📅 **Book a Discovery Call**')
  })

  it('implementation_strategy defaults to the Onboarding Call', async () => {
    process.env.CALENDLY_ONBOARDING_CALL_URL = 'https://cal.example.com/onboarding'
    const { inputText } = await buildBody('implementation_strategy')
    expect(inputText).toContain('📅 **Book a Onboarding Call**')
    expect(inputText).toContain('https://cal.example.com/onboarding')
  })

  it('implementation_strategy includes AI layer-fit strategy and structured guardrails', async () => {
    const { inputText, options } = await buildBody('implementation_strategy', {
      contact: {
        company: 'Acme Widgets',
        name: 'Jane Doe',
        email: 'jane@acme.test',
        client_verified_tech_stack: {
          technologies: [
            { name: 'Microsoft 365', tag: 'Email' },
            { name: 'SharePoint', tag: 'Content Management' },
            { name: 'Microsoft Teams', tag: 'Workflow Automation' },
          ],
        },
      },
      audit: {
        ...baseCtx().audit,
        automation_needs: {
          priority_areas: ['reporting', 'data_sync'],
          desired_outcomes: ['one_click_reports', 'fewer_manual_steps'],
        },
      },
    })

    expect(inputText).toContain('# AI Layer-Fit Strategy')
    expect(inputText).toContain('**Recommended layer:** Embedded platform AI')
    expect(inputText).toContain('# AI Tool Routing')
    expect(inputText).toContain('[STRUCTURED AI LAYER-FIT EVALUATION')
    expect(options.additionalInstructions).toContain('AI LAYER-FIT RULES:')
    expect(options.numCards).toBe(23)
  })

  it('audit_summary does not include AI layer-fit strategy slides', async () => {
    const { inputText, options } = await buildBody('audit_summary')
    expect(inputText).not.toContain('# AI Layer-Fit Strategy')
    expect(options.additionalInstructions).not.toContain('AI LAYER-FIT RULES:')
  })

  it('audit_summary and prospect_overview default to the Discovery Call', async () => {
    process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL = 'https://cal.example.com/discovery'
    for (const reportType of ['audit_summary', 'prospect_overview']) {
      const { inputText } = await buildBody(reportType)
      expect(inputText).toContain('📅 **Book a Discovery Call**')
      expect(inputText).toContain('https://cal.example.com/discovery')
    }
  })

  it('admin override wins over the report-type default (kickoff on audit_summary)', async () => {
    process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL = 'https://cal.example.com/discovery'
    process.env.CALENDLY_KICKOFF_MEETING_URL = 'https://cal.example.com/kickoff'
    const { inputText } = await buildBody('audit_summary', {}, { calendlyEventKey: 'kickoff' })
    expect(inputText).toContain('📅 **Book a Kick Off Meeting**')
    expect(inputText).toContain('60 minutes.')
    expect(inputText).toContain('https://cal.example.com/kickoff')
    expect(inputText).not.toContain('📅 **Book a Discovery Call**')
  })

  it('onboarding falls back to the Discovery URL when CALENDLY_ONBOARDING_CALL_URL is missing', async () => {
    delete process.env.CALENDLY_ONBOARDING_CALL_URL
    process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL = 'https://cal.example.com/discovery'
    const { inputText } = await buildBody('value_quantification')
    // Label + copy stay Onboarding (the admin intent), only the URL falls back.
    expect(inputText).toContain('📅 **Book a Onboarding Call**')
    expect(inputText).toContain('https://cal.example.com/discovery')
    // And we should have warned about the missing env var.
    expect(warnSpy).toHaveBeenCalled()
    const calls = warnSpy.mock.calls.map((c: unknown[]) => String(c[0] ?? ''))
    expect(calls.some((m: string) => m.includes('CALENDLY_ONBOARDING_CALL_URL'))).toBe(true)
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
    // Gamma only picks up raw URLs on their own line (not markdown image
    // syntax), so we assert the raw URL form and explicitly reject the
    // wrapped-markdown form that Gamma silently drops.
    expect(inputText).toContain('\nhttps://amadutown.com/Profile_Photo_1.jpg\n')
    expect(inputText).toContain('\nhttps://amadutown.com/logo_hd.png\n')
    expect(inputText).not.toMatch(/!\[[^\]]*\]\(https?:\/\/[^)]*Profile_Photo/)
    expect(inputText).not.toMatch(/!\[[^\]]*\]\(https?:\/\/[^)]*logo_hd/)
    expect(inputText).not.toContain('http://localhost:3000/Profile_Photo_1.jpg')
  })

  it('honors GAMMA_PUBLIC_ASSET_BASE_URL override when set', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    process.env.GAMMA_PUBLIC_ASSET_BASE_URL = 'https://preview.amadutown.com'
    const { inputText } = await buildBody('audit_summary')
    expect(inputText).toContain('\nhttps://preview.amadutown.com/Profile_Photo_1.jpg\n')
  })

  it('uses NEXT_PUBLIC_SITE_URL directly when it is a public https origin', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://amadutown.com'
    delete process.env.GAMMA_PUBLIC_ASSET_BASE_URL
    const { inputText } = await buildBody('audit_summary')
    expect(inputText).toContain('\nhttps://amadutown.com/Profile_Photo_1.jpg\n')
  })
})
