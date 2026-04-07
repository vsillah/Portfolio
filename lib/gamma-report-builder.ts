/**
 * Gamma Report Builder — assembles structured prompts for Gamma API
 * from internal data (audits, value evidence, contacts, services)
 * and external inputs (third-party findings, competitor info, site crawl data).
 *
 * Two proven templates:
 * 1. Value Quantification ("Cost of Standing Still") — 16-slide structure
 * 2. Implementation Strategy ("UX Redesign") — 19-slide structure
 */

import { supabaseAdmin } from './supabase'
import type { GammaGenerateOptions } from './gamma-client'
import {
  type CalculationMethod,
  type ConfidenceLevel,
  CALCULATION_METHOD_LABELS,
  CONFIDENCE_LABELS,
  normalizeCompanySize,
} from './value-calculations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GammaReportType =
  | 'value_quantification'
  | 'implementation_strategy'
  | 'audit_summary'
  | 'prospect_overview'

export interface ExternalInputs {
  thirdPartyFindings?: string
  competitorPlatform?: string
  siteCrawlData?: string
  customInstructions?: string
}

export type ExternalInputSourceMode = 'provided' | 'none'

export interface GammaReportParams {
  reportType: GammaReportType
  contactSubmissionId?: number
  diagnosticAuditId?: number | string
  valueReportId?: string
  proposalId?: string
  serviceIds?: string[]
  externalInputs?: ExternalInputs
  externalInputSources?: Partial<Record<'thirdPartyFindings' | 'competitorPlatform' | 'siteCrawlData', ExternalInputSourceMode>>
  theme?: string
  gammaOptions?: Partial<GammaGenerateOptions>
}

export interface GammaReportInput {
  inputText: string
  options: GammaGenerateOptions
  title: string
}

/** Minimal context for video script generation (companion video from report). */
export interface VideoScriptContext {
  contactName: string | null
  company: string | null
  industry: string | null
  diagnosticSummary: string | null
  valueStatementsSummary: string | null
  totalAnnualValue: number | null
  topPainPoints: string[]
}

interface ReportContext {
  contact: ContactData | null
  audit: AuditData | null
  valueReport: ValueReportData | null
  services: ServiceData[]
  painPoints: PainPointData[]
  benchmarks: BenchmarkData[]
}

interface ContactData {
  id: number
  name: string
  email: string
  company: string
  industry: string
  employee_count: string
  phone?: string
}

interface AuditData {
  id: number
  business_challenges: Record<string, unknown> | null
  tech_stack: Record<string, unknown> | null
  automation_needs: Record<string, unknown> | null
  ai_readiness: Record<string, unknown> | null
  budget_timeline: Record<string, unknown> | null
  decision_making: Record<string, unknown> | null
  diagnostic_summary: string | null
  key_insights: string[] | null
  recommended_actions: string[] | null
  urgency_score: number | null
  opportunity_score: number | null
}

interface ValueReportData {
  id: string
  title: string
  report_type: string
  industry: string
  company_size_range: string
  summary_markdown: string
  value_statements: ValueStatementData[]
  total_annual_value: number
  evidence_chain: Record<string, unknown>
}

interface ValueStatementData {
  painPoint: string
  painPointId: string
  annualValue: number
  calculationMethod: CalculationMethod
  formulaReadable: string
  evidenceSummary: string
  confidence: ConfidenceLevel
}

interface ServiceData {
  id: string
  title: string
  description: string
  service_type: string
  delivery_method: string
  price: number | null
  is_quote_based: boolean
  duration_description: string | null
}

interface PainPointData {
  id: string
  name: string
  display_name: string
  description: string | null
}

interface BenchmarkData {
  id: string
  industry: string
  company_size_range: string
  benchmark_type: string
  value: number
  source: string
}

// ---------------------------------------------------------------------------
// Derived Metrics — single source of truth for all templates
// ---------------------------------------------------------------------------

export interface DerivedMetrics {
  totalAnnualValue: number | null
  estimatedInvestment: number | null
  roi: number | null
  paybackMonths: number | null
  topPainPoints: ValueStatementData[]
  urgencyScore: number | null
  opportunityScore: number | null
}

