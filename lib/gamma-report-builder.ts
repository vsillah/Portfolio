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
import { resolveGammaThemeIdForGeneration } from './gamma-theme-config'
import {
  type CalculationMethod,
  type ConfidenceLevel,
  CALCULATION_METHOD_LABELS,
  CONFIDENCE_LABELS,
  normalizeCompanySize,
} from './value-calculations'
import {
  PRICING_TIERS,
  COMMUNITY_IMPACT_TIERS,
  CONTINUITY_PLANS,
  COMPARISON_DATA,
  TIER_HORMOZI_SCORES,
  CI_TIER_HORMOZI_SCORES,
  calculateValueStack,
  formatCurrency as pricingFormatCurrency,
  type PricingTier,
  type GuaranteeDef,
} from './pricing-model'
import {
  COMMON_OBJECTIONS,
  STEP_TYPE_LABELS,
  OBJECTION_STRATEGY_MAP,
  OFFER_STRATEGY_LABELS,
  type StepType,
  type ObjectionHandler,
} from './sales-scripts'
import { expandBundleItems } from './bundle-expand'
import { CREATOR_BACKGROUND } from './constants/creator-background'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GammaReportType =
  | 'value_quantification'
  | 'implementation_strategy'
  | 'audit_summary'
  | 'prospect_overview'
  | 'offer_presentation'

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
  bundleId?: string
  pricingTierId?: string
  salesScriptId?: string
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
  /** Captured on the audit row (often set when contact.company is empty). */
  business_name?: string | null
  website_url?: string | null
  contact_email?: string | null
  industry_slug?: string | null
  responses_received?: Record<string, unknown> | null
  questions_by_category?: Record<string, unknown> | null
  enriched_tech_stack?: Record<string, unknown> | null
  value_estimate?: Record<string, unknown> | null
  sales_notes?: string | null
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
// Organization display name (contact + audit fallbacks)
// ---------------------------------------------------------------------------

function trimNonEmpty(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  return t.length > 0 ? t : null
}

function hostnameFromUrl(url: string | null | undefined): string | null {
  const raw = trimNonEmpty(url)
  if (!raw) return null
  try {
    const withProto = raw.includes('://') ? raw : `https://${raw}`
    const u = new URL(withProto)
    const host = u.hostname.replace(/^www\./i, '')
    return host.length > 0 ? host : null
  } catch {
    return null
  }
}

/**
 * Best label for the prospect's organization in Gamma titles and copy.
 * Prefer contact.company, then audit.business_name, then website host, then contact name.
 */
export function resolveOrganizationLabel(ctx: ReportContext): string {
  const contact = ctx.contact
  const audit = ctx.audit
  const fromContactCompany = trimNonEmpty(contact?.company)
  if (fromContactCompany) return fromContactCompany
  const fromAuditBusiness = trimNonEmpty(audit?.business_name)
  if (fromAuditBusiness) return fromAuditBusiness
  const fromWebsite = hostnameFromUrl(audit?.website_url)
  if (fromWebsite) return fromWebsite
  const fromContactName = trimNonEmpty(contact?.name)
  if (fromContactName) return fromContactName
  return 'the Organization'
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatQuestionsByCategory(raw: Record<string, unknown> | null | undefined): string | null {
  if (!raw || typeof raw !== 'object') return null
  const blocks: string[] = []
  for (const [cat, qs] of Object.entries(raw)) {
    if (!Array.isArray(qs) || qs.length === 0) continue
    const label = cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const lines = qs.filter((q): q is string => typeof q === 'string' && q.trim().length > 0).map((q) => `- ${q.trim()}`)
    if (lines.length === 0) continue
    blocks.push(`### ${label}\n${lines.join('\n')}`)
  }
  return blocks.length > 0 ? blocks.join('\n\n') : null
}

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
      return 17
    case 'implementation_strategy':
      return 20
    case 'audit_summary':
      return 11
    case 'prospect_overview':
      return 9
    case 'offer_presentation':
      return 16
    default:
      return 20
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
    case 'offer_presentation': {
      const offerCtx = await fetchOfferContext(params)
      ;({ inputText, title } = buildOfferPresentationPrompt(context, offerCtx, params))
      break
    }
    default:
      throw new Error(`Unknown report type: ${params.reportType}`)
  }

  const orgLabel = resolveOrganizationLabel(context)
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
      audience: `nonprofit and small business leadership, board members, and executive directors at ${orgLabel}`,
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

  options.themeId = await resolveGammaThemeIdForGeneration(params.theme)

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
            'id, business_challenges, tech_stack, automation_needs, ai_readiness, budget_timeline, decision_making, diagnostic_summary, key_insights, recommended_actions, urgency_score, opportunity_score, business_name, website_url, contact_email, industry_slug, responses_received, questions_by_category, enriched_tech_stack, value_estimate, sales_notes'
          )
          .eq('id', params.diagnosticAuditId)
          .single()
          .then((r: { data: AuditData | null }) => r.data)
      : Promise.resolve(null),

    (async (): Promise<ValueReportData | null> => {
      if (params.valueReportId) {
        const r = await supabaseAdmin
          .from('value_reports')
          .select(
            'id, title, report_type, industry, company_size_range, summary_markdown, value_statements, total_annual_value, evidence_chain'
          )
          .eq('id', params.valueReportId)
          .single()
        return (r.data as ValueReportData | null) ?? null
      }
      if (params.contactSubmissionId) {
        const r = await supabaseAdmin
          .from('value_reports')
          .select(
            'id, title, report_type, industry, company_size_range, summary_markdown, value_statements, total_annual_value, evidence_chain'
          )
          .eq('contact_submission_id', params.contactSubmissionId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return (r.data as ValueReportData | null) ?? null
      }
      return null
    })(),

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
    company: trimNonEmpty(ctx.contact?.company) ?? trimNonEmpty(ctx.audit?.business_name) ?? hostnameFromUrl(ctx.audit?.website_url) ?? trimNonEmpty(ctx.contact?.name) ?? null,
    industry: ctx.contact?.industry ?? ctx.valueReport?.industry ?? trimNonEmpty(ctx.audit?.industry_slug)?.replace(/_/g, ' ') ?? null,
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
  const resolvedTheme = await resolveGammaThemeIdForGeneration(params.theme)
  const gammaInput = await buildGammaReportInputFromContext(ctx, { ...params, theme: resolvedTheme })
  const videoScriptContext = reportContextToVideoScriptContext(ctx)
  return { gammaInput, videoScriptContext }
}

