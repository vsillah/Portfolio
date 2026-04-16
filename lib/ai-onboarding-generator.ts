/**
 * AI-powered onboarding content generator.
 *
 * Uses OpenAI to produce project-specific setup requirements, milestones,
 * and access needs based on proposal line items and available context
 * (internal DB data or external report text).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { recordOpenAICost } from '@/lib/cost-calculator'
import type { SetupRequirement, MilestoneTemplate, CommunicationPlan, WinCondition, WarrantyTerms } from '@/lib/onboarding-templates'

export interface AIOnboardingContent {
  setup_requirements: SetupRequirement[]
  milestones: MilestoneTemplate[]
  access_needs: string[]
  tools_and_platforms: string[]
  client_actions: string[]
}

export interface OnboardingGenerationInput {
  line_items: Array<{
    title: string
    description?: string
    content_type: string
    offer_role?: string
    price: number
  }>
  client_name?: string
  client_company?: string
  bundle_name?: string
  contact_submission_id?: number
  diagnostic_audit_id?: string
  value_report_id?: string
  gamma_report_id?: string
}

interface ContextData {
  contactInfo?: string
  auditSummary?: string
  valueEvidence?: string
  reportContext?: string
}

async function gatherContext(input: OnboardingGenerationInput): Promise<ContextData> {
  if (!supabaseAdmin) return {}

  const ctx: ContextData = {}
  const fetches: Promise<void>[] = []

  if (input.contact_submission_id) {
    fetches.push(
      supabaseAdmin
        .from('contact_submissions')
        .select('name, company, industry, employee_count')
        .eq('id', input.contact_submission_id)
        .single()
        .then(({ data }: { data: { name: string; company: string | null; industry: string | null; employee_count: string | null } | null }) => {
          if (data) {
            ctx.contactInfo = `Client: ${data.name}, Company: ${data.company || 'N/A'}, Industry: ${data.industry || 'N/A'}, Size: ${data.employee_count || 'N/A'}`
          }
        })
    )
  }

  if (input.diagnostic_audit_id) {
    fetches.push(
      supabaseAdmin
        .from('diagnostic_audits')
        .select('diagnostic_summary, key_insights, recommended_actions, tech_stack, business_challenges')
        .eq('id', input.diagnostic_audit_id)
        .single()
        .then(({ data }: { data: { diagnostic_summary: string | null; key_insights: unknown; recommended_actions: unknown; tech_stack: unknown; business_challenges: unknown } | null }) => {
          if (data) {
            const parts: string[] = []
            if (data.diagnostic_summary) parts.push(`Summary: ${data.diagnostic_summary}`)
            if (Array.isArray(data.key_insights) && data.key_insights.length) parts.push(`Key Insights: ${(data.key_insights as string[]).join('; ')}`)
            if (Array.isArray(data.recommended_actions) && data.recommended_actions.length) parts.push(`Recommended Actions: ${(data.recommended_actions as string[]).join('; ')}`)
            if (data.tech_stack && typeof data.tech_stack === 'object' && Object.keys(data.tech_stack as object).length > 0) parts.push(`Tech Stack: ${JSON.stringify(data.tech_stack)}`)
            if (data.business_challenges && typeof data.business_challenges === 'object' && Object.keys(data.business_challenges as object).length > 0) parts.push(`Business Challenges: ${JSON.stringify(data.business_challenges)}`)
            ctx.auditSummary = parts.join('\n')
          }
        })
    )
  }

  if (input.value_report_id) {
    fetches.push(
      supabaseAdmin
        .from('value_reports')
        .select('title, industry, company_size_range, summary_markdown, total_annual_value')
        .eq('id', input.value_report_id)
        .single()
        .then(({ data }: { data: { title: string | null; industry: string | null; company_size_range: string | null; summary_markdown: string | null; total_annual_value: number | null } | null }) => {
          if (data) {
            ctx.valueEvidence = `Value Report: ${data.title || 'Untitled'}, Industry: ${data.industry || 'N/A'}, Annual Value: $${data.total_annual_value || 0}. ${data.summary_markdown || ''}`
          }
        })
    )
  }

  if (input.gamma_report_id) {
    fetches.push(
      supabaseAdmin
        .from('gamma_reports')
        .select('title, report_type, input_text, external_inputs')
        .eq('id', input.gamma_report_id)
        .single()
        .then(({ data }: { data: { title: string | null; report_type: string; input_text: string | null; external_inputs: unknown } | null }) => {
          if (data) {
            const parts: string[] = [`Report: ${data.title || 'Untitled'} (${data.report_type})`]
            if (data.input_text) {
              const truncated = data.input_text.length > 4000
                ? data.input_text.slice(0, 4000) + '...[truncated]'
                : data.input_text
              parts.push(`Report Content:\n${truncated}`)
            }
            const ext = data.external_inputs as Record<string, string> | null
            if (ext?.thirdPartyFindings) parts.push(`Third-Party Findings: ${ext.thirdPartyFindings}`)
            if (ext?.competitorPlatform) parts.push(`Platform Info: ${ext.competitorPlatform}`)
            if (ext?.siteCrawlData) parts.push(`Site Data: ${ext.siteCrawlData}`)
            ctx.reportContext = parts.join('\n')
          }
        })
    )
  }

  await Promise.all(fetches)
  return ctx
}

function buildPrompt(input: OnboardingGenerationInput, ctx: ContextData): string {
  const lineItemsSummary = input.line_items
    .map((li, i) => `${i + 1}. ${li.title}${li.description ? ` — ${li.description}` : ''} (${li.content_type}, ${li.offer_role || 'core'}, $${li.price})`)
    .join('\n')

  const contextSections: string[] = []
  if (ctx.contactInfo) contextSections.push(ctx.contactInfo)
  if (ctx.auditSummary) contextSections.push(`\nDiagnostic Audit:\n${ctx.auditSummary}`)
  if (ctx.valueEvidence) contextSections.push(`\nValue Evidence:\n${ctx.valueEvidence}`)
  if (ctx.reportContext) contextSections.push(`\nStrategy/Implementation Report:\n${ctx.reportContext}`)

  return `You are an onboarding specialist at AmaduTown Advisory Solutions (ATAS). Based on the proposal details and project context below, generate a specific, actionable onboarding plan.

CLIENT: ${input.client_name || 'Unknown'}${input.client_company ? ` at ${input.client_company}` : ''}
BUNDLE: ${input.bundle_name || 'Custom Bundle'}

PROPOSAL LINE ITEMS:
${lineItemsSummary}

${contextSections.length > 0 ? `PROJECT CONTEXT:\n${contextSections.join('\n')}` : ''}

Generate specific onboarding content tailored to THIS project. Do NOT use generic placeholders. Instead:
- Reference specific platforms, tools, and systems mentioned in the context (e.g. "Firespring Springboard CMS", "Make.com", specific CRMs)
- Reference specific access needs based on what the line items require (e.g. "Admin access to client's Firespring account", "Donation platform credentials and settings")
- Create milestones that reflect the actual deliverables in the line items
- Identify specific client actions needed for each line item

Respond with JSON matching this structure:
{
  "setup_requirements": [
    {
      "title": "Specific requirement title",
      "description": "Detailed description of what's needed and why",
      "category": "access|documentation|security|team|setup|communication",
      "is_client_action": true/false
    }
  ],
  "milestones": [
    {
      "week": 1,
      "title": "Milestone title",
      "description": "What happens in this phase",
      "deliverables": ["Specific deliverable 1", "Specific deliverable 2"],
      "phase": 0
    }
  ],
  "access_needs": ["Specific platform/system access needed"],
  "tools_and_platforms": ["Specific tools that will be used"],
  "client_actions": ["Specific things the client must do before or during onboarding"]
}`
}

export async function generateAIOnboardingContent(
  input: OnboardingGenerationInput
): Promise<AIOnboardingContent> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const ctx = await gatherContext(input)
  const prompt = buildPrompt(input, ctx)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an onboarding specialist. Respond only with valid JSON matching the requested structure.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('OpenAI API error in onboarding generator:', errText)
    throw new Error('AI onboarding generation failed')
  }

  const result = await response.json()
  const content = result.choices?.[0]?.message?.content
  const usage = result.usage

  if (usage) {
    recordOpenAICost(
      usage,
      'gpt-4o-mini',
      { type: 'proposal', id: 'onboarding-preview' },
      { operation: 'generate_onboarding_content' }
    ).catch(() => {})
  }

  if (!content) {
    throw new Error('No AI response for onboarding content')
  }

  const parsed = JSON.parse(content) as AIOnboardingContent

  if (!parsed.setup_requirements) parsed.setup_requirements = []
  if (!parsed.milestones) parsed.milestones = []
  if (!parsed.access_needs) parsed.access_needs = []
  if (!parsed.tools_and_platforms) parsed.tools_and_platforms = []
  if (!parsed.client_actions) parsed.client_actions = []

  return parsed
}
