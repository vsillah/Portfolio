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
import type {
  ContactEnrichment,
  DiagnosticContext,
  ValueReportContext,
} from '@/lib/lead-research-context'
import { loadLeadResearchBrief } from '@/lib/lead-research-context'

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

  const [promptRow, leadCtx, assets] = await Promise.all([
    getSystemPrompt(templateKey),
    loadLeadResearchBrief(input.contactId),
    fetchAssetDetails(input.assetIds),
  ])

  const { contact, diagnostic, valueReport, researchBrief, socialProof: proof } = leadCtx

  const senderName = process.env.EMAIL_FROM_NAME || 'Vambah Sillah'
  const calendlyLink = getCalendlyLink(templateKey)
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