/**
 * Build Gamma report input from an already-fetched context (no extra fetch).
 */
async function buildGammaReportInputFromContext(
  ctx: ReportContext,
  params: GammaReportParams
): Promise<GammaReportInput> {
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
    case 'offer_presentation': {
      const offerCtx = await fetchOfferContext(params)
      ;({ inputText, title } = buildOfferPresentationPrompt(ctx, offerCtx, params))
      break
    }
    default:
      throw new Error(`Unknown report type: ${params.reportType}`)
  }

  const orgLabel = resolveOrganizationLabel(ctx)
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
      audience: `nonprofit and small business leadership, board members, and executive directors at ${orgLabel}`,
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

  options.themeId = params.theme || undefined

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
  const orgName = resolveOrganizationLabel(ctx)
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

  // --- Slide 1: Cover ---
  sections.push(buildCoverSlide(
    title,
    orgName,
    `Methodology: ATAS Value & Pricing Logic v1.0 | Segment: ${industry} | ${companySize} employees`
  ))

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

  // --- Bio slide ---
  sections.push(buildBioSlide())

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
  const orgName = resolveOrganizationLabel(ctx)
  const domain = params.externalInputs?.siteCrawlData ? 'Website UX Redesign' : 'Digital Strategy'
  const title = `${orgName} ${domain}: Implementation Strategy`
  const metrics = computeDerivedMetrics(ctx)

  const sections: string[] = []

  // --- Slide 1: Cover ---
  sections.push(buildCoverSlide(title, orgName, 'STRATEGIC ADVISORY'))

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

  // --- Bio slide ---
  sections.push(buildBioSlide())

  return { inputText: sections.join('\n---\n'), title }
}

// ---------------------------------------------------------------------------
// Template 3: Audit Summary (placeholder — future)
// ---------------------------------------------------------------------------

