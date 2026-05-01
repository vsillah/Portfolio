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
import { GAMMA_MAX_ADDITIONAL_INSTRUCTIONS, type GammaGenerateOptions } from './gamma-client'
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
import {
  FEASIBILITY_ASSESSMENT_ENABLED,
  extractClientStackSources,
  loadBundleProposedItems,
} from './feasibility-snapshot'
import { CREATOR_BACKGROUND } from './constants/creator-background'
import { fetchMeetingsForAudit, type MeetingForAudit } from './audit-from-meetings'
import {
  buildEvidenceIndex,
  buildEvidenceLedgerSlide,
  buildSourceFidelityPreamble,
  citationTag,
  firstOfKind,
  itemsForAuditCategory,
  itemsForPainPoint,
  type EvidenceItem,
} from './gamma-evidence-index'
import {
  buildFeasibilityAssessment,
  type FeasibilityAssessment,
} from './implementation-feasibility'
import {
  buildAiLayerFitEvaluation,
  type AiLayerFitEvaluation,
} from './ai-layer-fit-evaluation'
import {
  defaultCalendlyEventForReportType,
  resolveCalendlyEvent,
  type CalendlyEventKey,
  type CalendlyEventMeta,
} from './calendly-events'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GammaReportType =
  | 'value_quantification'
  | 'implementation_strategy'
  | 'audit_summary'
  | 'prospect_overview'
  | 'offer_presentation'

export interface MeetingVerbatim {
  /** Stable id for dedupe — usually `${meetingId}:${index}`. */
  id: string
  /** Verbatim quote text (already trimmed for length by the picker). */
  verbatim: string
  /** Display label, e.g. "Discovery call". */
  sourceLabel: string
  /** Optional ISO date label (YYYY-MM-DD). */
  dateLabel?: string
}

export interface ExternalInputs {
  thirdPartyFindings?: string
  competitorPlatform?: string
  siteCrawlData?: string
  customInstructions?: string
  /** Admin-picked meeting quotes to thread into the prompt and Evidence Ledger. */
  meetingVerbatims?: MeetingVerbatim[]
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
  /**
   * Admin override for the Calendly event booked from the `Let's Talk` CTA
   * slide. When omitted, each report type falls back to the default event
   * in `lib/calendly-events.ts` (`defaultCalendlyEventForReportType`).
   */
  calendlyEventKey?: CalendlyEventKey
}

export interface GammaReportInput {
  inputText: string
  options: GammaGenerateOptions
  title: string
  /** Canonical evidence index (with counts + timestamp) used to back the deck. */
  citationsMeta: {
    items: EvidenceItem[]
    counts: Record<string, number>
    generatedAt: string
  }
  /**
   * Stack-aware feasibility snapshot when bundleId is present and the feature
   * flag is enabled. Included so the caller can persist it alongside
   * gamma_reports.feasibility_assessment.
   */
  feasibilityAssessment?: FeasibilityAssessment | null
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
  meetings: MeetingForAudit[]
  painPointEvidence: PainPointEvidenceData[]
}

interface ContactData {
  id: number
  name: string
  email: string
  company: string
  industry: string
  employee_count: string
  phone?: string
  website_tech_stack?: Record<string, unknown> | null
  client_verified_tech_stack?: Record<string, unknown> | null
}

interface PainPointEvidenceData {
  id: string
  excerpt: string
  sourceType: string
  categoryId: string
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

/** Slide counts aligned with Admin → Gamma report type cards (passed to Gamma API as numCards).
 *
 * Recent `Let's Talk` rollout:
 *  - audit_summary, prospect_overview: replaced bare `Next Steps` one-liner with
 *    `Let's Talk` in-place — count unchanged.
 *  - value_quantification: replaced the bare `Ready to Align on Priorities?`
 *    CTA slide with `Let's Talk`; kept the process-oriented `Turning Data Into
 *    Action: A Phased Roadmap` slide — count unchanged.
 *  - implementation_strategy, offer_presentation: kept the rich process Next
 *    Steps slide AND added `Let's Talk` as a second, CTA-focused slide — count
 *    bumped by +1.
 */
function numCardsForGammaReportType(reportType: GammaReportType): number {
  switch (reportType) {
    case 'value_quantification':
      return 17
    case 'implementation_strategy':
      return 23
    case 'audit_summary':
      return 11
    case 'prospect_overview':
      return 9
    case 'offer_presentation':
      return 17
    default:
      return 20
  }
}

// ---------------------------------------------------------------------------
// Evidence index — bridges ReportContext + ExternalInputs to the evidence module
// ---------------------------------------------------------------------------

/**
 * Build the deterministic evidence index for a report context. Per-template
 * builders call this once and weave the resulting `[E#]` tags into the prompt.
 */
export function buildEvidenceForReport(
  ctx: ReportContext,
  externalInputs?: ExternalInputs
): EvidenceItem[] {
  return buildEvidenceIndex({
    audit: ctx.audit,
    contactWebsiteTechStack: ctx.contact?.website_tech_stack ?? null,
    valueStatements: ctx.valueReport?.value_statements,
    benchmarks: ctx.benchmarks,
    meetings: ctx.meetings,
    painPointEvidence: ctx.painPointEvidence,
    pickedMeetingVerbatims: externalInputs?.meetingVerbatims,
  })
}

// ---------------------------------------------------------------------------
// Feasibility loading helpers (thin wrapper around ./feasibility-snapshot)
// ---------------------------------------------------------------------------

/**
 * Build the feasibility assessment for a report, or return null when the
 * feature is disabled, no bundle is in scope, or the report type doesn't
 * use it. Implementation strategy + offer presentation are the v1 targets.
 */
async function maybeBuildFeasibility(
  ctx: ReportContext,
  params: GammaReportParams
): Promise<FeasibilityAssessment | null> {
  if (!FEASIBILITY_ASSESSMENT_ENABLED) return null
  if (params.reportType !== 'implementation_strategy' && params.reportType !== 'offer_presentation') {
    return null
  }
  if (!params.bundleId) return null

  const [proposedItems, bundleRow] = await Promise.all([
    loadBundleProposedItems(params.bundleId),
    supabaseAdmin
      ? supabaseAdmin
          .from('offer_bundles')
          .select('id, name')
          .eq('id', params.bundleId)
          .single()
          .then((r: { data: { id: string; name: string } | null }) => r.data)
      : Promise.resolve(null),
  ])

  const { sources, creditsRemaining } = extractClientStackSources({
    contactWebsiteTechStack: ctx.contact?.website_tech_stack ?? null,
    contactVerifiedTechStack: ctx.contact?.client_verified_tech_stack ?? null,
    auditEnrichedTechStack: ctx.audit?.enriched_tech_stack ?? null,
  })

  return buildFeasibilityAssessment({
    proposedItems,
    bundle: { id: bundleRow?.id ?? params.bundleId, name: bundleRow?.name ?? null },
    clientStack: sources,
    builtwithCreditsRemaining: creditsRemaining,
  })
}

function collectWorkflowSignals(ctx: ReportContext): string[] {
  const signals: string[] = []
  const audit = ctx.audit
  if (!audit) return signals

  const fields: Array<Record<string, unknown> | null | undefined> = [
    audit.business_challenges,
    audit.tech_stack,
    audit.automation_needs,
    audit.ai_readiness,
    audit.decision_making,
  ]

  for (const field of fields) {
    if (!field || typeof field !== 'object') continue
    for (const [key, value] of Object.entries(field)) {
      signals.push(key)
      if (typeof value === 'string') signals.push(value)
      else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') signals.push(item)
        }
      } else if (value && typeof value === 'object') {
        for (const nested of Object.values(value as Record<string, unknown>)) {
          if (typeof nested === 'string') signals.push(nested)
          else if (Array.isArray(nested)) {
            for (const item of nested) {
              if (typeof item === 'string') signals.push(item)
            }
          }
        }
      }
    }
  }

  if (audit.diagnostic_summary) signals.push(audit.diagnostic_summary)
  for (const insight of audit.key_insights ?? []) signals.push(insight)
  for (const action of audit.recommended_actions ?? []) signals.push(action)
  return signals
}

