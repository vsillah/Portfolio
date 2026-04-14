/**
 * Tiered lead research brief + social proof for Saraev-style email prompts.
 * Shared by delivery emails (contact detail) and in-app outreach_queue generation.
 */

import { supabaseAdmin } from '@/lib/supabase'

/** Tier 1: contact_submissions enrichment */
export interface ContactEnrichment {
  name: string
  email: string
  company: string | null
  industry: string | null
  job_title: string | null
  employee_count: string | null
  annual_revenue: string | null
  location: string | null
  interest_areas: string[] | null
  interest_summary: string | null
  rep_pain_points: string | null
  quick_wins: string | null
  ai_readiness_score: number | null
  competitive_pressure_score: number | null
  potential_recommendations_summary: string | null
  website_tech_stack: Record<string, unknown> | null
}

/** Tier 2: completed diagnostic */
export interface DiagnosticContext {
  diagnostic_summary: string | null
  key_insights: string[] | null
  recommended_actions: string[] | null
  urgency_score: number | null
  opportunity_score: number | null
  value_estimate: Record<string, unknown> | null
  business_challenges: Record<string, unknown> | null
  automation_needs: Record<string, unknown> | null
}

/** Tier 3: value report */
export interface ValueReportContext {
  title: string | null
  total_annual_value: number | null
  value_statements: Record<string, unknown>[] | null
  summary_markdown: string | null
}

const EMPTY_CONTACT: ContactEnrichment = {
  name: 'Unknown',
  email: '',
  company: null,
  industry: null,
  job_title: null,
  employee_count: null,
  annual_revenue: null,
  location: null,
  interest_areas: null,
  interest_summary: null,
  rep_pain_points: null,
  quick_wins: null,
  ai_readiness_score: null,
  competitive_pressure_score: null,
  potential_recommendations_summary: null,
  website_tech_stack: null,
}

export async function fetchContactEnrichment(contactId: number): Promise<ContactEnrichment> {
  if (!supabaseAdmin) return { ...EMPTY_CONTACT }

  const { data } = await supabaseAdmin
    .from('contact_submissions')
    .select(
      'name, email, company, industry, job_title, employee_count, annual_revenue, location, interest_areas, interest_summary, rep_pain_points, quick_wins, ai_readiness_score, competitive_pressure_score, potential_recommendations_summary, website_tech_stack'
    )
    .eq('id', contactId)
    .single()

  return (data as ContactEnrichment | null) ?? { ...EMPTY_CONTACT }
}