function buildAuditSummaryPrompt(
  ctx: ReportContext,
  params: GammaReportParams
): { inputText: string; title: string } {
  const orgName = resolveOrganizationLabel(ctx)
  const metrics = computeDerivedMetrics(ctx)
  const title = `${orgName} — Diagnostic Audit Summary`

  const sections: string[] = []

  sections.push(`# How to use this source material

**Client organization (use this exact name in titles and body text):** ${orgName}

- Base the deck on the **Prospect context** and **Diagnostic audit data** below. Do not replace this name with generic placeholders (e.g. "the organization", "the client").
- When a field was not recorded, say so briefly instead of inventing facts.
- Quote or paraphrase the structured responses; keep claims tied to what appears in the sections below.`)

  // --- Slide 1: Cover + scores ---
  const scoreSubtitle = [
    metrics.urgencyScore !== null ? `Urgency: ${metrics.urgencyScore}/10` : '',
    metrics.opportunityScore !== null ? `Opportunity: ${metrics.opportunityScore}/10` : '',
  ].filter(Boolean).join(' | ') || undefined
  sections.push(buildCoverSlide(title, orgName, scoreSubtitle))

  const contact = ctx.contact
  const audit = ctx.audit
  const prospectLines: string[] = [`- **Organization:** ${orgName}`]
  const cName = trimNonEmpty(contact?.name)
  if (cName) prospectLines.push(`- **Primary contact:** ${cName}`)
  const cEmail = trimNonEmpty(contact?.email)
  if (cEmail) prospectLines.push(`- **Email:** ${cEmail}`)
  const auditEmail = trimNonEmpty(audit?.contact_email)
  if (auditEmail && auditEmail !== cEmail) prospectLines.push(`- **Email (from audit):** ${auditEmail}`)
  const web = trimNonEmpty(audit?.website_url)
  if (web) prospectLines.push(`- **Website:** ${web}`)
  const indFromContact = trimNonEmpty(contact?.industry)
  const indFromAudit = trimNonEmpty(audit?.industry_slug)?.replace(/_/g, ' ')
  if (indFromContact) prospectLines.push(`- **Industry:** ${indFromContact}`)
  else if (indFromAudit) prospectLines.push(`- **Industry:** ${indFromAudit}`)
  const emp = trimNonEmpty(contact?.employee_count)
  if (emp) prospectLines.push(`- **Company size (contact record):** ${emp}`)
  sections.push(`# Prospect context\n\n${prospectLines.join('\n')}`)

  if (ctx.audit) {
    const ar = ctx.audit
    const qbc = formatQuestionsByCategory(ar.questions_by_category ?? null)
    if (qbc) {
      sections.push(`# Topics & questions captured\n\n${qbc}`)
    }

    const rr = ar.responses_received
    if (rr && typeof rr === 'object' && Object.keys(rr).length > 0) {
      sections.push(
        `# Conversation / progress responses\n\n${formatAuditSection(rr as Record<string, unknown>, 'No responses recorded.')}`
      )
    }

    if (ar.sales_notes && ar.sales_notes.trim()) {
      sections.push(`# Sales notes (internal context)\n\n${ar.sales_notes.trim()}`)
    }

    if (ar.enriched_tech_stack && typeof ar.enriched_tech_stack === 'object' && Object.keys(ar.enriched_tech_stack).length > 0) {
      sections.push(
        `# Enriched technology signals\n\n${formatAuditSection(ar.enriched_tech_stack as Record<string, unknown>, 'None.')}`
      )
    }

    if (ar.value_estimate && typeof ar.value_estimate === 'object' && Object.keys(ar.value_estimate).length > 0) {
      sections.push(
        `# Value estimate (from audit)\n\n${formatAuditSection(ar.value_estimate as Record<string, unknown>, 'None.')}`
      )
    }

    const categories: { key: keyof AuditData; label: string }[] = [
      { key: 'business_challenges', label: 'Business Challenges' },
      { key: 'tech_stack', label: 'Technology Stack' },
      { key: 'automation_needs', label: 'Automation Needs' },
      { key: 'ai_readiness', label: 'AI Readiness' },
      { key: 'budget_timeline', label: 'Budget & Timeline' },
      { key: 'decision_making', label: 'Decision Making' },
    ]

    for (const cat of categories) {
      const data = ar[cat.key]
      if (data && typeof data === 'object') {
        sections.push(`# ${cat.label}\n\n${formatAuditSection(data as Record<string, unknown>, 'No data recorded for this category.')}`)
      }
    }

    if (ar.diagnostic_summary) {
      sections.push(`# Summary\n\n${ar.diagnostic_summary}`)
    }
    if (ar.key_insights?.length) {
      sections.push(`# Key Insights\n\n${ar.key_insights.map((i: string) => `- ${i}`).join('\n')}`)
    }
    if (ar.recommended_actions?.length) {
      sections.push(`# Recommended Actions\n\n${ar.recommended_actions.map((a: string) => `- ${a}`).join('\n')}`)
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

  // --- Bio slide ---
  sections.push(buildBioSlide())

  return { inputText: sections.join('\n---\n'), title }
}

// ---------------------------------------------------------------------------
// Template 4: Prospect Overview (placeholder — future)
// ---------------------------------------------------------------------------

function buildProspectOverviewPrompt(
  ctx: ReportContext,
  params: GammaReportParams
): { inputText: string; title: string } {
  const orgName = resolveOrganizationLabel(ctx)
  const industry = ctx.contact?.industry || 'general'
  const metrics = computeDerivedMetrics(ctx)
  const title = `${orgName} — AI & Automation Opportunity Overview`

  const sections: string[] = []

  sections.push(buildCoverSlide(title, orgName))

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

  // --- Bio slide ---
  sections.push(buildBioSlide())

  return { inputText: sections.join('\n---\n'), title }
}

// ---------------------------------------------------------------------------
// Shared Slide Helpers — branded cover + bio across all report types
// ---------------------------------------------------------------------------

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://amadutown.com'
}

function buildCoverSlide(title: string, orgName: string, subtitle?: string): string {
  const siteUrl = getSiteUrl()
  const date = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const lines = [
    `# ${title}`,
    `## Prepared for ${orgName}`,
    '',
    `![AmaduTown Advisory Solutions](${siteUrl}/logo_hd.png)`,
    '',
  ]
  if (subtitle) lines.push(subtitle, '')
  lines.push(`Prepared by: Amadutown Advisory Solutions`, `Date: ${date}`)
  return lines.join('\n')
}

function buildBioSlide(): string {
  const siteUrl = getSiteUrl()
  const c = CREATOR_BACKGROUND
  return [
    `# Meet Your Advisor`,
    `## ${c.name} (${c.alias})`,
    '',
    `![${c.name}](${siteUrl}/Profile_Photo_1.jpg)`,
    '',
    `**${c.role}**`,
    '',
    `${c.mission}`,
    '',
    `${c.brand.tone}`,
    '',
    `*${c.brand.signOff}.*`,
    '',
    `amadutown.com`,
  ].join('\n')
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

// ---------------------------------------------------------------------------
// Offer Presentation — Types, Context Fetching, Presenter Notes, Prompt
// ---------------------------------------------------------------------------

interface OfferItemData {
  title: string
  description: string | null
  offer_role: string | null
  price: number
  perceived_value: number
  dream_outcome_description: string | null
  is_deployed?: boolean
  content_type?: string
}

interface OfferContext {
  bundleName: string
  bundleDescription: string | null
  items: OfferItemData[]
  totalRetailValue: number
  totalPerceivedValue: number
  offerPrice: number
  savings: number
  savingsPercent: number
  guarantee: GuaranteeDef | null
  hormoziScore: { dreamOutcome: number; likelihood: number; timeDelay: number; effortSacrifice: number; valueScore: number } | null
  tierSlug: string | null
  isDecoy: boolean
}

/**
 * Load offer context from either a DB bundle or a static pricing tier.
 * Bundle takes priority; falls back to pricingTierId.
 */
async function fetchOfferContext(params: GammaReportParams): Promise<OfferContext> {
  try {
    if (params.bundleId && supabaseAdmin) {
      return await fetchOfferContextFromBundle(params.bundleId)
    }
    if (params.pricingTierId) {
      return fetchOfferContextFromTier(params.pricingTierId)
    }
    throw new Error('offer_presentation requires either bundleId or pricingTierId')
  } catch (err) {
    if (err instanceof Error) throw err
    const msg = typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err)
    throw new Error(`fetchOfferContext failed: ${msg}`)
  }
}

async function fetchOfferContextFromBundle(bundleId: string): Promise<OfferContext> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin not available')

  const { data: bundle, error } = await supabaseAdmin
    .from('offer_bundles')
    .select('id, name, description, bundle_price, pricing_tier_slug')
    .eq('id', bundleId)
    .single()

  if (error || !bundle) {
    throw new Error(`Bundle ${bundleId} not found: ${error ? JSON.stringify(error) : 'no data'}`)
  }

  const expandedItems = await expandBundleItems(bundleId)

  const contentKeys = expandedItems.map((i) => `${i.content_type}:${i.content_id}`)
  const byType = new Map<string, string[]>()
  for (const item of expandedItems) {
    const ids = byType.get(item.content_type) ?? []
    ids.push(item.content_id)
    byType.set(item.content_type, ids)
  }

  const rolesByKey = new Map<string, Record<string, unknown>>()
  for (const [ct, ids] of byType.entries()) {
    const { data: roles } = await supabaseAdmin
      .from('content_offer_roles')
      .select('*')
      .eq('content_type', ct)
      .in('content_id', ids)
    for (const r of (roles ?? []) as Record<string, unknown>[]) {
      rolesByKey.set(`${ct}:${r.content_id}`, r)
    }
  }

  const contentByKey = new Map<string, Record<string, unknown>>()
  const TABLE_MAP: Record<string, string> = {
    product: 'products', project: 'projects', video: 'videos',
    publication: 'publications', music: 'music', lead_magnet: 'lead_magnets',
    prototype: 'app_prototypes', service: 'services',
  }
  for (const [ct, ids] of byType.entries()) {
    const table = TABLE_MAP[ct]
    if (!table) continue
    const { data: rows } = await supabaseAdmin.from(table).select('*').in('id', ids)
    for (const row of (rows ?? []) as Record<string, unknown>[]) {
      contentByKey.set(`${ct}:${row.id}`, row)
    }
  }

  const items: OfferItemData[] = []
  for (const bi of expandedItems) {
    const key = `${bi.content_type}:${bi.content_id}`
    const content = contentByKey.get(key)
    const role = rolesByKey.get(key)
    if (!content) continue
    items.push({
      title: bi.override_title ?? String(content.title ?? content.name ?? 'Untitled'),
      description: bi.override_description ?? (content.description != null ? String(content.description) : null),
      offer_role: bi.override_role ?? (role?.offer_role as string | null) ?? null,
      price: bi.override_price ?? (typeof role?.retail_price === 'number' ? role.retail_price as number : (typeof content.price === 'number' ? content.price as number : 0)),
      perceived_value: bi.override_perceived_value ?? (typeof role?.perceived_value === 'number' ? role.perceived_value as number : 0),
      dream_outcome_description: (role?.dream_outcome_description as string | null) ?? null,
      is_deployed: Boolean(content.is_deployed),
      content_type: bi.content_type,
    })
  }

  const totalRetailValue = items.reduce((s, i) => s + i.price, 0)
  const totalPerceivedValue = items.reduce((s, i) => s + (i.perceived_value || i.price), 0)
  const offerPrice = typeof bundle.bundle_price === 'number' ? bundle.bundle_price : totalRetailValue
  const savings = totalPerceivedValue - offerPrice
  const savingsPercent = totalPerceivedValue > 0 ? Math.round((savings / totalPerceivedValue) * 100) : 0

  const tierSlug = bundle.pricing_tier_slug as string | null
  const allTiers = [...PRICING_TIERS, ...COMMUNITY_IMPACT_TIERS]
  const matchedTier = tierSlug ? allTiers.find((t) => t.id === tierSlug) : null
  const guarantee = matchedTier?.guarantee ?? null
  const allScores = { ...TIER_HORMOZI_SCORES, ...CI_TIER_HORMOZI_SCORES }
  const hormoziScore = tierSlug && allScores[tierSlug] ? allScores[tierSlug] : null

  return {
    bundleName: bundle.name as string,
    bundleDescription: bundle.description as string | null,
    items,
    totalRetailValue,
    totalPerceivedValue,
    offerPrice,
    savings,
    savingsPercent,
    guarantee,
    hormoziScore,
    tierSlug,
    isDecoy: matchedTier?.isDecoy ?? false,
  }
}