function buildAiLayerFitForContext(ctx: ReportContext): AiLayerFitEvaluation {
  const { sources } = extractClientStackSources({
    contactWebsiteTechStack: ctx.contact?.website_tech_stack ?? null,
    contactVerifiedTechStack: ctx.contact?.client_verified_tech_stack ?? null,
    auditEnrichedTechStack: ctx.audit?.enriched_tech_stack ?? null,
  })

  return buildAiLayerFitEvaluation({
    clientStack: sources,
    workflowSignals: collectWorkflowSignals(ctx),
    dataSensitivity: ['client data', 'workflow data', 'permission boundaries'],
    governanceNotes: ['human approval', 'review before external use'],
  })
}

function buildAiLayerFitSlides(
  evaluation: AiLayerFitEvaluation,
  orgName: string
): string {
  const scoreRows = evaluation.scores
    .map((s) => `| ${s.label} | ${s.score}/5 | ${Math.round(s.weight * 100)}% | ${s.weightedScore.toFixed(2)} | ${s.evidence} |`)
    .join('\n')

  const candidateRows = evaluation.candidate_layers
    .map((c) => `| ${c.label} | ${c.fitHypothesis} |`)
    .join('\n')

  const detectedStack = evaluation.detected_stack.length > 0
    ? evaluation.detected_stack.slice(0, 10).join(', ')
    : 'No verified stack technologies captured yet.'

  const openQuestions = evaluation.open_questions.length > 0
    ? evaluation.open_questions.map((q) => `- ${q}`).join('\n')
    : '- No open questions captured for this evaluation.'

  const scoreSlide = `
# AI Layer-Fit Strategy
## Which AI Layer Fits ${orgName}'s Current Operating Stack?

This assessment evaluates AI tools as layers inside the current operating system: tools, data, permissions, workflows, team habits, and implementation capacity.

**Recommended layer:** ${evaluation.recommended_layer_label}  
**Decision:** ${evaluation.decision_label}  
**Weighted score:** ${evaluation.weighted_total.toFixed(2)}/5  
**Client stack source:** ${evaluation.client_stack_source}

Detected stack signals: ${detectedStack}

| Dimension | Score | Weight | Weighted | Evidence |
|-----------|------:|-------:|---------:|----------|
${scoreRows}
`

  const routingSlide = `
# AI Tool Routing
## Match The Shape Of The Work To The Shape Of The Tool

${evaluation.routing_summary}

| Candidate layer | Fit hypothesis |
|-----------------|----------------|
${candidateRows}

**Pilot recommendation:** ${evaluation.pilot_recommendation}

**Open questions before rollout:**
${openQuestions}
`

  const structured = `
[STRUCTURED AI LAYER-FIT EVALUATION — use verbatim, do not infer additional findings]

\`\`\`json
${JSON.stringify(evaluation, null, 2)}
\`\`\`
`

  return [scoreSlide, routingSlide, structured].join('\n---\n')
}

/**
 * Render the three feasibility slides (Stack Fit, Effort & Complexity,
 * Tradeoff Decisions) and an anti-fabrication fenced JSON block with the
 * full assessment so Gamma uses the structured data verbatim.
 */
function buildFeasibilitySlides(
  assessment: FeasibilityAssessment,
  orgName: string
): string {
  const { items, open_tradeoffs, stack_fit_summary, overall_feasibility, estimated_complexity } = assessment

  const fitRows = items
    .map((it) => {
      const matches = it.fit.filter((f) => f.kind === 'match').map((f) => `${f.our}`).join(', ')
      const integrations = it.fit.filter((f) => f.kind === 'integrate').map((f) => `${f.our} \u2194 ${f.client ?? '?'}`).join(', ')
      const gaps = it.fit.filter((f) => f.kind === 'gap').map((f) => f.our).join(', ')
      const replaces = it.fit.filter((f) => f.kind === 'replace').map((f) => `${f.our} vs ${f.client ?? '?'}`).join(', ')
      return `| ${it.title} | ${matches || '\u2014'} | ${integrations || '\u2014'} | ${gaps || '\u2014'} | ${replaces || '\u2014'} |`
    })
    .join('\n')

  const stackFitSlide = `
# Stack Fit Assessment
## How ${orgName}'s Current Tools Line Up With This Package

${stack_fit_summary}

| Deliverable | Already Have | We Integrate | We Set Up | Replace Decision |
|-------------|--------------|--------------|-----------|------------------|
${fitRows || '| (no proposed items) | \u2014 | \u2014 | \u2014 | \u2014 |'}

**Client stack source:** ${assessment.client_stack_source}. Overall feasibility: **${overall_feasibility}**.
`

  const effortRows = items
    .map((it) => {
      const infra = it.requires.client_infrastructure.join(', ') || 'None'
      return `| ${it.title} | ${it.effort} | ${it.risks.join('; ') || '\u2014'} | ${infra} |`
    })
    .join('\n')

  const effortSlide = `
# Effort & Complexity
## What Delivery Looks Like

Overall complexity: **${estimated_complexity}**.

| Deliverable | Effort | Notable Risks | Client Infrastructure Required |
|-------------|--------|---------------|------------------------------|
${effortRows || '| (no proposed items) | \u2014 | \u2014 | \u2014 |'}

Effort is derived from the number of new components we set up, the integrations we wire to your stack, and any replacement decisions.
`

  const tradeoffsList = open_tradeoffs.length > 0
    ? open_tradeoffs.map((t) => `- ${t}`).join('\n')
    : '- No open tradeoff decisions. Proposed package lines up with current stack assumptions.'

  const tradeoffSlide = `
# Tradeoff Decisions
## Where We Need Your Input Before Kickoff

${tradeoffsList}
`

  const structured = `
[STRUCTURED FEASIBILITY ASSESSMENT \u2014 use verbatim, do not infer additional findings]

\`\`\`json
${JSON.stringify(assessment, null, 2)}
\`\`\`
`

  return [stackFitSlide, effortSlide, tradeoffSlide, structured].join('\n---\n')
}

