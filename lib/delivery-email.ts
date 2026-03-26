/**
 * Delivery email generation and sending for the contact detail page.
 * Three-layer model: system prompt template -> LLM draft -> inline edit -> send.
 *
 * Templates follow the Saraev 6-step framework with tiered research data
 * and anonymized social proof from real client outcomes.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getSystemPrompt } from '@/lib/system-prompts'
import { logCommunication } from '@/lib/communications'
import { recordOpenAICost } from '@/lib/cost-calculator'
import { sendEmail } from '@/lib/notifications'
import type { EmailTemplateKey } from '@/lib/constants/prompt-keys'

/* ───────── Types ───────── */

export interface AssetRef {
  type: 'gamma_report' | 'video' | 'value_report'
  id: string
}

export interface DeliveryDraftInput {
  contactId: number
  assetIds: AssetRef[]
  templateKey?: EmailTemplateKey
  customNote?: string
  dashboardUrl?: string
}

export interface DeliveryDraft {
  subject: string
  body: string
  dashboardUrl: string | null
}

export interface SendDeliveryInput {
  contactId: number
  recipientEmail: string
  subject: string
  body: string
  assetIds: AssetRef[]
  dashboardToken: string | null
  sentBy: string
}

interface AssetDetail {
  type: string
  id: string
  title: string
  url: string | null
  status: string
}