function fetchOfferContextFromTier(tierId: string): OfferContext {
  const allTiers = [...PRICING_TIERS, ...COMMUNITY_IMPACT_TIERS]
  const tier = allTiers.find((t) => t.id === tierId)
  if (!tier) throw new Error(`Pricing tier ${tierId} not found`)

  const stack = calculateValueStack(tier)
  const allScores = { ...TIER_HORMOZI_SCORES, ...CI_TIER_HORMOZI_SCORES }
  const hormoziScore = allScores[tierId] ?? null

  return {
    bundleName: tier.name,
    bundleDescription: tier.tagline,
    items: tier.items.map((i) => ({
      title: i.title,
      description: i.description,
      offer_role: i.offerRole,
      price: i.perceivedValue,
      perceived_value: i.perceivedValue,
      dream_outcome_description: null,
      is_deployed: i.isDeployed,
    })),
    totalRetailValue: stack.totalRetailValue,
    totalPerceivedValue: stack.totalRetailValue,
    offerPrice: stack.bundlePrice,
    savings: stack.totalSavings,
    savingsPercent: stack.savingsPercent,
    guarantee: tier.guarantee,
    hormoziScore,
    tierSlug: tier.id,
    isDecoy: tier.isDecoy ?? false,
  }
}

// ---------------------------------------------------------------------------
// Presenter Notes — private talking points + objection handlers per slide
// ---------------------------------------------------------------------------