function feasibilityAntiFabricationClause(assessment: FeasibilityAssessment | null): string {
  if (!assessment) return ''
  return [
    'STACK-AWARE FEASIBILITY RULES:',
    '- The Stack Fit, Effort & Complexity, and Tradeoff Decisions slides were generated deterministically from structured data.',
    '- Do NOT invent new matches, integrations, gaps, risks, or tradeoffs that are not present in the STRUCTURED FEASIBILITY ASSESSMENT JSON block.',
    '- Do NOT change effort labels (small / medium / large) or overall feasibility (high / medium / low).',
    '- You may rewrite prose for clarity and tone; preserve every item, fit entry, and tradeoff exactly as listed.',
    `- Client stack source: ${assessment.client_stack_source}. BuiltWith credits state: ${assessment.builtwith_credits_state}.`,
  ].join('\n')
}

function aiLayerFitAntiFabricationClause(evaluation: AiLayerFitEvaluation | null): string {
  if (!evaluation) return ''
  return [
    'AI LAYER-FIT RULES:',
    '- The AI Layer-Fit Strategy and AI Tool Routing slides were generated deterministically from structured data.',
    '- Do NOT invent additional tools, scores, dimensions, or candidate layers that are not present in the STRUCTURED AI LAYER-FIT EVALUATION JSON block.',
    '- Preserve the weighted total, decision label, recommended layer, and open questions exactly as listed.',
    '- You may rewrite prose for clarity and tone; keep the routing recommendation anchored in the client stack and workflow signals.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function buildGammaReportInput(
  params: GammaReportParams
): Promise<GammaReportInput> {
  const context = await fetchReportContext(params)
  const feasibilityAssessment = await maybeBuildFeasibility(context, params)
  const aiLayerFitEvaluation =
    params.reportType === 'implementation_strategy'
      ? buildAiLayerFitForContext(context)
      : null

  let inputText: string
  let title: string

  let metaInstructions: string | undefined
  switch (params.reportType) {
    case 'value_quantification':
      ({ inputText, title } = buildValueQuantificationPrompt(context, params))
      break
    case 'implementation_strategy':
      ({ inputText, title } = buildImplementationStrategyPrompt(
        context,
        params,
        feasibilityAssessment,
        aiLayerFitEvaluation
      ))
      break
    case 'audit_summary':
      ({ inputText, title } = buildAuditSummaryPrompt(context, params))
      break
    case 'prospect_overview':
      ({ inputText, title } = buildProspectOverviewPrompt(context, params))
      break
    case 'offer_presentation': {
      const offerCtx = await fetchOfferContext(params)
      const built = buildOfferPresentationPrompt(context, offerCtx, params, feasibilityAssessment)
      inputText = built.inputText
      title = built.title
      metaInstructions = built.metaInstructions
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

  const existingInstructions = [metaInstructions, options.additionalInstructions]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join('\n\n')

  options.additionalInstructions = composeAdditionalInstructions(
    context,
    params.externalInputs,
    existingInstructions || undefined,
    feasibilityAssessment,
    aiLayerFitEvaluation
  )

  const evidenceItems = buildEvidenceForReport(context, params.externalInputs)
  const counts: Record<string, number> = {}
  for (const it of evidenceItems) {
    counts[it.kind] = (counts[it.kind] ?? 0) + 1
  }
  const citationsMeta = {
    items: evidenceItems,
    counts,
    generatedAt: new Date().toISOString(),
  }

  return { inputText, options, title, citationsMeta, feasibilityAssessment }
}

/**
 * Compose Gamma `additionalInstructions` from (a) Source Fidelity rules + Evidence Index,
 * (b) caller-provided custom instructions, (c) any options.additionalInstructions already set.
 *
 * The preamble is included in BOTH the prompt body (per-template) and additionalInstructions.
 * Gamma's rewrite pass uses additionalInstructions globally, so this keeps `[E#]` tags intact
 * even when Gamma reflows the body text.
 */
export function composeAdditionalInstructions(
  ctx: ReportContext,
  externalInputs: ExternalInputs | undefined,
  existing: string | undefined,
  feasibilityAssessment?: FeasibilityAssessment | null,
  aiLayerFitEvaluation?: AiLayerFitEvaluation | null
): string | undefined {
  const items = buildEvidenceForReport(ctx, externalInputs)
  const preamble = buildSourceFidelityPreamble(items)
  const feasibilityClause = feasibilityAntiFabricationClause(feasibilityAssessment ?? null)
  const aiLayerFitClause = aiLayerFitAntiFabricationClause(aiLayerFitEvaluation ?? null)
  const orgName = resolveOrganizationLabel(ctx)
  const orgGuardrail =
    `[CLIENT ORGANIZATION]\n` +
    `Use "${orgName}" as the exact organization name in titles, headings, and body text. ` +
    `Do not substitute generic phrases like "the organization", "the client", or "your company".`
  const customInstructions =
    externalInputs?.customInstructions && externalInputs.customInstructions.trim().length > 0
      ? externalInputs.customInstructions.trim()
      : ''
  const existingTrimmed = existing && existing.trim().length > 0 ? existing.trim() : ''

  const parts: string[] = [preamble, orgGuardrail]
  if (feasibilityClause) parts.push(feasibilityClause)
  if (aiLayerFitClause) parts.push(aiLayerFitClause)
  if (existingTrimmed) parts.push(existingTrimmed)
  if (customInstructions) parts.push(customInstructions)

  const joined = parts.join('\n\n')
  if (joined.length <= GAMMA_MAX_ADDITIONAL_INSTRUCTIONS) return joined

  // Over the 5000-char limit. Preserve rules + feasibility clause + caller-supplied
  // instructions; truncate the Evidence Index portion (the full index is also in the
  // prompt body, so Gamma still sees every E# during the initial generation pass).
  const nonPreamble = parts.slice(1)
  const separator = '\n\n'
  const nonPreambleLen =
    nonPreamble.reduce((acc, p) => acc + p.length, 0) + separator.length * nonPreamble.length
  const truncationNote = '\n… (evidence list truncated to fit Gamma 5000-char limit; full list in prompt body)'
  const preambleBudget = Math.max(
    0,
    GAMMA_MAX_ADDITIONAL_INSTRUCTIONS - nonPreambleLen - truncationNote.length
  )

  const evidenceMarker = '[EVIDENCE INDEX]'
  const evidenceIdx = preamble.indexOf(evidenceMarker)
  let truncatedPreamble: string
  if (evidenceIdx >= 0 && evidenceIdx + evidenceMarker.length <= preambleBudget) {
    const head = preamble.slice(0, evidenceIdx + evidenceMarker.length)
    const evidenceBody = preamble.slice(evidenceIdx + evidenceMarker.length)
    const remainingBudget = Math.max(0, preambleBudget - head.length)
    const keptLines: string[] = []
    let used = 0
    for (const line of evidenceBody.split('\n')) {
      const lineCost = line.length + 1 // '\n'
      if (used + lineCost > remainingBudget) break
      keptLines.push(line)
      used += lineCost
    }
    truncatedPreamble = head + keptLines.join('\n') + truncationNote
  } else {
    // Rules alone don't fit — last resort, hard-slice. Should be extremely rare.
    truncatedPreamble = preamble.slice(0, preambleBudget) + truncationNote
  }

  const finalParts = [truncatedPreamble, ...nonPreamble]
  let result = finalParts.join(separator)
  if (result.length > GAMMA_MAX_ADDITIONAL_INSTRUCTIONS) {
    result = result.slice(0, GAMMA_MAX_ADDITIONAL_INSTRUCTIONS)
  }
  console.warn(
    `[gamma-report-builder] additionalInstructions composed ${joined.length} chars, truncated to ${result.length} (cap ${GAMMA_MAX_ADDITIONAL_INSTRUCTIONS}).`
  )
  return result
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export async function fetchReportContext(params: GammaReportParams): Promise<ReportContext> {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not available — server-side only')
  }

  const [contact, audit, valueReport, services, painPoints, benchmarks] = await Promise.all([
    params.contactSubmissionId
      ? supabaseAdmin
          .from('contact_submissions')
          .select('id, name, email, company, industry, employee_count, website_tech_stack, client_verified_tech_stack')
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

  // Source-data evidence — meetings (for verbatim quotes) and pain-point evidence (for source excerpts).
  // Both are best-effort: if either fetch fails, the report still generates without those citations
  // rather than blocking the whole flow.
  const auditIdString = params.diagnosticAuditId != null ? String(params.diagnosticAuditId) : null
  const [meetings, painPointEvidence] = await Promise.all([
    params.contactSubmissionId
      ? fetchMeetingsForAudit(params.contactSubmissionId).catch((err: unknown) => {
          console.warn('[gamma-report-builder] fetchMeetingsForAudit failed:', err)
          return [] as MeetingForAudit[]
        })
      : Promise.resolve([] as MeetingForAudit[]),

    auditIdString
      ? supabaseAdmin
          .from('pain_point_evidence')
          .select('id, source_excerpt, source_type, pain_point_category_id')
          .eq('source_type', 'diagnostic_audit')
          .eq('source_id', auditIdString)
          .limit(20)
          .then((r: { data: Array<{ id: string; source_excerpt: string; source_type: string; pain_point_category_id: string }> | null }) => {
            const rows = r.data ?? []
            return rows.map((row) => ({
              id: row.id,
              excerpt: row.source_excerpt,
              sourceType: row.source_type,
              categoryId: row.pain_point_category_id,
            })) as PainPointEvidenceData[]
          })
          .catch((err: unknown) => {
            console.warn('[gamma-report-builder] pain_point_evidence fetch failed:', err)
            return [] as PainPointEvidenceData[]
          })
      : Promise.resolve([] as PainPointEvidenceData[]),
  ])

  return { contact, audit, valueReport, services, painPoints, benchmarks, meetings, painPointEvidence }
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
 * Exported for unit testing; production paths should use `buildGammaReportInput`.
 */
export async function buildGammaReportInputFromContext(
  ctx: ReportContext,
  params: GammaReportParams
): Promise<GammaReportInput> {
  const feasibilityAssessment = await maybeBuildFeasibility(ctx, params)
  const aiLayerFitEvaluation =
    params.reportType === 'implementation_strategy'
      ? buildAiLayerFitForContext(ctx)
      : null

  let inputText: string
  let title: string
  let metaInstructions: string | undefined

  switch (params.reportType) {
    case 'value_quantification':
      ({ inputText, title } = buildValueQuantificationPrompt(ctx, params))
      break
    case 'implementation_strategy':
      ({ inputText, title } = buildImplementationStrategyPrompt(
        ctx,
        params,
        feasibilityAssessment,
        aiLayerFitEvaluation
      ))
      break
    case 'audit_summary':
      ({ inputText, title } = buildAuditSummaryPrompt(ctx, params))
      break
    case 'prospect_overview':
      ({ inputText, title } = buildProspectOverviewPrompt(ctx, params))
      break
    case 'offer_presentation': {
      const offerCtx = await fetchOfferContext(params)
      const built = buildOfferPresentationPrompt(ctx, offerCtx, params, feasibilityAssessment)
      inputText = built.inputText
      title = built.title
      metaInstructions = built.metaInstructions
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

  const existingInstructions = [metaInstructions, options.additionalInstructions]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join('\n\n')

  options.additionalInstructions = composeAdditionalInstructions(
    ctx,
    params.externalInputs,
    existingInstructions || undefined,
    feasibilityAssessment,
    aiLayerFitEvaluation
  )

  const evidenceItems = buildEvidenceForReport(ctx, params.externalInputs)
  const counts: Record<string, number> = {}
  for (const it of evidenceItems) {
    counts[it.kind] = (counts[it.kind] ?? 0) + 1
  }
  const citationsMeta = {
    items: evidenceItems,
    counts,
    generatedAt: new Date().toISOString(),
  }

  return { inputText, options, title, citationsMeta, feasibilityAssessment }
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
  const evidence = buildEvidenceForReport(ctx, params.externalInputs)

  const title = `The Cost of Standing Still: ${orgName} Opportunity Quantification`

  const sections: string[] = []

  // Source Fidelity Rules + Evidence Index are injected via additionalInstructions
  // (see composeAdditionalInstructions) so they don't consume slide slots. Inline
  // [E#] tags in each slide still reference the evidence items below.

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
    const challengeCite = firstOfKind(itemsForAuditCategory(evidence, 'business_challenges'), 'audit_response')
    const meetingCite = firstOfKind(evidence, 'meeting_quote')
    const scoreCite = firstOfKind(itemsForAuditCategory(evidence, 'scores'), 'audit_response')

    let assessmentSlide = `
# CURRENT STATE ASSESSMENT
## Where ${orgName} Stands Today
`
    if (ctx.audit.diagnostic_summary) {
      const tag = challengeCite ? ` ${citationTag(challengeCite.id)}` : ''
      assessmentSlide += `\n${ctx.audit.diagnostic_summary}${tag}\n`
    }
    if (metrics.urgencyScore !== null || metrics.opportunityScore !== null) {
      const tag = scoreCite ? ` ${citationTag(scoreCite.id)}` : ''
      assessmentSlide += `\n`
      if (metrics.urgencyScore !== null) assessmentSlide += `**Urgency Score:** ${metrics.urgencyScore}/10 | `
      if (metrics.opportunityScore !== null) assessmentSlide += `**Opportunity Score:** ${metrics.opportunityScore}/10${tag}\n`
    }
    if (ctx.audit.key_insights && ctx.audit.key_insights.length > 0) {
      assessmentSlide += `\n**Key Findings:**\n`
      const insights = ctx.audit.key_insights.slice(0, 3)
      const auditCites = itemsForAuditCategory(evidence, 'business_challenges').concat(
        itemsForAuditCategory(evidence, 'automation_needs')
      )
      insights.forEach((insight, idx) => {
        const cite = auditCites[idx] ?? meetingCite
        const tag = cite ? ` ${citationTag(cite.id)}` : ''
        assessmentSlide += `- ${insight}${tag}\n`
      })
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
  const benchmarkCite = firstOfKind(evidence, 'benchmark')
  for (const stmt of metrics.topPainPoints) {
    const formulaCite = itemsForPainPoint(evidence, stmt.painPoint)[0]
    const formulaTag = formulaCite ? ` ${citationTag(formulaCite.id)}` : ''
    const benchTag = benchmarkCite ? ` ${citationTag(benchmarkCite.id)}` : ''
    const meetingCite = firstOfKind(evidence, 'meeting_quote')
    const meetingTag = meetingCite ? ` ${citationTag(meetingCite.id)}` : ''

    let card = `
# ${stmt.painPoint}

**The Problem:** This area represents an estimated ${formatCurrency(stmt.annualValue)}/year in unrealized value.${meetingTag}

**Calculation — ${CALCULATION_METHOD_LABELS[stmt.calculationMethod]}:**
${stmt.formulaReadable}${formulaTag}

**Annual Lift:** ${formatCurrency(stmt.annualValue)}${benchTag}
**Evidence:** ${stmt.evidenceSummary}${formulaTag}
**Confidence:** ${CONFIDENCE_LABELS[stmt.confidence]}
`
    const matchingAction = recommendedActions.find(
      (a: string) => a.toLowerCase().includes(stmt.painPoint.toLowerCase().split(' ')[0])
    )
    if (matchingAction) {
      const actionCite = firstOfKind(itemsForAuditCategory(evidence, 'automation_needs'), 'audit_response') ?? meetingCite
      const actionTag = actionCite ? ` ${citationTag(actionCite.id)}` : ''
      card += `\n**Recommended Action:** ${matchingAction}${actionTag}\n`
    }
    sections.push(card)
  }

  // --- Slide 10: Money Slide ---
  const sorted = [...statements].sort((a, b) => b.annualValue - a.annualValue)
  let moneySlide = `
# THE MONEY SLIDE
## Value-per-Effort Ranking: Where Does Your Money Go Furthest?

Every opportunity ranked by annual value. If budget is constrained, this answers: "Where do we start?"

| # | Opportunity | Annual Lift | Source |
|---|-----------|------------|--------|
`
  sorted.forEach((stmt, i) => {
    const cite = itemsForPainPoint(evidence, stmt.painPoint)[0]
    const sourceCell = cite ? citationTag(cite.id) : '—'
    moneySlide += `| ${i + 1} | ${stmt.painPoint} | ${formatCurrency(stmt.annualValue)} | ${sourceCell} |\n`
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

  // --- Slide 16: Let's Talk (replaces the previous bare "Ready to Align on Priorities?" CTA) ---
  sections.push(
    buildLetsTalkSlide(
      `Want to pressure-test these numbers against what ${fallbackOrgLabel(orgName)} is actually experiencing today?`,
      resolveCalendlyEventForParams(params)
    )
  )

  // --- Bio slide ---
  sections.push(buildBioSlide())

  // --- Evidence Ledger (final reference-appendix slide; must stay last per UX) ---
  sections.push(buildEvidenceLedgerSlide(evidence))

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
  params: GammaReportParams,
  feasibility: FeasibilityAssessment | null = null,
  aiLayerFit: AiLayerFitEvaluation | null = null
): { inputText: string; title: string } {
  const orgName = resolveOrganizationLabel(ctx)
  const domain = params.externalInputs?.siteCrawlData ? 'Website UX Redesign' : 'Digital Strategy'
  const title = `${orgName} ${domain}: Implementation Strategy`
  const evidence = buildEvidenceForReport(ctx, params.externalInputs)
  const metrics = computeDerivedMetrics(ctx)

  const sections: string[] = []

  // Source Fidelity Rules + Evidence Index are injected via additionalInstructions
  // so they don't consume slide slots. Inline [E#] tags reference evidence items.

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
    const techCite = firstOfKind(evidence, 'tech_stack')
    const summaryCite = firstOfKind(itemsForAuditCategory(evidence, 'business_challenges'), 'audit_response')
    const scoreCite = firstOfKind(itemsForAuditCategory(evidence, 'scores'), 'audit_response')

    let currentState = `
# Current State Assessment

`
    if (params.externalInputs?.siteCrawlData) {
      const tag = techCite ? ` ${citationTag(techCite.id)}` : ''
      currentState += `Based on site analysis:\n${params.externalInputs.siteCrawlData}${tag}\n\n`
    }
    if (ctx.audit?.diagnostic_summary) {
      const tag = summaryCite ? ` ${citationTag(summaryCite.id)}` : ''
      currentState += `**Diagnostic Summary:** ${ctx.audit.diagnostic_summary}${tag}\n\n`
    }
    if (ctx.audit?.urgency_score) {
      const tag = scoreCite ? ` ${citationTag(scoreCite.id)}` : ''
      currentState += `**Urgency Score:** ${ctx.audit.urgency_score}/10 | **Opportunity Score:** ${ctx.audit.opportunity_score}/10${tag}\n`
    }
    if (techCite) {
      const techItems = evidence.filter((e) => e.kind === 'tech_stack').slice(0, 5)
      if (techItems.length > 0) {
        currentState += `\n**Detected technology stack:**\n`
        for (const t of techItems) {
          currentState += `- ${t.verbatim} ${citationTag(t.id)}\n`
        }
      }
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
      const challengeCites = itemsForAuditCategory(evidence, 'business_challenges')
      const meetingCite = firstOfKind(evidence, 'meeting_quote')
      const insightLines = ctx.audit.key_insights.map((insight: string, idx: number) => {
        const cite = challengeCites[idx] ?? meetingCite
        const tag = cite ? ` ${citationTag(cite.id)}` : ''
        return `- ${insight}${tag}`
      })
      sections.push(`
# Key Insights from Assessment

${insightLines.join('\n')}
`)
    }
    if (ctx.audit.recommended_actions && ctx.audit.recommended_actions.length > 0) {
      const automationCites = itemsForAuditCategory(evidence, 'automation_needs')
      const meetingCite = firstOfKind(evidence, 'meeting_quote')
      const actionLines = ctx.audit.recommended_actions.map((action: string, idx: number) => {
        const cite = automationCites[idx] ?? meetingCite
        const tag = cite ? ` ${citationTag(cite.id)}` : ''
        return `- ${action}${tag}`
      })
      sections.push(`
# Recommended Actions

${actionLines.join('\n')}
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

  // --- AI Layer-Fit Strategy ---
  if (aiLayerFit) {
    sections.push(buildAiLayerFitSlides(aiLayerFit, orgName))
  }

  // --- Slide 9: Track 1 — DIY ---
  const diyJustifyCite =
    firstOfKind(itemsForAuditCategory(evidence, 'business_challenges'), 'audit_response') ??
    firstOfKind(evidence, 'meeting_quote')
  const diyTag = diyJustifyCite ? ` ${citationTag(diyJustifyCite.id)}` : ''
  sections.push(`
# TRACK 1: DIY — Self-Service Implementation

These changes can be made directly within ${orgName}'s existing platform at no additional cost beyond the current subscription. All tasks are within the capability of existing staff with basic CMS training.${diyTag}

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
`)

  // --- Slide: Let's Talk (CTA-focused close, paired with the Next Steps process slide above) ---
  sections.push(
    buildLetsTalkSlide(
      `Want to pressure-test whether this sequence fits how ${fallbackOrgLabel(orgName)} actually operates?`,
      resolveCalendlyEventForParams(params)
    )
  )

  // --- Feasibility Slides (stack-aware; only when bundle + feature flag) ---
  if (feasibility) {
    sections.push(buildFeasibilitySlides(feasibility, orgName))
  }

  // --- Bio slide ---
  sections.push(buildBioSlide())

  // --- Evidence Ledger (final reference-appendix slide; must stay last per UX) ---
  sections.push(buildEvidenceLedgerSlide(evidence))

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
  const evidence = buildEvidenceForReport(ctx, params.externalInputs)

  const sections: string[] = []

  // Source Fidelity Rules, Evidence Index, and organization-name guardrail are
  // injected via additionalInstructions so they don't consume slide slots.

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

    const categories: { key: keyof AuditData; label: string; categoryKey: string }[] = [
      { key: 'business_challenges', label: 'Business Challenges', categoryKey: 'business_challenges' },
      { key: 'tech_stack', label: 'Technology Stack', categoryKey: 'tech_stack' },
      { key: 'automation_needs', label: 'Automation Needs', categoryKey: 'automation_needs' },
      { key: 'ai_readiness', label: 'AI Readiness', categoryKey: 'ai_readiness' },
      { key: 'budget_timeline', label: 'Budget & Timeline', categoryKey: 'budget_timeline' },
      { key: 'decision_making', label: 'Decision Making', categoryKey: 'decision_making' },
    ]

    for (const cat of categories) {
      const data = ar[cat.key]
      if (data && typeof data === 'object') {
        const cites = itemsForAuditCategory(evidence, cat.categoryKey)
        const tagSuffix = cites.length > 0
          ? ` ${cites.map((c) => citationTag(c.id)).join('')}`
          : ''
        sections.push(
          `# ${cat.label}${tagSuffix}\n\n${formatAuditSection(data as Record<string, unknown>, 'No data recorded for this category.')}`
        )
      }
    }

    if (ar.diagnostic_summary) {
      const cite = firstOfKind(itemsForAuditCategory(evidence, 'business_challenges'), 'audit_response')
      const tag = cite ? ` ${citationTag(cite.id)}` : ''
      sections.push(`# Summary\n\n${ar.diagnostic_summary}${tag}`)
    }
    if (ar.key_insights?.length) {
      const meetingCite = firstOfKind(evidence, 'meeting_quote')
      const cites = itemsForAuditCategory(evidence, 'business_challenges')
      const lines = ar.key_insights.map((insight: string, idx: number) => {
        const cite = cites[idx] ?? meetingCite
        const tag = cite ? ` ${citationTag(cite.id)}` : ''
        return `- ${insight}${tag}`
      })
      sections.push(`# Key Insights\n\n${lines.join('\n')}`)
    }
    if (ar.recommended_actions?.length) {
      const meetingCite = firstOfKind(evidence, 'meeting_quote')
      const cites = itemsForAuditCategory(evidence, 'automation_needs')
      const lines = ar.recommended_actions.map((action: string, idx: number) => {
        const cite = cites[idx] ?? meetingCite
        const tag = cite ? ` ${citationTag(cite.id)}` : ''
        return `- ${action}${tag}`
      })
      sections.push(`# Recommended Actions\n\n${lines.join('\n')}`)
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
        const formulaCite = itemsForPainPoint(evidence, pp.painPoint)[0]
        const tag = formulaCite ? ` ${citationTag(formulaCite.id)}` : ''
        financialSlide += `- ${pp.painPoint}: ${formatCurrency(pp.annualValue)}/yr${tag}\n`
      }
    }
    sections.push(financialSlide)
  }

  // --- Slide: Let's Talk (replaces the previous bare Next Steps one-liner) ---
  const orgForCta = fallbackOrgLabel(orgName)
  sections.push(
    buildLetsTalkSlide(
      `Want to pressure-test which of these gaps would move the needle most for ${orgForCta}?`,
      resolveCalendlyEventForParams(params)
    )
  )

  // --- Bio slide ---
  sections.push(buildBioSlide())

  // --- Evidence Ledger (final reference-appendix slide; must stay last per UX) ---
  sections.push(buildEvidenceLedgerSlide(evidence))

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
  const evidence = buildEvidenceForReport(ctx, params.externalInputs)

  const sections: string[] = []

  // Source Fidelity Rules + Evidence Index are injected via additionalInstructions
  // so they don't consume slide slots.

  sections.push(buildCoverSlide(title, orgName))

  sections.push(`# About ${orgName}\n\nIndustry: ${industry}\nSize: ${ctx.contact?.employee_count || 'Unknown'}`)

  // Assessment Snapshot (light, one slide — skip if no audit)
  if (ctx.audit?.diagnostic_summary) {
    const summaryCite = firstOfKind(itemsForAuditCategory(evidence, 'business_challenges'), 'audit_response')
    const scoreCite = firstOfKind(itemsForAuditCategory(evidence, 'scores'), 'audit_response')
    const summaryTag = summaryCite ? ` ${citationTag(summaryCite.id)}` : ''
    const scoreTag = scoreCite ? ` ${citationTag(scoreCite.id)}` : ''
    let snapshot = `# Assessment Snapshot\n\n${ctx.audit.diagnostic_summary}${summaryTag}`
    if (metrics.urgencyScore !== null) snapshot += `\n\n**Urgency:** ${metrics.urgencyScore}/10`
    if (metrics.opportunityScore !== null) snapshot += ` | **Opportunity:** ${metrics.opportunityScore}/10${scoreTag}`
    sections.push(snapshot)
  }

  if (ctx.painPoints.length > 0) {
    const benchmarks = evidence.filter((e) => e.kind === 'benchmark')
    const benchmarkLine = benchmarks.length > 0
      ? `\n\n**Industry benchmarks referenced:** ${benchmarks.map((b) => citationTag(b.id)).join('')}`
      : ''
    sections.push(
      `# Common Pain Points in ${industry}\n\n${ctx.painPoints.slice(0, 6).map((pp) => `- **${pp.display_name}**: ${pp.description || 'A common challenge in this industry'}`).join('\n')}${benchmarkLine}`
    )
  }

  // Potential Annual Impact (light, one slide — skip if no value report)
  if (metrics.totalAnnualValue && metrics.totalAnnualValue > 0) {
    let impactSlide = `# Potential Annual Impact\n## Quantified Opportunity for ${orgName}\n\n`
    impactSlide += `**Total Annual Value at Stake:** ${formatCurrency(metrics.totalAnnualValue)}\n\n`
    if (metrics.topPainPoints.length > 0) {
      impactSlide += `**Top Opportunity Areas:**\n`
      for (const pp of metrics.topPainPoints.slice(0, 3)) {
        const cite = itemsForPainPoint(evidence, pp.painPoint)[0]
        const tag = cite ? ` ${citationTag(cite.id)}` : ''
        impactSlide += `- ${pp.painPoint}: ${formatCurrency(pp.annualValue)}/yr${tag}\n`
      }
    }
    sections.push(impactSlide)
  }

  if (ctx.services.length > 0) {
    sections.push(`# Relevant ATAS Services\n\n${ctx.services.slice(0, 6).map((s) => `- **${s.title}** (${s.service_type}): ${s.description?.substring(0, 150)}...`).join('\n')}`)
  }

  // --- Slide: Let's Talk (replaces the previous bare Next Steps one-liner) ---
  const orgForCtaProspect = fallbackOrgLabel(orgName)
  sections.push(
    buildLetsTalkSlide(
      `Want to pressure-test which of these opportunities is the right first move for ${orgForCtaProspect}?`,
      resolveCalendlyEventForParams(params)
    )
  )

  // --- Bio slide ---
  sections.push(buildBioSlide())

  // --- Evidence Ledger (final reference-appendix slide; must stay last per UX) ---
  sections.push(buildEvidenceLedgerSlide(evidence))

  return { inputText: sections.join('\n---\n'), title }
}

// ---------------------------------------------------------------------------
// Shared Slide Helpers — branded cover + bio across all report types
// ---------------------------------------------------------------------------

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://amadutown.com'
}

/**
 * Public asset base URL used for image references embedded in Gamma decks.
 *
 * Gamma's rendering servers fetch any image URL we embed in the deck markdown,
 * so `http://localhost:3000/...` (common in `.env.local`) produces a broken
 * image in the generated deck. Always resolve to a publicly reachable origin:
 *
 *   1. `GAMMA_PUBLIC_ASSET_BASE_URL` (explicit override, e.g. a Vercel
 *      preview URL when testing new assets).
 *   2. `NEXT_PUBLIC_SITE_URL` when it is not a local-loopback origin.
 *   3. `https://amadutown.com` as a safe production default.
 */
function getPublicAssetBaseUrl(): string {
  const override = process.env.GAMMA_PUBLIC_ASSET_BASE_URL
  if (override && override.trim().length > 0) return override.trim()
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(configured)) {
    return configured
  }
  return 'https://amadutown.com'
}

function buildCoverSlide(title: string, orgName: string, subtitle?: string): string {
  const siteUrl = getPublicAssetBaseUrl()
  const date = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  // Gamma's image preprocessor skips markdown `![alt](url)` and HTML `<img>`
  // tags — it only detects raw, whitespace-separated HTTPS URLs ending in a
  // recognized image extension. So emit the raw URL on its own line.
  // Ref: https://developers.gamma.app/guides/image-url-best-practices
  const lines = [
    `# ${title}`,
    `## Prepared for ${orgName}`,
    '',
    `${siteUrl}/logo_hd.png`,
    '',
  ]
  if (subtitle) lines.push(subtitle, '')
  lines.push(`Prepared by: Amadutown Advisory Solutions`, `Date: ${date}`)
  return lines.join('\n')
}

/**
 * Build the final-CTA `Let's Talk` slide. The pressure-test question is
 * per-report-type (see callers) so the CTA hooks into the specific argument
 * each deck just made. Intentionally has no photo — the `Meet Your Advisor`
 * slide that follows carries the photo + mission + sign-off.
 *
 * The meeting CTA is per-report-type (with admin override): pre-commit decks
 * route to the Discovery Call; post-commit decks (value_quantification,
 * implementation_strategy) route to the Onboarding Call. See
 * `lib/calendly-events.ts`.
 */
function buildLetsTalkSlide(
  pressureTestQuestion: string,
  calendlyEvent: CalendlyEventMeta & { url: string }
): string {
  return [
    `# Let's Talk`,
    '',
    pressureTestQuestion,
    '',
    `AmaduTown Advisory Solutions helps nonprofits and minority-owned businesses put AI to work — with **honest strategy**, **automation we actually ship**, and **tools built to run without us**.`,
    '',
    `📅 **Book a ${calendlyEvent.label}**`,
    `${calendlyEvent.duration}. ${calendlyEvent.blurb}`,
    calendlyEvent.url,
    '',
    `🌐 **amadutown.com**`,
    `See the approach, past work, and how we engage.`,
  ].join('\n')
}

/**
 * Resolve the Calendly event for a given report type, honoring the admin
 * override from `GammaReportParams.calendlyEventKey` when present.
 */
function resolveCalendlyEventForParams(
  params: GammaReportParams
): CalendlyEventMeta & { url: string } {
  const key = params.calendlyEventKey ?? defaultCalendlyEventForReportType(params.reportType)
  return resolveCalendlyEvent(key)
}

/**
 * Normalize the organization label for use inside the `Let's Talk` pressure-test
 * question. `resolveOrganizationLabel` returns `'the Organization'` as its last
 * resort when no real name is known — in a warm CTA sentence that reads like a
 * stage direction, so we substitute the softer `your organization` fallback
 * recommended by UX.
 */
function fallbackOrgLabel(orgName: string | null | undefined): string {
  const trimmed = trimNonEmpty(orgName)
  if (!trimmed || trimmed.toLowerCase() === 'the organization') {
    return 'your organization'
  }
  return trimmed
}

function buildBioSlide(): string {
  const siteUrl = getPublicAssetBaseUrl()
  const c = CREATOR_BACKGROUND
  // Gamma's image preprocessor silently skips markdown `![alt](url)` image
  // syntax — raw URLs on their own line are the only format it detects.
  // Ref: https://developers.gamma.app/guides/image-url-best-practices
  return [
    `# Meet Your Advisor`,
    `## ${c.name} (${c.alias})`,
    '',
    `${siteUrl}/Profile_Photo_1.jpg`,
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
  params: GammaReportParams,
  feasibility: FeasibilityAssessment | null = null
): { inputText: string; title: string; metaInstructions: string } {
  const orgName = resolveOrganizationLabel(ctx)
  const metrics = computeDerivedMetrics(ctx)
  const title = `${offerCtx.bundleName} — Prepared for ${orgName}`
  const evidence = buildEvidenceForReport(ctx, params.externalInputs)

  const coreOffers = offerCtx.items.filter((i) => i.offer_role === 'core_offer')
  const bonuses = offerCtx.items.filter((i) => i.offer_role === 'bonus')
  const deployedTools = offerCtx.items.filter((i) => i.is_deployed)

  const sections: string[] = []

  // Source Fidelity Rules, Evidence Index, and presenter-note guidance below are
  // injected via additionalInstructions so they don't consume slide slots.
  const metaInstructions =
    `[PRESENTATION GUIDANCE]\n` +
    `Package: ${offerCtx.bundleName}\n` +
    `- This deck is designed to be presented live during a sales conversation. Each slide maps to a stage in the sales flow.\n` +
    `- [PRESENTER NOTE] blocks contain private talking points visible only in Gamma's presenter view.\n` +
    `- Keep the client-facing content concise and visual. The detail lives in the presenter notes.`

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
      const summaryCite = firstOfKind(itemsForAuditCategory(evidence, 'business_challenges'), 'audit_response')
      const tag = summaryCite ? ` ${citationTag(summaryCite.id)}` : ''
      situationSlide += `${ctx.audit.diagnostic_summary}${tag}\n\n`
    }
    if (metrics.urgencyScore !== null || metrics.opportunityScore !== null) {
      const scoreCite = firstOfKind(itemsForAuditCategory(evidence, 'scores'), 'audit_response')
      const scoreTag = scoreCite ? ` ${citationTag(scoreCite.id)}` : ''
      if (metrics.urgencyScore !== null) situationSlide += `**Urgency Score:** ${metrics.urgencyScore}/10 | `
      if (metrics.opportunityScore !== null) situationSlide += `**Opportunity Score:** ${metrics.opportunityScore}/10${scoreTag}\n\n`
    }
    if (ctx.audit?.key_insights?.length) {
      const meetingCite = firstOfKind(evidence, 'meeting_quote')
      const auditCites = itemsForAuditCategory(evidence, 'business_challenges')
      situationSlide += `**Key Findings:**\n`
      ctx.audit.key_insights.slice(0, 4).forEach((insight: string, idx: number) => {
        const cite = auditCites[idx] ?? meetingCite
        const tag = cite ? ` ${citationTag(cite.id)}` : ''
        situationSlide += `- ${insight}${tag}\n`
      })
    }
    situationSlide += `\n${formatPresenterNote(discoveryNotes)}`
    sections.push(situationSlide)
  }

  // --- Slide 4: Cost of Inaction (discovery) ---
  if (metrics.totalAnnualValue && metrics.totalAnnualValue > 0) {
    let costSlide = `# The Cost of Standing Still\n## What Inaction Costs ${orgName} Every Year\n\n`
    costSlide += `**${formatCurrency(metrics.totalAnnualValue)}** in annual value at stake across ${metrics.topPainPoints.length} identified areas.\n\n`
    if (metrics.topPainPoints.length > 0) {
      costSlide += `| Opportunity | Annual Value | Source |\n|-----------|-------------|--------|\n`
      for (const pp of metrics.topPainPoints.slice(0, 5)) {
        const cite = itemsForPainPoint(evidence, pp.painPoint)[0]
        const tag = cite ? citationTag(cite.id) : ''
        costSlide += `| ${pp.painPoint} | ${formatCurrency(pp.annualValue)} | ${tag} |\n`
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
      const matchedPainCite = itemsForPainPoint(evidence, `${item.title} ${item.description ?? ''}`)[0]
      const auditCite = firstOfKind(itemsForAuditCategory(evidence, 'automation_needs'), 'audit_response')
      const cite = matchedPainCite ?? auditCite
      const tag = cite ? ` ${citationTag(cite.id)}` : ''
      coreSlide += `### ${item.title}${tag}\n`
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
  nextSlide += `3. **Sign and schedule** — Accept the proposal and we'll kick off Phase 1 within one week\n`
  nextSlide += `\n${formatPresenterNote(closeNotes)}`
  sections.push(nextSlide)

  // --- Slide: Let's Talk (CTA-focused close, paired with the Next Steps process slide above) ---
  sections.push(
    buildLetsTalkSlide(
      `Want to pressure-test whether this bundle is the right first move for ${fallbackOrgLabel(orgName)}?`,
      resolveCalendlyEventForParams(params)
    )
  )

  // --- Feasibility Slides (stack-aware; only when bundle + feature flag) ---
  if (feasibility) {
    sections.push(buildFeasibilitySlides(feasibility, orgName))
  }

  // --- Bio slide ---
  sections.push(buildBioSlide())

  // --- Evidence Ledger (final reference-appendix slide; must stay last per UX) ---
  sections.push(buildEvidenceLedgerSlide(evidence))

  return { inputText: sections.join('\n---\n'), title, metaInstructions }
}

function formatComparisonHighlights(): string {
  const highlights = COMPARISON_DATA.filter(
    (row) => row.amadutown === true || (typeof row.amadutown === 'string' && row.amadutown !== 'No')
  ).slice(0, 5)
  if (highlights.length === 0) return ''
  return `**Our capabilities:**\n` + highlights.map((h) => `- ${h.capability}: ${typeof h.amadutown === 'boolean' ? 'Yes' : h.amadutown}`).join('\n')
}