/** Tiered contact context for research brief assembly */
interface ContactEnrichment {
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

interface DiagnosticContext {
  diagnostic_summary: string | null
  key_insights: string[] | null
  recommended_actions: string[] | null
  urgency_score: number | null
  opportunity_score: number | null
  value_estimate: Record<string, unknown> | null
  business_challenges: Record<string, unknown> | null
  automation_needs: Record<string, unknown> | null
}

interface ValueReportContext {
  title: string | null
  total_annual_value: number | null
  value_statements: Record<string, unknown>[] | null
  summary_markdown: string | null
}

/** Data shape expected by suggestEmailTemplate (matches the GET contact detail response) */
export interface ContactPageData {
  gammaReports: Array<{ id: string }>
  videos: Array<{ id: string }>
  valueReports: Array<{ id: string }>
  deliveries: Array<{ id: string }>
  salesSessions: Array<{ id: string }>
  audits: Array<{ id: string }>
}

/* ───────── Data Fetching ───────── */

async function fetchAssetDetails(assetIds: AssetRef[]): Promise<AssetDetail[]> {
  if (!supabaseAdmin || assetIds.length === 0) return []

  const gammaIds = assetIds.filter(a => a.type === 'gamma_report').map(a => a.id)
  const videoIds = assetIds.filter(a => a.type === 'video').map(a => a.id)
  const valueIds = assetIds.filter(a => a.type === 'value_report').map(a => a.id)

  const results: AssetDetail[] = []
  const fetches: Promise<void>[] = []

  if (gammaIds.length) {
    fetches.push(
      supabaseAdmin
        .from('gamma_reports')
        .select('id, title, gamma_url, status')
        .in('id', gammaIds)
        .then(({ data }: { data: Array<{ id: string; title: string | null; gamma_url: string | null; status: string }> | null }) => {
          for (const r of data ?? []) {
            results.push({ type: 'gamma_report', id: r.id, title: r.title || 'Presentation Deck', url: r.gamma_url, status: r.status })
          }
        })
    )
  }

  if (videoIds.length) {
    fetches.push(
      supabaseAdmin
        .from('video_generation_jobs')
        .select('id, heygen_status, video_url, script_source, channel')
        .in('id', videoIds)
        .then(({ data }: { data: Array<{ id: string; heygen_status: string | null; video_url: string | null; script_source: string; channel: string }> | null }) => {
          for (const v of data ?? []) {
            results.push({ type: 'video', id: v.id, title: `Companion Video (${v.channel || 'youtube'})`, url: v.video_url, status: v.heygen_status || 'unknown' })
          }
        })
    )
  }

  if (valueIds.length) {
    fetches.push(
      supabaseAdmin
        .from('value_reports')
        .select('id, title, report_type')
        .in('id', valueIds)
        .then(({ data }: { data: Array<{ id: string; title: string | null; report_type: string }> | null }) => {
          for (const vr of data ?? []) {
            results.push({ type: 'value_report', id: vr.id, title: vr.title || 'Value Report', url: null, status: 'completed' })
          }
        })
    )
  }

  await Promise.all(fetches)
  return results
}

async function fetchContactEnrichment(contactId: number): Promise<ContactEnrichment> {
  if (!supabaseAdmin) {
    return { name: 'Unknown', email: '', company: null, industry: null, job_title: null, employee_count: null, annual_revenue: null, location: null, interest_areas: null, interest_summary: null, rep_pain_points: null, quick_wins: null, ai_readiness_score: null, competitive_pressure_score: null, potential_recommendations_summary: null, website_tech_stack: null }
  }

  const { data } = await supabaseAdmin
    .from('contact_submissions')
    .select('name, email, company, industry, job_title, employee_count, annual_revenue, location, interest_areas, interest_summary, rep_pain_points, quick_wins, ai_readiness_score, competitive_pressure_score, potential_recommendations_summary, website_tech_stack')
    .eq('id', contactId)
    .single()

  return (data as ContactEnrichment | null) ?? { name: 'Unknown', email: '', company: null, industry: null, job_title: null, employee_count: null, annual_revenue: null, location: null, interest_areas: null, interest_summary: null, rep_pain_points: null, quick_wins: null, ai_readiness_score: null, competitive_pressure_score: null, potential_recommendations_summary: null, website_tech_stack: null }
}

async function fetchDiagnosticContext(contactId: number): Promise<DiagnosticContext | null> {
  if (!supabaseAdmin) return null

  const { data } = await supabaseAdmin
    .from('diagnostic_audits')
    .select('diagnostic_summary, key_insights, recommended_actions, urgency_score, opportunity_score, value_estimate, business_challenges, automation_needs')
    .eq('contact_submission_id', contactId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as DiagnosticContext | null
}

async function fetchValueReportContext(contactId: number): Promise<ValueReportContext | null> {
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

/* ───────── Research Brief Builder (Tiered) ───────── */

function buildResearchBrief(
  contact: ContactEnrichment,
  diagnostic: DiagnosticContext | null,
  valueReport: ValueReportContext | null,
): string {
  const lines: string[] = []

  // Tier 1: Contact enrichment (always available)
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
    if (contact.competitive_pressure_score != null) scores.push(`Competitive Pressure: ${contact.competitive_pressure_score}/100`)
    lines.push('', '### Scores', scores.join(' | '))
  }
  if (contact.potential_recommendations_summary) {
    lines.push('', '### Recommendations', contact.potential_recommendations_summary)
  }
  if (contact.website_tech_stack && Object.keys(contact.website_tech_stack).length > 0) {
    const techKeys = Object.keys(contact.website_tech_stack).slice(0, 10)
    lines.push('', '### Tech Stack', techKeys.join(', '))
  }

  // Tier 2: Diagnostic audit (if exists)
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

  // Tier 3: Value report (if exists)
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

/* ───────── Social Proof Builder ───────── */

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

async function buildSocialProof(industry: string | null, employeeCount: string | null): Promise<string> {
  if (!supabaseAdmin) return FALLBACK_SOCIAL_PROOF

  // Try industry match first, then fall back to any report
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

  let reports = data as Array<{ industry: string; total_annual_value: number; value_statements: unknown; company_size_range: string | null }> | null

  // If no industry match, try without filter
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

  // Pick the best match (prefer same industry, then similar size)
  const best = reports[0]
  const label = INDUSTRY_LABELS[best.industry] || INDUSTRY_LABELS._default
  const value = Number(best.total_annual_value)
  const valueStr = value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(1)}M`
    : `$${Math.round(value / 1_000).toLocaleString()}K`

  // Extract one value statement for the specific outcome
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

const FALLBACK_SOCIAL_PROOF = 'AmaduTown Advisory Solutions has helped businesses across industries identify and capture operational efficiency gains through AI-powered process automation, technology strategy, and data-driven decision making.'

/* ───────── Template Suggestion ───────── */

/**
 * Auto-suggest the best email template based on where the contact is in the journey.
 * Can run client-side (from fetched data) or server-side.
 */
export function suggestEmailTemplate(data: ContactPageData): EmailTemplateKey {
  const hasClientProject = false // TODO: add client_projects to contact detail if needed
  if (data.salesSessions.length > 0 && hasClientProject) return 'email_onboarding_welcome'
  if (data.salesSessions.length > 0) return 'email_proposal_delivery'
  if (data.deliveries.length > 0) return 'email_follow_up'
  const hasAssets = data.gammaReports.length > 0 || data.videos.length > 0 || data.valueReports.length > 0
  if (hasAssets) return 'email_asset_delivery'
  return 'email_cold_outreach'
}

/* ───────── Key Findings Builder ───────── */

const LINK_FREE_TEMPLATES: ReadonlySet<string> = new Set([
  'email_cold_outreach',
  'email_follow_up',
])

/** Map each email template to the appropriate Calendly meeting type. */
function getCalendlyLink(templateKey: string): string {
  const fallback = process.env.CALENDLY_DISCOVERY_LINK || ''
  switch (templateKey) {
    case 'email_cold_outreach':
      return ''
    case 'email_asset_delivery':
      return process.env.CALENDLY_DELIVERY_REVIEW_URL || fallback
    case 'email_follow_up':
      return fallback
    case 'email_proposal_delivery':
      return process.env.CALENDLY_GO_NO_GO_URL || fallback
    case 'email_onboarding_welcome':
      return process.env.CALENDLY_KICKOFF_MEETING_URL || fallback
    default:
      return fallback
  }
}

function buildKeyFindings(
  contact: ContactEnrichment,
  diagnostic: DiagnosticContext | null,
  valueReport: ValueReportContext | null,
): string {
  const findings: string[] = []

  // Tier 3 first (most concrete): value report statements
  if (valueReport?.value_statements && Array.isArray(valueReport.value_statements)) {
    for (const s of valueReport.value_statements.slice(0, 2)) {
      const stmt = s as Record<string, unknown>
      const text = (stmt.statement || stmt.description) as string | undefined
      if (text) findings.push(text)
    }
  }

  // Tier 2: diagnostic key insights
  if (diagnostic?.key_insights?.length && findings.length < 3) {
    for (const insight of diagnostic.key_insights) {
      if (findings.length >= 3) break
      if (!findings.includes(insight)) findings.push(insight)
    }
  }

  // Tier 2 fallback: recommended actions
  if (diagnostic?.recommended_actions?.length && findings.length < 2) {
    for (const action of diagnostic.recommended_actions) {
      if (findings.length >= 3) break
      if (!findings.includes(action)) findings.push(action)
    }
  }

  // Tier 1 fallback: quick wins or pain points
  if (findings.length === 0 && contact.quick_wins) {
    const wins = contact.quick_wins.split(/[;\n]/).map(w => w.trim()).filter(Boolean)
    findings.push(...wins.slice(0, 3))
  }
  if (findings.length === 0 && contact.rep_pain_points) {
    const pains = contact.rep_pain_points.split(/[;\n]/).map(p => p.trim()).filter(Boolean)
    findings.push(...pains.slice(0, 3))
  }

  if (findings.length === 0) return 'No specific findings available yet.'

  return findings.slice(0, 3).map(f => `- ${f}`).join('\n')
}

/* ───────── Asset Summary ───────── */

function buildAssetSummary(assets: AssetDetail[], templateKey?: string, dashboardUrl?: string): string {
  if (assets.length === 0) return 'No assets selected.'

  const linkFree = LINK_FREE_TEMPLATES.has(templateKey || '')

  const lines = assets.map(a => {
    const statusNote = a.status === 'completed' ? '' : ` (${a.status})`
    // Omit URLs for cold outreach and follow-up to keep emails personal
    const urlNote = !linkFree && a.url ? ` — ${a.url}` : ''
    return `- ${a.title}${statusNote}${urlNote}`
  })

  // Only include dashboard URL for templates where links are expected
  if (dashboardUrl && !linkFree) {
    lines.push(`\nClient dashboard: ${dashboardUrl}`)
  }

  return lines.join('\n')
}

/* ───────── Draft Generation ───────── */

/**
 * Generate a delivery email draft using the selected template + LLM.
 * Injects tiered research brief and anonymized social proof.
 */
export async function generateDeliveryDraft(input: DeliveryDraftInput): Promise<DeliveryDraft> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const templateKey = input.templateKey || 'email_asset_delivery'

  const [promptRow, contact, diagnostic, valueReport, assets, socialProof] = await Promise.all([
    getSystemPrompt(templateKey),
    fetchContactEnrichment(input.contactId),
    fetchDiagnosticContext(input.contactId),
    fetchValueReportContext(input.contactId),
    fetchAssetDetails(input.assetIds),
    // Social proof fetch needs industry which we don't have yet — resolved below
    Promise.resolve(null as string | null),
  ])

  // Now fetch social proof with the contact's industry
  const proof = await buildSocialProof(contact.industry, contact.employee_count)

  const senderName = process.env.EMAIL_FROM_NAME || 'Vambah Sillah'
  const calendlyLink = getCalendlyLink(templateKey)
  const researchBrief = buildResearchBrief(contact, diagnostic, valueReport)
  const keyFindings = buildKeyFindings(contact, diagnostic, valueReport)
  const assetSummary = buildAssetSummary(assets, templateKey, input.dashboardUrl)

  let systemPrompt = promptRow?.prompt || DEFAULT_ASSET_DELIVERY_PROMPT

  systemPrompt = systemPrompt
    .replace(/\{\{research_brief\}\}/g, researchBrief)
    .replace(/\{\{social_proof\}\}/g, proof)
    .replace(/\{\{key_findings\}\}/g, keyFindings)
    .replace(/\{\{calendly_link\}\}/g, calendlyLink)
    .replace(/\{\{#calendly_link\}\}([\s\S]*?)\{\{\/calendly_link\}\}/g, calendlyLink ? '$1' : '')
    .replace(/\{\{prospect_name\}\}/g, contact.name)
    .replace(/\{\{company\}\}/g, contact.company || '')
    .replace(/\{\{#company\}\}([\s\S]*?)\{\{\/company\}\}/g, contact.company ? '$1' : '')
    .replace(/\{\{sender_name\}\}/g, senderName)
    .replace(/\{\{asset_summary\}\}/g, assetSummary)
    .replace(/\{\{dashboard_url\}\}/g, input.dashboardUrl || '')
    .replace(/\{\{#dashboard_url\}\}([\s\S]*?)\{\{\/dashboard_url\}\}/g, input.dashboardUrl ? '$1' : '')
    .replace(/\{\{custom_note\}\}/g, input.customNote || '')
    .replace(/\{\{#custom_note\}\}([\s\S]*?)\{\{\/custom_note\}\}/g, input.customNote ? '$1' : '')

  const config = (promptRow?.config ?? {}) as { model?: string; temperature?: number; maxTokens?: number }
  const model = config.model || 'gpt-4o-mini'
  const temperature = config.temperature ?? 0.7
  const maxTokens = config.maxTokens ?? 800

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Draft the email now. Respond only with JSON: { "subject": "...", "body": "..." }' },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[Delivery email] OpenAI error:', errText)
    throw new Error('Failed to generate delivery email draft')
  }

  const result = await response.json()
  const content = result.choices?.[0]?.message?.content
  const usage = result.usage

  if (usage) {
    recordOpenAICost(
      usage,
      model,
      { type: 'contact', id: String(input.contactId) },
      { operation: `${templateKey}_draft` }
    ).catch(() => {})
  }

  if (!content) throw new Error('No response from AI for delivery email')

  const parsed = JSON.parse(content) as { subject?: string; body?: string }

  return {
    subject: parsed.subject || `Resources for ${contact.name}`,
    body: parsed.body || 'Please find your personalized resources attached.',
    dashboardUrl: input.dashboardUrl || null,
  }
}

/* ───────── Send + Log ───────── */

export async function sendDeliveryEmail(input: SendDeliveryInput): Promise<{ success: boolean; error?: string; deliveryId?: string }> {
  if (!supabaseAdmin) return { success: false, error: 'Server configuration error' }

  const bodyHtml = input.body
    .split('\n')
    .map(line => line.trim() === '' ? '<br/>' : `<p>${line}</p>`)
    .join('\n')

  const success = await sendEmail({
    to: input.recipientEmail,
    subject: input.subject,
    html: bodyHtml,
    text: input.body,
  })

  const { data: delivery, error: insertErr } = await supabaseAdmin
    .from('contact_deliveries')
    .insert({
      contact_submission_id: input.contactId,
      subject: input.subject,
      body: input.body,
      recipient_email: input.recipientEmail,
      asset_ids: input.assetIds,
      dashboard_token: input.dashboardToken,
      sent_by: input.sentBy,
      status: success ? 'sent' : 'failed',
      error_message: success ? null : 'Email send failed',
    })
    .select('id')
    .single()

  if (insertErr) {
    console.error('[Delivery email] Failed to log delivery:', insertErr)
  }

  logCommunication({
    contactSubmissionId: input.contactId,
    channel: 'email',
    direction: 'outbound',
    messageType: 'asset_delivery',
    subject: input.subject,
    body: input.body,
    sourceSystem: 'delivery_email',
    sourceId: delivery?.id ?? undefined,
    status: success ? 'sent' : 'failed',
    sentBy: input.sentBy,
    metadata: {
      recipient_email: input.recipientEmail,
      asset_count: input.assetIds.length,
      has_dashboard: !!input.dashboardToken,
    },
  })

  return {
    success,
    deliveryId: delivery?.id ?? undefined,
    error: success ? undefined : 'Email send failed. Check Gmail configuration.',
  }
}

/* ───────── Default Prompt (fallback if DB prompt missing) ───────── */

const DEFAULT_ASSET_DELIVERY_PROMPT = `You are a professional business development associate at AmaduTown Advisory Solutions (ATAS). Draft a delivery email using the Saraev 6-step framework.

## Research Brief
{{research_brief}}

## Key Findings to Inline
{{key_findings}}

## Assets Created
{{asset_summary}}

## Social Proof
{{social_proof}}

## Framework
1. ICEBREAKER: Reference a specific finding from the key findings above. Show you understand their business.
2. VALUE PROPOSITION: Connect the findings to their specific challenges. Tease that the full analysis goes deeper.
3. SOCIAL PROOF: Use the proof provided. One sentence with numbers.
4. RISK REVERSAL: Free value, no obligation.
5. CTA: "I can walk you through the complete analysis in 10 minutes — {{calendly_link}}"
6. CLOSE: Sign off as {{sender_name}} only. No corporate signature.

Rules: Under 150 words. No fluff. Inline the key findings naturally — do NOT link to reports. Plain text with line breaks.
Respond with JSON: { "subject": "...", "body": "..." }`