interface PresenterNote {
  talkingPoints: string[]
  objectionHandlers: { trigger: string; response: string }[]
  decisionCues: string[]
}

const STEP_PRESENTER_NOTES: Record<StepType, { defaultTalkingPoints: string[]; likelyObjections: string[] }> = {
  opening: {
    defaultTalkingPoints: [
      'Build rapport — reference something specific about their organization',
      'State the purpose: "walk you through what we can do together based on what we\'ve learned"',
      'Set expectations for the conversation length and next steps',
    ],
    likelyObjections: [],
  },
  discovery: {
    defaultTalkingPoints: [
      'Confirm the pain points from the audit: "We identified X areas where you\'re leaving value on the table"',
      'Ask: "Which of these resonates most with your day-to-day?"',
      'Quantify: reference specific dollar figures from the value assessment',
    ],
    likelyObjections: ['feature_concern'],
  },
  presentation: {
    defaultTalkingPoints: [
      'Present each core offer in terms of the outcome it delivers, not just what it is',
      'For deployed tools: "This is already built and running — not a promise, a product"',
      'Connect each item to a specific pain point from discovery',
    ],
    likelyObjections: ['feature_concern', 'price_objection'],
  },
  value_stack: {
    defaultTalkingPoints: [
      'Walk through the value stack: "If you bought each of these individually, the total would be $X"',
      '"But as a package, your investment is only $Y — that\'s Z% savings"',
      'Pause after stating the price. Let the value sink in.',
    ],
    likelyObjections: ['price_objection'],
  },
  social_proof: {
    defaultTalkingPoints: [
      'Share a specific result: "We worked with a similar organization and they saw X within Y months"',
      'Reference the comparison table: "Unlike typical agencies, we deploy actual tools, not just strategy docs"',
    ],
    likelyObjections: ['past_failure', 'competitor'],
  },
  risk_reversal: {
    defaultTalkingPoints: [
      'State the guarantee clearly: "If you don\'t see [outcome] within [timeframe], here\'s what happens"',
      'Emphasize: "We take on the risk so you don\'t have to"',
      'If conditional: explain the conditions are reasonable and designed for mutual success',
    ],
    likelyObjections: ['past_failure'],
  },
  pricing: {
    defaultTalkingPoints: [
      'Present the investment as a fraction of the annual value: "$X investment against $Y annual value"',
      'ROI framing: "For every dollar invested, you get $Z back in year one"',
      'If payment plans available, present them after the full price',
    ],
    likelyObjections: ['price_objection', 'budget_constrained_nonprofit'],
  },
  close: {
    defaultTalkingPoints: [
      'Direct ask: "Based on everything we\'ve discussed, are you ready to move forward?"',
      'If positive: "Great — I\'ll send the proposal with the access code right after this call"',
      'If neutral: "What would need to be true for this to be a yes?"',
    ],
    likelyObjections: ['timing_objection', 'authority_objection'],
  },
  followup: {
    defaultTalkingPoints: [
      'Schedule specific next step: "Let\'s put 30 minutes on the calendar for [date]"',
      'Summarize what you agreed on and what the client should expect',
      'Send the proposal link within the hour',
    ],
    likelyObjections: [],
  },
  objection_handle: {
    defaultTalkingPoints: [
      'Acknowledge the concern before responding',
      'Use the specific objection handler for their type of concern',
      'Redirect to value: "Let me show you why this is worth the investment"',
    ],
    likelyObjections: [],
  },
}

function buildPresenterNotesForStep(stepType: StepType): PresenterNote {
  const config = STEP_PRESENTER_NOTES[stepType]
  const handlers: { trigger: string; response: string }[] = []
  for (const objType of config.likelyObjections) {
    const matched = COMMON_OBJECTIONS.filter(
      (h) => h.category === objType || h.trigger.toLowerCase().includes(objType)
    )
    for (const m of matched) {
      handlers.push({ trigger: m.trigger, response: m.response })
    }
  }

  const strategies = OBJECTION_STRATEGY_MAP[config.likelyObjections[0] as keyof typeof OBJECTION_STRATEGY_MAP]
  const decisionCues: string[] = []
  if (strategies) {
    decisionCues.push(
      `If client objects: consider ${strategies.slice(0, 2).map((s) => OFFER_STRATEGY_LABELS[s]).join(' or ')}`
    )
  }
  decisionCues.push(`If positive: advance to next slide`)

  return {
    talkingPoints: config.defaultTalkingPoints,
    objectionHandlers: handlers,
    decisionCues,
  }
}