export async function fetchDiagnosticContext(contactId: number): Promise<DiagnosticContext | null> {
  if (!supabaseAdmin) return null

  const { data } = await supabaseAdmin
    .from('diagnostic_audits')
    .select(
      'diagnostic_summary, key_insights, recommended_actions, urgency_score, opportunity_score, value_estimate, business_challenges, automation_needs'
    )
    .eq('contact_submission_id', contactId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as DiagnosticContext | null
}

export async function fetchValueReportContext(contactId: number): Promise<ValueReportContext | null> {
  if (!supabaseAdmin) return null

  const { data } = await supabaseAdmin
    .from('value_reports')
    .select('title, total_annual_value, value_statements, summary_markdown')
    .eq('contact_submission_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as ValueReportContext | null
}

export function buildResearchBrief(
  contact: ContactEnrichment,
  diagnostic: DiagnosticContext | null,
  valueReport: ValueReportContext | null
): string {
  const lines: string[] = []

  lines.push('## Prospect Profile')
  lines.push(`Name: ${contact.name}`)
  if (contact.job_title) lines.push(`Title: ${contact.job_title}`)
  if (contact.company) lines.push(`Company: ${contact.company}`)
  if (contact.industry) lines.push(`Industry: ${contact.industry}`)

  const firmDetails: string[] = []
  if (contact.employee_count) firmDetails.push(`Employees: ${contact.employee_count}`)
  if (contact.annual_revenue) firmDetails.push(`Revenue: ${contact.annual_revenue}`)
  if (contact.location) firmDetails.push(`Location: ${contact.location}`)
  if (firmDetails.length) lines.push(firmDetails.join(' | '))

  if (contact.rep_pain_points) {
    lines.push('', '### Pain Points', contact.rep_pain_points)
  }
  if (contact.interest_summary) {
    lines.push('', '### Interests', contact.interest_summary)
  }
  if (contact.interest_areas?.length) {
    lines.push(`Interest areas: ${contact.interest_areas.join(', ')}`)
  }
  if (contact.quick_wins) {
    lines.push('', '### Quick Wins Identified', contact.quick_wins)
  }
  if (contact.ai_readiness_score != null || contact.competitive_pressure_score != null) {
    const scores: string[] = []
    if (contact.ai_readiness_score != null) scores.push(`AI Readiness: ${contact.ai_readiness_score}/100`)
    if (contact.competitive_pressure_score != null)
      scores.push(`Competitive Pressure: ${contact.competitive_pressure_score}/100`)
    lines.push('', '### Scores', scores.join(' | '))
  }
  if (contact.potential_recommendations_summary) {
    lines.push('', '### Recommendations', contact.potential_recommendations_summary)
  }
  if (contact.website_tech_stack && Object.keys(contact.website_tech_stack).length > 0) {
    const techKeys = Object.keys(contact.website_tech_stack).slice(0, 10)
    lines.push('', '### Tech Stack', techKeys.join(', '))
  }

  if (diagnostic) {
    lines.push('', '## Diagnostic Findings')
    if (diagnostic.diagnostic_summary) lines.push(diagnostic.diagnostic_summary)
    if (diagnostic.key_insights?.length) {
      lines.push('', 'Key insights:')
      for (const i of diagnostic.key_insights.slice(0, 5)) lines.push(`- ${i}`)
    }
    if (diagnostic.recommended_actions?.length) {
      lines.push('', 'Recommended actions:')
      for (const a of diagnostic.recommended_actions.slice(0, 5)) lines.push(`- ${a}`)
    }
    const dScores: string[] = []
    if (diagnostic.urgency_score != null) dScores.push(`Urgency: ${diagnostic.urgency_score}/100`)
    if (diagnostic.opportunity_score != null) dScores.push(`Opportunity: ${diagnostic.opportunity_score}/100`)
    if (dScores.length) lines.push(dScores.join(' | '))
    if (diagnostic.value_estimate && typeof diagnostic.value_estimate === 'object') {
      const ve = diagnostic.value_estimate as Record<string, unknown>
      if (ve.total || ve.annual) {
        lines.push(`Estimated value: $${Number(ve.total || ve.annual).toLocaleString()}`)
      }
    }
  }

  if (valueReport) {
    lines.push('', '## Value Report')
    if (valueReport.title) lines.push(`Report: ${valueReport.title}`)
    if (valueReport.total_annual_value) {
      lines.push(`Total annual value identified: $${Number(valueReport.total_annual_value).toLocaleString()}`)
    }
    if (valueReport.value_statements && Array.isArray(valueReport.value_statements)) {
      const stmts = valueReport.value_statements.slice(0, 3)
      for (const s of stmts) {
        const stmt = s as Record<string, unknown>
        if (stmt.statement || stmt.description) {
          lines.push(`- ${stmt.statement || stmt.description}`)
        }
      }
    }
    if (valueReport.summary_markdown) {
      const truncated = valueReport.summary_markdown.slice(0, 500)
      lines.push('', 'Summary:', truncated + (valueReport.summary_markdown.length > 500 ? '...' : ''))
    }
  }

  return lines.join('\n')
}

const INDUSTRY_LABELS: Record<string, string> = {
  management_consulting: 'management consulting firm',
  nonprofit: 'nonprofit organization',
  ecommerce: 'e-commerce company',
  professional_services: 'professional services firm',
  saas: 'SaaS company',
  healthcare: 'healthcare organization',
  financial_services: 'financial services firm',
  real_estate: 'real estate company',
  manufacturing: 'manufacturing company',
  education: 'education institution',
  technology: 'technology company',
  retail: 'retail business',
  _default: 'mid-market business',
}

const FALLBACK_SOCIAL_PROOF =
  'AmaduTown Advisory Solutions has helped businesses across industries identify and capture operational efficiency gains through AI-powered process automation, technology strategy, and data-driven decision making.'

export async function buildSocialProof(industry: string | null, employeeCount: string | null): Promise<string> {
  void employeeCount // reserved for future size-matched proof
  if (!supabaseAdmin) return FALLBACK_SOCIAL_PROOF

  let query = supabaseAdmin
    .from('value_reports')
    .select('industry, total_annual_value, value_statements, company_size_range')
    .not('total_annual_value', 'is', null)
    .gt('total_annual_value', 0)
    .order('created_at', { ascending: false })
    .limit(5)

  if (industry) {
    query = query.eq('industry', industry)
  }

  const { data } = await query

  let reports = data as Array<{
    industry: string
    total_annual_value: number
    value_statements: unknown
    company_size_range: string | null
  }> | null

  if ((!reports || reports.length === 0) && industry) {
    const { data: fallbackData } = await supabaseAdmin
      .from('value_reports')
      .select('industry, total_annual_value, value_statements, company_size_range')
      .not('total_annual_value', 'is', null)
      .gt('total_annual_value', 0)
      .order('created_at', { ascending: false })
      .limit(5)

    reports = fallbackData as typeof reports
  }

  if (!reports || reports.length === 0) return FALLBACK_SOCIAL_PROOF

  const best = reports[0]
  const label = INDUSTRY_LABELS[best.industry] || INDUSTRY_LABELS._default
  const value = Number(best.total_annual_value)
  const valueStr =
    value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(1)}M` : `$${Math.round(value / 1_000).toLocaleString()}K`

  let specificOutcome = ''
  if (best.value_statements && Array.isArray(best.value_statements)) {
    const stmts = best.value_statements as Array<Record<string, unknown>>
    const first = stmts[0]
    if (first?.statement || first?.description) {
      specificOutcome = ` Their biggest win: ${first.statement || first.description}.`
    }
  }

  const sizeNote = best.company_size_range ? ` (${best.company_size_range} employees)` : ''

  return `Recently, we helped a ${label}${sizeNote} identify ${valueStr} in annual efficiency gains through process automation and technology advisory.${specificOutcome}`
}

/**
 * Load contact + diagnostic + value report and assemble research brief + social proof for LLM prompts.
 */
export async function loadLeadResearchBrief(contactId: number): Promise<{
  contact: ContactEnrichment
  diagnostic: DiagnosticContext | null
  valueReport: ValueReportContext | null
  researchBrief: string
  socialProof: string
}> {
  const [contact, diagnostic, valueReport] = await Promise.all([
    fetchContactEnrichment(contactId),
    fetchDiagnosticContext(contactId),
    fetchValueReportContext(contactId),
  ])
  const socialProof = await buildSocialProof(contact.industry, contact.employee_count)
  const researchBrief = buildResearchBrief(contact, diagnostic, valueReport)
  return { contact, diagnostic, valueReport, researchBrief, socialProof }
}