export function computeDerivedMetrics(ctx: ReportContext): DerivedMetrics {
  const vr = ctx.valueReport
  const totalAnnualValue = vr?.total_annual_value ?? null
  const statements = vr?.value_statements ?? []

  const estimatedInvestment = estimateTotalInvestment(statements, ctx.services) || null

  let roi: number | null = null
  let paybackMonths: number | null = null
  if (totalAnnualValue && totalAnnualValue > 0 && estimatedInvestment && estimatedInvestment > 0) {
    roi = Math.round(((totalAnnualValue - estimatedInvestment) / estimatedInvestment) * 100)
    paybackMonths = Math.round((estimatedInvestment / (totalAnnualValue / 12)) * 10) / 10
  }

  const topPainPoints = [...statements]
    .sort((a, b) => b.annualValue - a.annualValue)
    .slice(0, 5)

  return {
    totalAnnualValue,
    estimatedInvestment,
    roi,
    paybackMonths,
    topPainPoints,
    urgencyScore: ctx.audit?.urgency_score ?? null,
    opportunityScore: ctx.audit?.opportunity_score ?? null,
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatAuditSection(data: Record<string, unknown> | null, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback
  const entries = Object.entries(data)
  if (entries.length === 0) return fallback
  return entries
    .map(([key, value]) => {
      const label = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
      if (Array.isArray(value)) {
        return `- **${label}:** ${value.join(', ')}`
      }
      if (typeof value === 'object' && value !== null) {
        const sub = Object.entries(value as Record<string, unknown>)
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`)
          .join('; ')
        return `- **${label}:** ${sub}`
      }
      return `- **${label}:** ${String(value)}`
    })
    .join('\n')
}

/** Slide counts aligned with Admin → Gamma report type cards (passed to Gamma API as numCards). */
function numCardsForGammaReportType(reportType: GammaReportType): number {
  switch (reportType) {
    case 'value_quantification':
      return 16
    case 'implementation_strategy':
      return 19
    case 'audit_summary':
      return 10
    case 'prospect_overview':
      return 8
    default:
      return 19
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function buildGammaReportInput(
  params: GammaReportParams
): Promise<GammaReportInput> {
  const context = await fetchReportContext(params)

  let inputText: string
  let title: string

  switch (params.reportType) {
    case 'value_quantification':
      ({ inputText, title } = buildValueQuantificationPrompt(context, params))
      break
    case 'implementation_strategy':
      ({ inputText, title } = buildImplementationStrategyPrompt(context, params))
      break
    case 'audit_summary':
      ({ inputText, title } = buildAuditSummaryPrompt(context, params))
      break
    case 'prospect_overview':
      ({ inputText, title } = buildProspectOverviewPrompt(context, params))
      break
    default:
      throw new Error(`Unknown report type: ${params.reportType}`)
  }

  const orgName = context.contact?.company || 'the organization'
  const numCards = numCardsForGammaReportType(params.reportType)

  const options: GammaGenerateOptions = {
    textMode: 'generate',
    format: 'presentation',
    numCards,
    cardSplit: 'auto',
    exportAs: 'pdf',
    textOptions: {
      amount: 'detailed',
      tone: 'professional, data-driven, consultative',
      audience: `nonprofit and small business leadership, board members, and executive directors at ${orgName}`,
      language: 'en',
    },
    imageOptions: {
      source: 'noImages',
    },
    cardOptions: {
      dimensions: '16x9',
    },
    sharingOptions: {
      externalAccess: 'view',
    },
    ...params.gammaOptions,
  }

  options.themeId = params.theme || process.env.GAMMA_DEFAULT_THEME_ID || undefined

  if (params.externalInputs?.customInstructions) {
    options.additionalInstructions = params.externalInputs.customInstructions
  }

  return { inputText, options, title }
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchReportContext(params: GammaReportParams): Promise<ReportContext> {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not available — server-side only')
  }

  const [contact, audit, valueReport, services, painPoints, benchmarks] = await Promise.all([
    params.contactSubmissionId
      ? supabaseAdmin
          .from('contact_submissions')
          .select('id, name, email, company, industry, employee_count, phone')
          .eq('id', params.contactSubmissionId)
          .single()
          .then((r: { data: ContactData | null }) => r.data)
      : Promise.resolve(null),

    params.diagnosticAuditId
      ? supabaseAdmin
          .from('diagnostic_audits')
          .select(
            'id, business_challenges, tech_stack, automation_needs, ai_readiness, budget_timeline, decision_making, diagnostic_summary, key_insights, recommended_actions, urgency_score, opportunity_score'
          )
          .eq('id', params.diagnosticAuditId)
          .single()
          .then((r: { data: AuditData | null }) => r.data)
      : Promise.resolve(null),

    params.valueReportId
      ? supabaseAdmin
          .from('value_reports')
          .select(
            'id, title, report_type, industry, company_size_range, summary_markdown, value_statements, total_annual_value, evidence_chain'
          )
          .eq('id', params.valueReportId)
          .single()
          .then((r: { data: ValueReportData | null }) => r.data)
      : Promise.resolve(null),

    params.serviceIds && params.serviceIds.length > 0
      ? supabaseAdmin
          .from('services')
          .select('id, title, description, service_type, delivery_method, price, is_quote_based, duration_description')
          .in('id', params.serviceIds)
          .then((r: { data: ServiceData[] | null }) => (r.data || []) as ServiceData[])
      : supabaseAdmin
          .from('services')
          .select('id, title, description, service_type, delivery_method, price, is_quote_based, duration_description')
          .eq('is_active', true)
          .eq('is_featured', true)
          .limit(10)
          .then((r: { data: ServiceData[] | null }) => (r.data || []) as ServiceData[]),

    supabaseAdmin
      .from('pain_point_categories')
      .select('id, name, display_name, description')
      .eq('is_active', true)
      .then((r: { data: PainPointData[] | null }) => (r.data || []) as PainPointData[]),

    supabaseAdmin
      .from('industry_benchmarks')
      .select('id, industry, company_size_range, benchmark_type, value, source')
      .then((r: { data: BenchmarkData[] | null }) => (r.data || []) as BenchmarkData[]),
  ])

  return { contact, audit, valueReport, services, painPoints, benchmarks }
}

/**
 * Fetch minimal context for video script generation (companion video from report).
 * Reuses the same data layer as buildGammaReportInput so script and report stay in sync.
 */
export async function fetchVideoScriptContext(
  params: GammaReportParams
): Promise<VideoScriptContext> {
  const ctx = await fetchReportContext(params)
  return reportContextToVideoScriptContext(ctx)
}

/**
 * Map report context to video script context (no extra fetch).
 * Used when you already have ReportContext (e.g. report+video one-click).
 */
function reportContextToVideoScriptContext(ctx: ReportContext): VideoScriptContext {
  const statements = ctx.valueReport?.value_statements ?? []
  const topPainPoints = statements
    .slice(0, 3)
    .map((s: ValueStatementData) => s.painPoint || s.evidenceSummary || '')
    .filter(Boolean)
  const valueStatementsSummary =
    statements.length > 0
      ? `We identified ${statements.length} opportunity areas worth $${(ctx.valueReport?.total_annual_value ?? 0).toLocaleString()} annually.`
      : null
  return {
    contactName: ctx.contact?.name ?? null,
    company: ctx.contact?.company ?? null,
    industry: ctx.contact?.industry ?? ctx.valueReport?.industry ?? null,
    diagnosticSummary: ctx.audit?.diagnostic_summary ?? null,
    valueStatementsSummary,
    totalAnnualValue: ctx.valueReport?.total_annual_value ?? null,
    topPainPoints,
  }
}

/**
 * Single fetch that returns both Gamma report input and video script context.
 * Use for report+video one-click so both outputs use the same context.
 */
export async function fetchReportAndVideoContext(
  params: GammaReportParams
): Promise<{ gammaInput: GammaReportInput; videoScriptContext: VideoScriptContext }> {
  const ctx = await fetchReportContext(params)
  const gammaInput = buildGammaReportInputFromContext(ctx, params)
  const videoScriptContext = reportContextToVideoScriptContext(ctx)
  return { gammaInput, videoScriptContext }
}

/**
 * Build Gamma report input from an already-fetched context (no extra fetch).
 */
function buildGammaReportInputFromContext(
  ctx: ReportContext,
  params: GammaReportParams
): GammaReportInput {
  let inputText: string
  let title: string

  switch (params.reportType) {
    case 'value_quantification':
      ({ inputText, title } = buildValueQuantificationPrompt(ctx, params))
      break
    case 'implementation_strategy':
      ({ inputText, title } = buildImplementationStrategyPrompt(ctx, params))
      break
    case 'audit_summary':
      ({ inputText, title } = buildAuditSummaryPrompt(ctx, params))
      break
    case 'prospect_overview':
      ({ inputText, title } = buildProspectOverviewPrompt(ctx, params))
      break
    default:
      throw new Error(`Unknown report type: ${params.reportType}`)
  }

  const orgName = ctx.contact?.company || 'the organization'
  const numCards = numCardsForGammaReportType(params.reportType)

  const options: GammaGenerateOptions = {
    textMode: 'generate',
    format: 'presentation',
    numCards,
    cardSplit: 'auto',
    exportAs: 'pdf',
    textOptions: {
      amount: 'detailed',
      tone: 'professional, data-driven, consultative',
      audience: `nonprofit and small business leadership, board members, and executive directors at ${orgName}`,
      language: 'en',
    },
    imageOptions: {
      source: 'noImages',
    },
    cardOptions: {
      dimensions: '16x9',
    },
    sharingOptions: {
      externalAccess: 'view',
    },
    ...params.gammaOptions,
  }

  options.themeId = params.theme || process.env.GAMMA_DEFAULT_THEME_ID || undefined

  if (params.externalInputs?.customInstructions) {
    options.additionalInstructions = params.externalInputs.customInstructions
  }

  return { inputText, options, title }
}

// ---------------------------------------------------------------------------
// Template 1: Value Quantification ("Cost of Standing Still")
// ---------------------------------------------------------------------------

function buildValueQuantificationPrompt(
  ctx: ReportContext,
  params: GammaReportParams
): { inputText: string; title: string } {
  const orgName = ctx.contact?.company || 'the Organization'
  const industry = ctx.contact?.industry || ctx.valueReport?.industry || 'nonprofit'
  const companySize = normalizeCompanySize(
    ctx.contact?.employee_count || ctx.valueReport?.company_size_range || '11-50'
  )
  const statements = ctx.valueReport?.value_statements || []
  const metrics = computeDerivedMetrics(ctx)
  const totalAnnualValue = metrics.totalAnnualValue || 0
  const totalInvestment = metrics.estimatedInvestment || 0

  const title = `The Cost of Standing Still: ${orgName} Opportunity Quantification`

  const sections: string[] = []

  // --- Slide 1: Title ---
  sections.push(`
# ${title}

A data-driven analysis of unrealized value across ${orgName}'s digital presence — quantifying the financial case for action across ${statements.length} identified pain points.

Prepared by: Amadutown Advisory Solutions
Methodology: ATAS Value & Pricing Logic v1.0
Segment: ${industry} | ${companySize} employees
Date: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
`)

  // --- Slide 2: Why This Analysis Matters ---
  sections.push(`
# WHY THIS ANALYSIS MATTERS
## Every Recommendation Has a Measurable Financial Impact

This analysis quantifies the opportunity using Amadutown's standardized value calculation engine — the same methodology used across all client engagements, ensuring consistency, auditability, and apples-to-apples comparison.

**What We Calculated:** ${statements.length} pain points from the audit and site analysis, each mapped to one of ATAS's five evidence-based calculation methods.

**How We Sourced It:** Every input is drawn from third-party research — industry benchmarks, BLS data, and ATAS ${industry} segment fallback rates.

**What This Tells ${orgName}:** Exactly how much value is being left on the table, which fixes deliver the highest return per dollar, and how quickly the investment pays for itself.
`)

  // --- Slide 2b: Current State Assessment (from diagnostic audit) ---
  if (ctx.audit) {
    let assessmentSlide = `
# CURRENT STATE ASSESSMENT
## Where ${orgName} Stands Today
`
    if (ctx.audit.diagnostic_summary) {
      assessmentSlide += `\n${ctx.audit.diagnostic_summary}\n`
    }
    if (metrics.urgencyScore !== null || metrics.opportunityScore !== null) {
      assessmentSlide += `\n`
      if (metrics.urgencyScore !== null) assessmentSlide += `**Urgency Score:** ${metrics.urgencyScore}/10 | `
      if (metrics.opportunityScore !== null) assessmentSlide += `**Opportunity Score:** ${metrics.opportunityScore}/10\n`
    }
    if (ctx.audit.key_insights && ctx.audit.key_insights.length > 0) {
      assessmentSlide += `\n**Key Findings:**\n`
      for (const insight of ctx.audit.key_insights.slice(0, 3)) {
        assessmentSlide += `- ${insight}\n`
      }
    }
    sections.push(assessmentSlide)
  }

  // --- Slide 3: Top-Line Opportunity ---
  sections.push(`
# TOP-LINE OPPORTUNITY
## Four Numbers Every Board Member Should Know

- **${formatCurrency(totalAnnualValue)}** — Annual Value at Stake (across all ${statements.length} identified pain points)
- **${formatCurrency(totalInvestment)}** — Total Investment (phased over 3–6 months, all tracks combined)
- **${metrics.roi || 0}%** — First-Year ROI (return on investment in year one alone)
- **${metrics.paybackMonths || 0} months** — Payback Period (months to fully break even on the investment)
`)

  // --- Slide 4: Overview Table ---
  if (statements.length > 0) {
    let overviewTable = `
# OVERVIEW
## The Pain Points — Mapped to Method & Track

Each identified pain point is assigned a calculation method from ATAS Value & Pricing Logic and aligned to a delivery track.

| Pain Point | Method | Annual Lift | Confidence |
|-----------|--------|------------|------------|
`
    for (const stmt of statements) {
      overviewTable += `| ${stmt.painPoint} | ${CALCULATION_METHOD_LABELS[stmt.calculationMethod]} | ${formatCurrency(stmt.annualValue)} | ${CONFIDENCE_LABELS[stmt.confidence]} |\n`
    }
    sections.push(overviewTable)
  }

  // --- Slides 5-9: Per-Pain-Point Detail Cards ---
  const recommendedActions = ctx.audit?.recommended_actions ?? []
  for (const stmt of metrics.topPainPoints) {
    let card = `
# ${stmt.painPoint}

**The Problem:** This area represents an estimated ${formatCurrency(stmt.annualValue)}/year in unrealized value.

**Calculation — ${CALCULATION_METHOD_LABELS[stmt.calculationMethod]}:**
${stmt.formulaReadable}

**Annual Lift:** ${formatCurrency(stmt.annualValue)}
**Evidence:** ${stmt.evidenceSummary}
**Confidence:** ${CONFIDENCE_LABELS[stmt.confidence]}
`
    const matchingAction = recommendedActions.find(
      (a: string) => a.toLowerCase().includes(stmt.painPoint.toLowerCase().split(' ')[0])
    )
    if (matchingAction) {
      card += `\n**Recommended Action:** ${matchingAction}\n`
    }
    sections.push(card)
  }

  // --- Slide 10: Money Slide ---
  const sorted = [...statements].sort((a, b) => b.annualValue - a.annualValue)
  let moneySlide = `
# THE MONEY SLIDE
## Value-per-Effort Ranking: Where Does Your Money Go Furthest?

Every opportunity ranked by annual value. If budget is constrained, this answers: "Where do we start?"

| # | Opportunity | Annual Lift |
|---|-----------|------------|
`
  sorted.forEach((stmt, i) => {
    moneySlide += `| ${i + 1} | ${stmt.painPoint} | ${formatCurrency(stmt.annualValue)} |\n`
  })
  sections.push(moneySlide)

  // --- Slide 11: Investment Summary ---
  sections.push(`
# INVESTMENT SUMMARY
## Track-by-Track Comparison

| Track | Annual Lift | Investment | Notes |
|-------|-----------|-----------|-------|
| Track 1 — DIY | Low-cost quick wins | $0 (staff time only) | Navigation cleanup, content consolidation |
| Track 2 — Platform | Platform-specific improvements | $1,500–$3,500 | Existing platform professional services |
| Track 3 — ATAS | ${formatCurrency(totalAnnualValue * 0.8)} | ${formatCurrency(totalInvestment * 0.7)} | AI automation, brand strategy, donor engagement |
| **All Tracks Combined** | **${formatCurrency(totalAnnualValue)}** | **${formatCurrency(totalInvestment)}** | **Phased over 3–6 months** |

Year 2 Effect: Once the initial investment is recovered, recurring annual value requires zero additional investment. Year 2 ROI accelerates as compounding benefits take effect.
`)

  // --- Slide 12: 3-Year Projection ---
  const yr2 = Math.round(totalAnnualValue * 1.2)
  const yr3 = Math.round(totalAnnualValue * 1.44)
  const threeYearTotal = totalAnnualValue + yr2 + yr3
  const threeYearNet = threeYearTotal - totalInvestment
  const threeYearRoi = totalInvestment > 0
    ? Math.round((threeYearNet / totalInvestment) * 100)
    : 0

  sections.push(`
# PROJECTION
## The Compounding Effect — Year 1 Through Year 3

- **Year 1 Value:** ${formatCurrency(totalAnnualValue)}
- **Year 2 (20% growth):** ${formatCurrency(yr2)}
- **Year 3 (20% growth):** ${formatCurrency(yr3)}
- **3-Year Cumulative Value:** ${formatCurrency(threeYearTotal)}
- **3-Year Net Value (after investment):** ${formatCurrency(threeYearNet)}
- **3-Year ROI:** ${threeYearRoi}%
`)

  // --- Slide 13: Methodology ---
  sections.push(`
# METHODOLOGY & TRANSPARENCY
## How Every Number Was Calculated

**Calculation Methods — ATAS:**
- Time Saved: hours_per_week × hourly_rate × weeks_per_year
- Opportunity Cost: missed_opportunities × avg_deal_value × close_rate
- Error Reduction: error_rate × cost_per_error × annual_volume
- Revenue Acceleration: days_faster × daily_revenue_impact
- Replacement Cost: fte_count × avg_salary × benefits_multiplier

**Segment Configuration:**
- Segment: ${industry}
- Company Size: ${companySize} (normalized)

**ROI & Payback Formula:**
- ROI = (value − price) / price × 100
- Payback = price / (value / 12)

**Confidence Levels:**
- High (≥5 sources with benchmarks)
- Medium (≥2 sources)
- Low (limited data)
`)

  // --- Slide 14: Sources ---
  sections.push(`
# SOURCES
## Third-Party Research Validating Every Benchmark

1. Bureau of Labor Statistics (BLS) — hourly wages, employee costs, industry data
2. Glassdoor Salary Data — role-specific salaries, compensation benchmarks
3. HubSpot Sales Benchmark Report — deal sizes, close rates, sales cycle length
4. McKinsey & Company — AI adoption, automation potential by industry
5. Gartner IT Spending Forecasts — IT budgets, tool spending
6. M+R Benchmarks — nonprofit online fundraising metrics
7. Fundraising Effectiveness Project (FEP) — donor retention rates
8. Independent Sector — volunteer hour valuation
`)

  // --- Slide 15: Next Steps ---
  sections.push(`
# NEXT STEPS
## Turning Data Into Action: A Phased Roadmap

**Phase 1 — Quick Wins (Week 1–2, $0):** Navigation cleanup, content consolidation, low-hanging fruit improvements.

**Phase 2 — Foundation (Month 1–2):** Platform optimization, donation page improvements, basic automation setup.

**Phase 3 — Growth Engine (Month 2–4):** AI content pipeline, volunteer onboarding automation, brand strategy implementation.

**Phase 4 — Compounding (Month 4–6):** Donor retention automation, social media activation, partnership development.

The numbers are clear. Phase 1 captures free wins immediately. Phases 2–4 build sequentially, with each investment amplifying the one before it.
`)

  // --- Slide 16: CTA ---
  sections.push(`
# Ready to Align on Priorities?

Amadutown Advisory Solutions is available to develop a detailed Statement of Work tailored to ${orgName}'s budget and timeline.

**Book a 30-minute discovery call to get started.**

Contact: Amadutown Advisory Solutions
Website: amadutown.com
`)

  // Add third-party findings context if provided
  if (params.externalInputs?.thirdPartyFindings) {
    sections.unshift(`
[CONTEXT — Third-Party Audit Findings to incorporate throughout the presentation:]
${params.externalInputs.thirdPartyFindings}
`)
  }

  if (params.externalInputs?.siteCrawlData) {
    sections.unshift(`
[CONTEXT — Site Crawl Data to reference for specific metrics:]
${params.externalInputs.siteCrawlData}
`)
  }

  return { inputText: sections.join('\n---\n'), title }
}

// ---------------------------------------------------------------------------
// Template 2: Implementation Strategy
// ---------------------------------------------------------------------------

function buildImplementationStrategyPrompt(
  ctx: ReportContext,
  params: GammaReportParams
): { inputText: string; title: string } {
  const orgName = ctx.contact?.company || 'the Organization'
  const domain = params.externalInputs?.siteCrawlData ? 'Website UX Redesign' : 'Digital Strategy'
  const title = `${orgName} ${domain}: Implementation Strategy`
  const metrics = computeDerivedMetrics(ctx)

  const sections: string[] = []

  // --- Slide 1: Title ---
  sections.push(`
# ${title}

Prepared by Amadutown Advisory Solutions (ATAS) for ${orgName}
${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()} | STRATEGIC ADVISORY
`)

  // --- Slide 2: Executive Summary ---
  const hasThirdParty = !!params.externalInputs?.thirdPartyFindings
  const hasCompetitor = !!params.externalInputs?.competitorPlatform
  sections.push(`
# Executive Summary

${hasThirdParty
    ? `${orgName} received external consulting recommendations that identified key areas for improvement. This presentation translates those recommendations into an actionable implementation plan — mapping what can be handled in-house, what the existing platform offers, and where ATAS can accelerate results.`
    : `This presentation provides a comprehensive implementation strategy for ${orgName}, organized into three actionable tracks.`
}

**Track 1 — DIY:** Self-service changes within ${orgName}'s existing platform at no additional cost.
**Track 2 — Platform Professional Services:** Paid add-ons and upgrades available through the existing platform provider.
**Track 3 — ATAS Strategic Advisory:** Brand strategy, AI automation, and content systems that transform the site into a growth engine.
`)

  // --- Slide 3: Current State Assessment ---
  if (ctx.audit || params.externalInputs?.siteCrawlData) {
    let currentState = `
# Current State Assessment

`
    if (params.externalInputs?.siteCrawlData) {
      currentState += `Based on site analysis:\n${params.externalInputs.siteCrawlData}\n\n`
    }
    if (ctx.audit?.diagnostic_summary) {
      currentState += `**Diagnostic Summary:** ${ctx.audit.diagnostic_summary}\n\n`
    }
    if (ctx.audit?.urgency_score) {
      currentState += `**Urgency Score:** ${ctx.audit.urgency_score}/10 | **Opportunity Score:** ${ctx.audit.opportunity_score}/10\n`
    }
    sections.push(currentState)
  }

  // --- Slide 4: Third-Party Recommendations ---
  if (hasThirdParty) {
    sections.push(`
# External Consulting Recommendations

The following recommendations were identified by the external consulting engagement:

${params.externalInputs!.thirdPartyFindings}
`)
  }

  // --- Slides 5-8: Detailed Recommendation Breakdowns ---
  if (ctx.audit) {
    if (ctx.audit.key_insights && ctx.audit.key_insights.length > 0) {
      sections.push(`
# Key Insights from Assessment

${ctx.audit.key_insights.map((insight: string) => `- ${insight}`).join('\n')}
`)
    }
    if (ctx.audit.recommended_actions && ctx.audit.recommended_actions.length > 0) {
      sections.push(`
# Recommended Actions

${ctx.audit.recommended_actions.map((action: string) => `- ${action}`).join('\n')}
`)
    }
  }

  // --- Financial Case for Action (from value report, if available) ---
  if (metrics.totalAnnualValue && metrics.totalAnnualValue > 0) {
    let financialSlide = `
# FINANCIAL CASE FOR ACTION
## The Quantified Cost of Standing Still

Every recommendation in this strategy has a measurable financial impact. The value evidence below comes from ATAS's standardized calculation engine.

- **Total Annual Value at Stake:** ${formatCurrency(metrics.totalAnnualValue)}
`
    if (metrics.estimatedInvestment) financialSlide += `- **Estimated Total Investment:** ${formatCurrency(metrics.estimatedInvestment)}\n`
    if (metrics.roi !== null) financialSlide += `- **Projected First-Year ROI:** ${metrics.roi}%\n`
    if (metrics.paybackMonths !== null) financialSlide += `- **Payback Period:** ${metrics.paybackMonths} months\n`

    if (metrics.topPainPoints.length > 0) {
      financialSlide += `\n**Top Opportunity Areas:**\n\n`
      financialSlide += `| Pain Point | Annual Value | Confidence |\n|-----------|-------------|------------|\n`
      for (const pp of metrics.topPainPoints) {
        financialSlide += `| ${pp.painPoint} | ${formatCurrency(pp.annualValue)} | ${CONFIDENCE_LABELS[pp.confidence]} |\n`
      }
    }
    sections.push(financialSlide)
  }

  // --- Slide 9: Track 1 — DIY ---
  sections.push(`
# TRACK 1: DIY — Self-Service Implementation

These changes can be made directly within ${orgName}'s existing platform at no additional cost beyond the current subscription. All tasks are within the capability of existing staff with basic CMS training.

1. **Navigation Restructure** — Reorganize into a simplified, audience-based structure. Effort: 8–12 hrs · Cost: $0
2. **Content Consolidation** — Delete or merge redundant pages to reduce bloat. Effort: 15–20 hrs · Cost: $0
3. **Homepage Reorganization** — Rearrange homepage sections for better conversion. Effort: 4–6 hrs · Cost: $0
4. **Call-to-Action Consolidation** — Streamline scattered CTAs onto focused pages. Effort: 3–4 hrs · Cost: $0

**Total DIY Track:** ~30–42 hours of staff time · $0 additional platform cost
`)

  // --- Slide 10: Track 2 — Platform Services ---
  if (hasCompetitor) {
    sections.push(`
# TRACK 2: Platform Professional Services

These enhancements leverage the existing platform's paid add-on services:

${params.externalInputs!.competitorPlatform}

Estimated Platform Total: $0–$3,500 one-time + ongoing subscription
`)
  } else {
    sections.push(`
# TRACK 2: Platform Professional Services

These enhancements require the existing platform's paid add-on services — offering a template-based upgrade path that improves aesthetics and functionality without requiring custom development.

| Service | Estimated Cost | Timeline |
|---------|---------------|----------|
| Theme / Design Change | $0–$3,500 | 4–6 weeks |
| Color & Branding Update | $500–$1,000 | 1–2 weeks |
| Email Marketing Automation | Subscription upgrade | 1–2 weeks |
| Event Registration Enhancement | Included in premium plan | 1–2 weeks |
| E-commerce / Merch Store | Included + processing fees | 2–3 weeks |
`)
  }

  // --- Slide 11: Track 3 — ATAS Intro ---
  sections.push(`
# TRACK 3: ATAS Strategic Advisory — The Difference Layer

The existing platform gives ${orgName} a solid CMS. What it doesn't provide is strategy, AI-powered automation, and the intentional brand thinking that turns a website from a digital brochure into a growth engine.

**Technology Serves the Mission:** Every tool recommendation, every automation, every design decision is filtered through one question: does this help ${orgName} achieve its mission more effectively?

**Product-Thinking:** ATAS applies the same frameworks used with corporate product teams — user journeys, conversion funnels, and measurable outcomes — to digital strategy.

**Partner, Not Vendor:** We work alongside ${orgName}'s team, building internal capability and sustainable systems — not dependencies.
`)

  // --- Slides 12-15: ATAS Offerings ---
  const atasOfferings = getATASOfferings(ctx.services, ctx.audit)
  for (const offering of atasOfferings.slice(0, 4)) {
    sections.push(`
# ATAS OFFERING: ${offering.title}

**What We Deliver:**
${offering.deliverables.map((d: string) => `- ${d}`).join('\n')}

**Why ATAS vs. Platform:**
${offering.differentiation}

**Investment:** ${offering.priceRange}
`)
  }

  // --- Slide 16: Investment Comparison ---
  const implInvestment = metrics.estimatedInvestment
  const implAnnualValue = metrics.totalAnnualValue
  const atasInvestLabel = implInvestment
    ? `${formatCurrency(implInvestment)} phased over 3–6 months`
    : '$14,000–$23,000 phased over 3–6 months'
  const atasOutcomeExtra = implAnnualValue
    ? ` | Projected annual value: ${formatCurrency(implAnnualValue)}`
    : ''

  sections.push(`
# Total Investment Comparison

Three paths forward — each with a different level of strategic depth, resource investment, and transformational potential.

| Option | Investment | Timeline | Outcome |
|--------|-----------|----------|---------|
| Option A — DIY Only | $0 + ~40 hrs staff time | 2–3 months | Cleaner pages, same brand, no automation |
| Option B — Platform Services | $0–$3,500 one-time + subscription | 1–2 months | Fresh design, basic email automation |
| Option C — ATAS Full Partnership | ${atasInvestLabel} | 3–6 months | Complete transformation: AI automation, sustainable growth systems, brand authority${atasOutcomeExtra} |

ATAS recommends Option C implemented in phases to spread investment, demonstrate early wins, and build internal capacity alongside the build.${metrics.roi !== null ? ` Projected first-year ROI: ${metrics.roi}%.` : ''}
`)

  // --- Slide 17: Phased Approach ---
  const phasedPainPoints = metrics.topPainPoints
  const phase1Value = phasedPainPoints.slice(0, 2).reduce((s, p) => s + p.annualValue, 0)
  const phase2Value = phasedPainPoints.slice(2, 4).reduce((s, p) => s + p.annualValue, 0)
  const phase3Value = phasedPainPoints.slice(4).reduce((s, p) => s + p.annualValue, 0)
  const hasPhaseValues = phasedPainPoints.length > 0

  sections.push(`
# Recommended Phased Approach

A phased implementation reduces risk, allows ${orgName} to see early results, and builds internal capability alongside each deliverable.

**Phase 1: Foundation (Months 1–2, $5,000–$7,000)**
Brand strategy, navigation restructure, full content audit, platform design change request initiated.${hasPhaseValues && phase1Value > 0 ? `\nTargeted annual value: ${formatCurrency(phase1Value)}` : ''}

**Phase 2: Build (Months 2–4, $5,000–$8,000)**
Homepage redesign, conversion optimization, AI content system deployment, automation setup.${hasPhaseValues && phase2Value > 0 ? `\nTargeted annual value: ${formatCurrency(phase2Value)}` : ''}

**Phase 3: Scale (Months 4–6, $4,000–$8,000)**
Social media activation, donor/engagement automation, merch store launch, partnership pitches, staff training and handoff.${hasPhaseValues && phase3Value > 0 ? `\nTargeted annual value: ${formatCurrency(phase3Value)}` : ''}
`)

  // --- Slide 18: Why ATAS ---
  sections.push(`
# Why Amadutown Advisory Solutions

ATAS was built for exactly this kind of engagement — serving mission-driven nonprofits and minority-owned businesses with AI consulting, automation, and strategic systems that create lasting impact.

**We Dogfood Everything:** Every tool, framework, and automation we recommend is one we use ourselves. No theoretical advice — only proven systems.

**Product Management Roots:** We come from product management — user journeys, conversion funnels, and measurable outcomes are our native language.

**AI & Nonprofit Specialization:** We specialize in applying AI to nonprofit operations — not just technology implementation, but strategic capability building.

**Strategy-First Mindset:** We start by reframing the need from "we need technology" to "we need strategy." That's the ATAS difference.
`)

  // --- Slide 19: Next Steps ---
  sections.push(`
# Next Steps

Ready to turn ${orgName}'s website into a mission-aligned growth engine? Here's how we move from proposal to partnership in two weeks or less.

1. **Schedule Discovery Call** — A 30-minute conversation to align on vision, priorities, and any outstanding questions.
2. **Align on Priorities & Budget** — Confirm which ATAS tracks and phases best match current capacity and available resources.
3. **Develop Statement of Work** — ATAS drafts a detailed SOW with milestones, deliverables, timelines, and pricing.
4. **Kick Off Phase 1** — Begin brand strategy and content audit within two weeks of contract signing. Early wins visible within the first 30 days.

**Get in Touch:**
Amadutown Advisory Solutions
amadutown.com
`)

  return { inputText: sections.join('\n---\n'), title }
}

// ---------------------------------------------------------------------------
// Template 3: Audit Summary (placeholder — future)
// ---------------------------------------------------------------------------

function buildAuditSummaryPrompt(
  ctx: ReportContext,
  params: GammaReportParams
): { inputText: string; title: string } {
  const orgName = ctx.contact?.company || 'the Organization'
  const metrics = computeDerivedMetrics(ctx)
  const title = `${orgName} — Diagnostic Audit Summary`

  const sections: string[] = []

  // --- Slide 1: Title + scores ---
  let titleSlide = `# ${title}\n\nPrepared by Amadutown Advisory Solutions\n${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
  if (metrics.urgencyScore !== null || metrics.opportunityScore !== null) {
    titleSlide += `\n\n`
    if (metrics.urgencyScore !== null) titleSlide += `**Urgency Score:** ${metrics.urgencyScore}/10 | `
    if (metrics.opportunityScore !== null) titleSlide += `**Opportunity Score:** ${metrics.opportunityScore}/10`
  }
  sections.push(titleSlide)

  if (ctx.audit) {
    const categories: { key: keyof AuditData; label: string }[] = [
      { key: 'business_challenges', label: 'Business Challenges' },
      { key: 'tech_stack', label: 'Technology Stack' },
      { key: 'automation_needs', label: 'Automation Needs' },
      { key: 'ai_readiness', label: 'AI Readiness' },
      { key: 'budget_timeline', label: 'Budget & Timeline' },
      { key: 'decision_making', label: 'Decision Making' },
    ]

    for (const cat of categories) {
      const data = ctx.audit[cat.key]
      if (data && typeof data === 'object') {
        sections.push(`# ${cat.label}\n\n${formatAuditSection(data as Record<string, unknown>, 'No data available.')}`)
      }
    }

    if (ctx.audit.diagnostic_summary) {
      sections.push(`# Summary\n\n${ctx.audit.diagnostic_summary}`)
    }
    if (ctx.audit.key_insights?.length) {
      sections.push(`# Key Insights\n\n${ctx.audit.key_insights.map((i: string) => `- ${i}`).join('\n')}`)
    }
    if (ctx.audit.recommended_actions?.length) {
      sections.push(`# Recommended Actions\n\n${ctx.audit.recommended_actions.map((a: string) => `- ${a}`).join('\n')}`)
    }
  }

  // --- Financial Impact slide (from value report, if available) ---
  if (ctx.valueReport && metrics.totalAnnualValue && metrics.totalAnnualValue > 0) {
    let financialSlide = `# Financial Impact\n## Quantified Cost of Inaction\n\n`
    financialSlide += `- **Total Annual Value at Stake:** ${formatCurrency(metrics.totalAnnualValue)}\n`
    if (metrics.estimatedInvestment) financialSlide += `- **Estimated Investment:** ${formatCurrency(metrics.estimatedInvestment)}\n`
    if (metrics.roi !== null) financialSlide += `- **Projected First-Year ROI:** ${metrics.roi}%\n`
    if (metrics.paybackMonths !== null) financialSlide += `- **Payback Period:** ${metrics.paybackMonths} months\n`

    if (metrics.topPainPoints.length > 0) {
      financialSlide += `\n**Top Opportunity Areas:**\n`
      for (const pp of metrics.topPainPoints.slice(0, 3)) {
        financialSlide += `- ${pp.painPoint}: ${formatCurrency(pp.annualValue)}/yr\n`
      }
    }
    sections.push(financialSlide)
  }

  sections.push(`# Next Steps\n\nContact Amadutown Advisory Solutions at amadutown.com to discuss these findings.`)

  return { inputText: sections.join('\n---\n'), title }
}

// ---------------------------------------------------------------------------
// Template 4: Prospect Overview (placeholder — future)
// ---------------------------------------------------------------------------

function buildProspectOverviewPrompt(
  ctx: ReportContext,
  params: GammaReportParams
): { inputText: string; title: string } {
  const orgName = ctx.contact?.company || 'the Organization'
  const industry = ctx.contact?.industry || 'general'
  const metrics = computeDerivedMetrics(ctx)
  const title = `${orgName} — AI & Automation Opportunity Overview`

  const sections: string[] = []

  sections.push(`# ${title}\n\nPrepared by Amadutown Advisory Solutions\n${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)

  sections.push(`# About ${orgName}\n\nIndustry: ${industry}\nSize: ${ctx.contact?.employee_count || 'Unknown'}`)

  // Assessment Snapshot (light, one slide — skip if no audit)
  if (ctx.audit?.diagnostic_summary) {
    let snapshot = `# Assessment Snapshot\n\n${ctx.audit.diagnostic_summary}`
    if (metrics.urgencyScore !== null) snapshot += `\n\n**Urgency:** ${metrics.urgencyScore}/10`
    if (metrics.opportunityScore !== null) snapshot += ` | **Opportunity:** ${metrics.opportunityScore}/10`
    sections.push(snapshot)
  }

  if (ctx.painPoints.length > 0) {
    sections.push(`# Common Pain Points in ${industry}\n\n${ctx.painPoints.slice(0, 6).map((pp) => `- **${pp.display_name}**: ${pp.description || 'A common challenge in this industry'}`).join('\n')}`)
  }

  // Potential Annual Impact (light, one slide — skip if no value report)
  if (metrics.totalAnnualValue && metrics.totalAnnualValue > 0) {
    let impactSlide = `# Potential Annual Impact\n## Quantified Opportunity for ${orgName}\n\n`
    impactSlide += `**Total Annual Value at Stake:** ${formatCurrency(metrics.totalAnnualValue)}\n\n`
    if (metrics.topPainPoints.length > 0) {
      impactSlide += `**Top Opportunity Areas:**\n`
      for (const pp of metrics.topPainPoints.slice(0, 3)) {
        impactSlide += `- ${pp.painPoint}: ${formatCurrency(pp.annualValue)}/yr\n`
      }
    }
    sections.push(impactSlide)
  }

  if (ctx.services.length > 0) {
    sections.push(`# Relevant ATAS Services\n\n${ctx.services.slice(0, 6).map((s) => `- **${s.title}** (${s.service_type}): ${s.description?.substring(0, 150)}...`).join('\n')}`)
  }

  sections.push(`# Next Steps\n\nBook a discovery call at amadutown.com to explore how AI and automation can help ${orgName}.`)

  return { inputText: sections.join('\n---\n'), title }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function estimateTotalInvestment(
  statements: ValueStatementData[],
  services: ServiceData[]
): number {
  const avgServicePrice = services.length > 0
    ? services.reduce((sum, s) => sum + (s.price || 3000), 0) / services.length
    : 5000
  return Math.round(statements.length * avgServicePrice * 0.6)
}

interface ATASOffering {
  title: string
  deliverables: string[]
  differentiation: string
  priceRange: string
}

function getATASOfferings(
  services: ServiceData[],
  audit: AuditData | null
): ATASOffering[] {
  const offerings: ATASOffering[] = [
    {
      title: 'Brand Strategy & Identity System',
      deliverables: [
        'Complete brand audit and competitive analysis',
        'Logo design direction and creative brief',
        'Brand voice guide and messaging framework',
        'Hashtag strategy and social media brand guidelines',
      ],
      differentiation:
        'Platforms offer color customization and theme selection. They don\'t offer strategic brand positioning, competitive analysis, or the thinking that connects visual identity to organizational goals.',
      priceRange: '$3,000 – $5,000',
    },
    {
      title: 'Content Strategy & Information Architecture',
      deliverables: [
        'Full content audit with prioritized action plan',
        'User journey mapping for each audience persona',
        'SEO keyword strategy',
        'Content calendar template for ongoing publishing',
        'AI-powered content generation system',
      ],
      differentiation:
        'Platforms provide the CMS. They don\'t audit content, map user journeys, or build an AI content pipeline.',
      priceRange: '$4,000 – $6,000',
    },
    {
      title: 'AI-Powered Automation & Engagement',
      deliverables: [
        'Automated onboarding workflows',
        'AI-powered impact reporting and communication',
        'Engagement automation: thank-you sequences, re-engagement campaigns',
        'Smart conversion optimization and A/B testing framework',
        'Integration architecture: CMS → CRM → email → social pipeline',
      ],
      differentiation:
        'Platforms are not CRMs — they say this themselves. They don\'t do workflow automation, AI content generation, or cross-platform integration.',
      priceRange: '$5,000 – $8,000',
    },
    {
      title: 'Social Media & Partnership Activation',
      deliverables: [
        'Influencer outreach strategy and templates',
        'Partnership pitch deck for aligned organizations',
        'LinkedIn strategy for leadership positioning',
        'AI-assisted monthly content packages',
      ],
      differentiation:
        'Platforms handle website content. Social media strategy, influencer partnerships, and AI content generation require specialized expertise.',
      priceRange: '$2,000 – $4,000',
    },
  ]

  // If specific services were selected, use them to enrich offerings
  if (services.length > 0) {
    for (const service of services.slice(0, 4)) {
      const existing = offerings.find(
        (o) => o.title.toLowerCase().includes(service.service_type)
      )
      if (existing) {
        existing.deliverables.push(service.title)
        if (service.price) {
          existing.priceRange = `${formatCurrency(service.price)} (${service.title})`
        }
      }
    }
  }

  return offerings
}