function formatPresenterNote(note: PresenterNote): string {
  const lines: string[] = ['[PRESENTER NOTE — visible in presenter view only]']
  if (note.talkingPoints.length > 0) {
    lines.push('Talking points:')
    for (const tp of note.talkingPoints) lines.push(`  • ${tp}`)
  }
  if (note.objectionHandlers.length > 0) {
    lines.push('If they object:')
    for (const oh of note.objectionHandlers) {
      lines.push(`  • "${oh.trigger}" → ${oh.response.substring(0, 200)}`)
    }
  }
  if (note.decisionCues.length > 0) {
    lines.push('Decision cues:')
    for (const dc of note.decisionCues) lines.push(`  • ${dc}`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Template 5: Offer Presentation — sales-flow-aligned deck
// ---------------------------------------------------------------------------

function buildOfferPresentationPrompt(
  ctx: ReportContext,
  offerCtx: OfferContext,
  params: GammaReportParams
): { inputText: string; title: string } {
  const orgName = resolveOrganizationLabel(ctx)
  const metrics = computeDerivedMetrics(ctx)
  const title = `${offerCtx.bundleName} — Prepared for ${orgName}`

  const coreOffers = offerCtx.items.filter((i) => i.offer_role === 'core_offer')
  const bonuses = offerCtx.items.filter((i) => i.offer_role === 'bonus')
  const deployedTools = offerCtx.items.filter((i) => i.is_deployed)

  const sections: string[] = []

  // --- Meta instruction ---
  sections.push(`# How to use this source material

**Client organization:** ${orgName}
**Package:** ${offerCtx.bundleName}

- This deck is designed to be presented live during a sales conversation. Each slide maps to a stage in the sales flow.
- [PRESENTER NOTE] blocks contain private talking points visible only in Gamma's presenter view.
- Keep the client-facing content concise and visual. The detail lives in the presenter notes.`)

  // --- Slide 1: Cover (opening) ---
  const openingNotes = buildPresenterNotesForStep('opening')
  sections.push(buildCoverSlide(
    offerCtx.bundleName,
    orgName,
    offerCtx.bundleDescription || 'A tailored package designed to accelerate your digital transformation with AI and automation.'
  ) + `\n\n${formatPresenterNote(openingNotes)}`)

  // --- Slide 2: About ATAS (opening) ---
  sections.push(`# About Amadutown Advisory Solutions

**Mission:** Technology as the great equalizer for minority-owned businesses and nonprofits.

**What Makes Us Different:**
- Every tool we recommend is one we use ourselves — no theoretical advice
- Product management roots: user journeys, conversion funnels, measurable outcomes
- AI & nonprofit specialization with deployed, running tools
- Strategy-first mindset: we solve the right problem before building

${formatComparisonHighlights()}

${formatPresenterNote(openingNotes)}`)

  // --- Slide 3: Their Situation (discovery) ---
  const discoveryNotes = buildPresenterNotesForStep('discovery')
  if (ctx.audit || metrics.totalAnnualValue) {
    let situationSlide = `# Your Current Situation\n## What We Found\n\n`
    if (ctx.audit?.diagnostic_summary) {
      situationSlide += `${ctx.audit.diagnostic_summary}\n\n`
    }
    if (metrics.urgencyScore !== null || metrics.opportunityScore !== null) {
      if (metrics.urgencyScore !== null) situationSlide += `**Urgency Score:** ${metrics.urgencyScore}/10 | `
      if (metrics.opportunityScore !== null) situationSlide += `**Opportunity Score:** ${metrics.opportunityScore}/10\n\n`
    }
    if (ctx.audit?.key_insights?.length) {
      situationSlide += `**Key Findings:**\n`
      for (const insight of ctx.audit.key_insights.slice(0, 4)) {
        situationSlide += `- ${insight}\n`
      }
    }
    situationSlide += `\n${formatPresenterNote(discoveryNotes)}`
    sections.push(situationSlide)
  }

  // --- Slide 4: Cost of Inaction (discovery) ---
  if (metrics.totalAnnualValue && metrics.totalAnnualValue > 0) {
    let costSlide = `# The Cost of Standing Still\n## What Inaction Costs ${orgName} Every Year\n\n`
    costSlide += `**${formatCurrency(metrics.totalAnnualValue)}** in annual value at stake across ${metrics.topPainPoints.length} identified areas.\n\n`
    if (metrics.topPainPoints.length > 0) {
      costSlide += `| Opportunity | Annual Value |\n|-----------|-------------|\n`
      for (const pp of metrics.topPainPoints.slice(0, 5)) {
        costSlide += `| ${pp.painPoint} | ${formatCurrency(pp.annualValue)} |\n`
      }
    }
    costSlide += `\n${formatPresenterNote(discoveryNotes)}`
    sections.push(costSlide)
  }

  // --- Slide 5: Core Offer (presentation) ---
  const presentationNotes = buildPresenterNotesForStep('presentation')
  if (coreOffers.length > 0) {
    let coreSlide = `# What We'll Build For You\n## Core Deliverables\n\n`
    for (const item of coreOffers) {
      coreSlide += `### ${item.title}\n`
      if (item.description) coreSlide += `${item.description}\n`
      if (item.dream_outcome_description) coreSlide += `**Dream outcome:** ${item.dream_outcome_description}\n`
      if (item.perceived_value > 0) coreSlide += `*Value: ${formatCurrency(item.perceived_value)}*\n`
      coreSlide += `\n`
    }
    coreSlide += formatPresenterNote(presentationNotes)
    sections.push(coreSlide)
  }

  // --- Slide 6: Bonuses (presentation) ---
  if (bonuses.length > 0) {
    let bonusSlide = `# Included Bonuses\n## Extra Value at No Additional Cost\n\n`
    for (const item of bonuses) {
      bonusSlide += `- **${item.title}** — ${item.description || 'Included with your package'}`
      if (item.perceived_value > 0) bonusSlide += ` *(${formatCurrency(item.perceived_value)} value)*`
      bonusSlide += `\n`
    }
    bonusSlide += `\n${formatPresenterNote(presentationNotes)}`
    sections.push(bonusSlide)
  }

  // --- Slide 7: Deployed Tools (presentation) ---
  if (deployedTools.length > 0) {
    let toolSlide = `# Deployed AI Tools\n## Already Built, Already Running\n\n`
    toolSlide += `These aren't promises — they're production tools that are live today:\n\n`
    for (const item of deployedTools) {
      toolSlide += `- **${item.title}** — ${item.description || 'Live and deployed'}\n`
    }
    toolSlide += `\nEvery tool is built on the same infrastructure we use ourselves. No vaporware.\n`
    toolSlide += `\n${formatPresenterNote(presentationNotes)}`
    sections.push(toolSlide)
  }

  // --- Slide 8: Value Stack (value_stack) ---
  const valueStackNotes = buildPresenterNotesForStep('value_stack')
  let stackSlide = `# The Value Stack\n## What You Get vs. What You Pay\n\n`
  stackSlide += `| Component | Retail Value |\n|-----------|-------------|\n`
  for (const item of offerCtx.items.slice(0, 10)) {
    stackSlide += `| ${item.title} | ${formatCurrency(item.perceived_value || item.price)} |\n`
  }
  stackSlide += `| **Total Retail Value** | **${formatCurrency(offerCtx.totalPerceivedValue)}** |\n`
  stackSlide += `| **Your Investment** | **${formatCurrency(offerCtx.offerPrice)}** |\n`
  stackSlide += `| **You Save** | **${formatCurrency(offerCtx.savings)} (${offerCtx.savingsPercent}%)** |\n`
  stackSlide += `\n${formatPresenterNote(valueStackNotes)}`
  sections.push(stackSlide)

  // --- Slide 9: Social Proof (social_proof) ---
  const socialProofNotes = buildPresenterNotesForStep('social_proof')
  let proofSlide = `# Why Organizations Trust ATAS\n\n`
  proofSlide += `**What typical agencies deliver vs. what ATAS delivers:**\n\n`
  proofSlide += `| Capability | Typical Agency | ATAS |\n|-----------|---------------|------|\n`
  for (const row of COMPARISON_DATA.slice(0, 8)) {
    const agencyVal = typeof row.typicalAgency === 'boolean' ? (row.typicalAgency ? 'Yes' : 'No') : row.typicalAgency
    const atasVal = typeof row.amadutown === 'boolean' ? (row.amadutown ? 'Yes' : 'No') : row.amadutown
    proofSlide += `| ${row.capability} | ${agencyVal} | ${atasVal} |\n`
  }
  proofSlide += `\n${formatPresenterNote(socialProofNotes)}`
  sections.push(proofSlide)

  // --- Slide 10: Guarantee (risk_reversal) ---
  const riskNotes = buildPresenterNotesForStep('risk_reversal')
  if (offerCtx.guarantee) {
    const g = offerCtx.guarantee
    let guaranteeSlide = `# Our Guarantee\n## ${g.name}\n\n`
    guaranteeSlide += `**Type:** ${g.type === 'unconditional' ? 'Unconditional — no questions asked' : 'Conditional — tied to specific outcomes'}\n\n`
    guaranteeSlide += `**${g.description}**\n\n`
    guaranteeSlide += `- **Duration:** ${g.durationDays} days\n`
    guaranteeSlide += `- **If we don't deliver:** ${g.payoutType === 'refund' ? 'Full refund' : g.payoutType === 'credit' ? 'Credit toward future work' : 'We continue working at no additional cost'}\n`
    guaranteeSlide += `\nWe take on the risk so you don't have to.\n`
    guaranteeSlide += `\n${formatPresenterNote(riskNotes)}`
    sections.push(guaranteeSlide)
  } else {
    sections.push(`# Risk-Free Engagement\n\nWe stand behind our work. If you're not satisfied with the results, we'll work with you until you are.\n\n${formatPresenterNote(riskNotes)}`)
  }

  // --- Slide 11: Investment (pricing) ---
  const pricingNotes = buildPresenterNotesForStep('pricing')
  let investSlide = `# Your Investment\n\n`
  investSlide += `| | Amount |\n|---|---|\n`
  investSlide += `| Package Value | ${formatCurrency(offerCtx.totalPerceivedValue)} |\n`
  investSlide += `| **Your Price** | **${formatCurrency(offerCtx.offerPrice)}** |\n`
  investSlide += `| Savings | ${formatCurrency(offerCtx.savings)} (${offerCtx.savingsPercent}% off) |\n`
  if (metrics.totalAnnualValue && metrics.totalAnnualValue > 0) {
    investSlide += `\n**Against ${formatCurrency(metrics.totalAnnualValue)} in annual value at stake, this is a ${metrics.roi !== null ? `${metrics.roi}% ROI` : 'strong'} investment.**\n`
  }
  if (offerCtx.hormoziScore) {
    investSlide += `\n**Value Equation Score:** ${offerCtx.hormoziScore.valueScore} (Dream Outcome: ${offerCtx.hormoziScore.dreamOutcome}/10, Likelihood: ${offerCtx.hormoziScore.likelihood}/10)\n`
  }
  investSlide += `\n${formatPresenterNote(pricingNotes)}`
  sections.push(investSlide)

  // --- Slide 12: ROI Breakdown (pricing) ---
  if (metrics.totalAnnualValue && metrics.totalAnnualValue > 0) {
    let roiSlide = `# Return on Investment\n## The Numbers Speak for Themselves\n\n`
    roiSlide += `- **Annual Value at Stake:** ${formatCurrency(metrics.totalAnnualValue)}\n`
    roiSlide += `- **Your Investment:** ${formatCurrency(offerCtx.offerPrice)}\n`
    if (metrics.roi !== null) roiSlide += `- **First-Year ROI:** ${metrics.roi}%\n`
    if (metrics.paybackMonths !== null) roiSlide += `- **Payback Period:** ${metrics.paybackMonths} months\n`
    const yr2 = Math.round(metrics.totalAnnualValue * 1.2)
    const yr3 = Math.round(metrics.totalAnnualValue * 1.44)
    roiSlide += `\n**3-Year Projection:**\n`
    roiSlide += `- Year 1: ${formatCurrency(metrics.totalAnnualValue)}\n`
    roiSlide += `- Year 2: ${formatCurrency(yr2)} (20% growth)\n`
    roiSlide += `- Year 3: ${formatCurrency(yr3)} (20% growth)\n`
    roiSlide += `- **3-Year Total: ${formatCurrency(metrics.totalAnnualValue + yr2 + yr3)}**\n`
    roiSlide += `\n${formatPresenterNote(pricingNotes)}`
    sections.push(roiSlide)
  }

  // --- Slide 13: Implementation Timeline ---
  let timelineSlide = `# Implementation Timeline\n## Phased Delivery for Early Wins\n\n`
  timelineSlide += `**Phase 1 — Foundation (Weeks 1–4)**\n`
  timelineSlide += `Strategy alignment, audit deep-dive, tool configuration, and quick wins.\n\n`
  timelineSlide += `**Phase 2 — Build (Weeks 4–8)**\n`
  timelineSlide += `Core tool deployment, automation setup, content systems, and initial results.\n\n`
  timelineSlide += `**Phase 3 — Scale (Weeks 8–12)**\n`
  timelineSlide += `Optimization, team training, handoff, and ongoing support setup.\n\n`
  timelineSlide += `Each phase delivers measurable results. You don't wait 12 weeks to see impact — wins start in Phase 1.`
  sections.push(timelineSlide)

  // --- Slide 14: Continuity Options ---
  if (CONTINUITY_PLANS.length > 0) {
    let contSlide = `# Ongoing Support Options\n## Stay Connected After Launch\n\n`
    for (const plan of CONTINUITY_PLANS.slice(0, 3)) {
      contSlide += `### ${plan.name} — ${pricingFormatCurrency(plan.pricePerMonth)}/month\n`
      contSlide += `${plan.description}\n`
      for (const feature of plan.features.slice(0, 3)) {
        contSlide += `- ${feature}\n`
      }
      contSlide += `\n`
    }
    contSlide += `These are optional — choose the level of ongoing support that matches your needs.`
    sections.push(contSlide)
  }

  // --- Slide 15: Next Steps (close / followup) ---
  const closeNotes = buildPresenterNotesForStep('close')
  let nextSlide = `# Next Steps\n## Let's Move Forward\n\n`
  nextSlide += `1. **Align on priorities** — Confirm which components matter most to your team\n`
  nextSlide += `2. **Review the proposal** — We'll send a detailed proposal with everything discussed today\n`
  nextSlide += `3. **Sign and schedule** — Accept the proposal and we'll kick off Phase 1 within one week\n\n`
  nextSlide += `**Ready to start?** Let's align on next steps right now.\n\n`
  nextSlide += `Amadutown Advisory Solutions\namadutown.com\n`
  nextSlide += `\n${formatPresenterNote(closeNotes)}`
  sections.push(nextSlide)

  // --- Bio slide ---
  sections.push(buildBioSlide())

  return { inputText: sections.join('\n---\n'), title }
}

function formatComparisonHighlights(): string {
  const highlights = COMPARISON_DATA.filter(
    (row) => row.amadutown === true || (typeof row.amadutown === 'string' && row.amadutown !== 'No')
  ).slice(0, 5)
  if (highlights.length === 0) return ''
  return `**Our capabilities:**\n` + highlights.map((h) => `- ${h.capability}: ${typeof h.amadutown === 'boolean' ? 'Yes' : h.amadutown}`).join('\n')
}
