/**
 * Build a diagnostic audit from meeting transcripts.
 * Fetches meeting_records by lead or project, combines transcript/structured_notes,
 * and uses OpenAI to extract the six diagnostic categories + summary/scores.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { recordOpenAICost, type Usage } from '@/lib/cost-calculator'
export const MAX_COMBINED_CHARS = 100_000
export const MAX_MEETINGS = 20

export interface MeetingForAudit {
  id: string
  meeting_type: string | null
  meeting_date: string | null
  transcript: string | null
  structured_notes: unknown
}

/**
 * Fetch meeting records that have transcript or structured_notes, by contact or project.
 * Ordered by meeting_date ascending so combined text is chronological.
 */
export async function fetchMeetingsForAudit(
  contactSubmissionId?: number,
  clientProjectId?: string
): Promise<MeetingForAudit[]> {
  if (!contactSubmissionId && !clientProjectId) {
    return []
  }

  let query = supabaseAdmin
    .from('meeting_records')
    .select('id, meeting_type, meeting_date, transcript, structured_notes')
    .order('meeting_date', { ascending: true })

  if (contactSubmissionId != null) {
    query = query.eq('contact_submission_id', contactSubmissionId)
  } else if (clientProjectId != null) {
    query = query.eq('client_project_id', clientProjectId)
  }

  const { data, error } = await query.limit(MAX_MEETINGS)

  if (error) {
    throw error
  }

  const rows = (data || []) as MeetingForAudit[]
  return rows.filter(
    (m) =>
      (m.transcript && m.transcript.trim().length > 0) ||
      (m.structured_notes && typeof m.structured_notes === 'object' && Object.keys(m.structured_notes as object).length > 0)
  )
}

/**
 * Combine transcript and structured_notes from meetings into a single text block.
 * Each meeting is prefixed with a header so the model can attribute content.
 */
export function combineMeetingText(meetings: MeetingForAudit[]): string {
  const parts: string[] = []
  for (const m of meetings) {
    const header = `[Meeting: ${m.meeting_type ?? 'meeting'}, ${m.meeting_date ?? 'no date'}]`
    if (m.transcript?.trim()) {
      parts.push(`${header}\n${m.transcript.trim()}`)
    }
    if (m.structured_notes && typeof m.structured_notes === 'object') {
      const notes = m.structured_notes as { summary?: string; [key: string]: unknown }
      if (notes.summary && typeof notes.summary === 'string') {
        parts.push(`${header} (structured summary)\n${notes.summary}`)
      }
    }
  }
  return parts.join('\n\n---\n\n')
}

export interface ExtractDiagnosticOptions {
  includeScores?: boolean
}

export interface ExtractedDiagnostic {
  business_challenges: Record<string, unknown>
  tech_stack: Record<string, unknown>
  automation_needs: Record<string, unknown>
  ai_readiness: Record<string, unknown>
  budget_timeline: Record<string, unknown>
  decision_making: Record<string, unknown>
  diagnostic_summary?: string
  key_insights?: string[]
  recommended_actions?: string[]
  urgency_score?: number
  opportunity_score?: number
  sales_notes?: string
}

const SYSTEM_PROMPT = `You are a sales intelligence analyst. Extract diagnostic audit data from meeting transcripts.

Output valid JSON with these exact top-level keys. Use the same field names and value codes as our audit form.

1. business_challenges: object with optional keys — primary_challenges (array of: manual_processes, data_silos, slow_follow_up, reporting_delays, scaling_bottlenecks, team_bandwidth, inconsistent_processes, other), pain_points (array of: manual_processes, spreadsheet_overload, no_single_source, slow_lead_response, missed_follow_ups, ad_hoc_reporting, disconnected_tools, high_admin_overhead, other), current_impact (one of: under_5_hrs, 5_10_hrs, 10_20_hrs, 20_plus_hrs, delayed_decisions, revenue_impact, unsure), attempted_solutions (one of: none, tools, consultants, internal, other). Use "other" plus key "primary_challenges_other" or similar for free text when needed.

2. tech_stack: object with optional keys — crm (none, hubspot, salesforce, pipedrive, zoho, other), email (gmail, outlook, slack, other), marketing (none, mailchimp, meta, hubspot_marketing, other), analytics (none, ga, mixpanel, other), integration_readiness (not_connected, some_apis, partially_connected, well_integrated).

3. automation_needs: object with optional keys — priority_areas (array of: lead_follow_up, reporting, data_sync, scheduling, email_sequences, document_handling, customer_onboarding, other), desired_outcomes (array of: same_day_follow_up, one_click_reports, fewer_manual_steps, consistent_process, visibility, scale_without_hiring, other), complexity_tolerance (low, medium, high).

4. ai_readiness: object with optional keys — data_quality (scattered, some_systems, integrated, ready), team_readiness (not_yet, individual, pilot, scaling), previous_ai_experience (none, personal, team_tools, built_something), concerns (array of: data_quality, privacy_security, team_adoption, cost, complexity, other).

5. budget_timeline: object with optional keys — budget_range (none, small, medium, large), timeline (asap, 4_8_weeks, quarter, 3_6_months, 6_12_months, exploring), decision_timeline (same values or no_deadline), budget_flexibility (fixed, some_flex, value_driven).

6. decision_making: object with optional keys — decision_maker (boolean), stakeholders (array of: ceo, cfo, cto, coo, sales_lead, marketing_lead, board, other), approval_process (solo, one_approver, committee, budget_threshold, other), previous_vendor_experience (none, mixed, positive, other).

7. diagnostic_summary: string, 2-3 sentences.
8. key_insights: array of strings, 3-5 items.
9. recommended_actions: array of strings, 3-5 items.
10. urgency_score: number 1-10.
11. opportunity_score: number 1-10.
12. sales_notes: optional string.

Only include keys for which you found evidence in the transcript. Omit keys with no evidence. Respond only with valid JSON.`

/**
 * Call OpenAI to extract diagnostic audit data from combined meeting text.
 * Returns object matching DiagnosticAuditData shape (six categories + optional summary/scores).
 */
export async function extractDiagnosticFromMeetingText(
  combinedText: string,
  _options?: ExtractDiagnosticOptions
): Promise<ExtractedDiagnostic> {
  const trimmed = combinedText.trim()
  if (!trimmed) {
    throw new Error('No transcript content to extract from')
  }
  if (trimmed.length > MAX_COMBINED_CHARS) {
    throw new Error(`Combined transcript exceeds ${MAX_COMBINED_CHARS} characters`)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Extract diagnostic audit data from these meeting transcripts.\n\n${trimmed}` },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('OpenAI API error (audit-from-meetings):', errText)
    throw new Error('AI extraction failed')
  }

  const result = await response.json()
  const content = result.choices?.[0]?.message?.content
  const usage = result.usage as Usage | undefined
  if (usage) {
    recordOpenAICost(usage, 'gpt-4o-mini', { type: 'diagnostic_audit', id: 'from_meetings' }, { operation: 'audit_from_meetings' }).catch(() => {})
  }
  if (!content) {
    throw new Error('No AI response')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    console.error('Failed to parse AI response (audit-from-meetings):', content)
    throw new Error('Failed to parse AI response')
  }

  const obj = parsed as Record<string, unknown>
  return {
    business_challenges: (obj.business_challenges as Record<string, unknown>) ?? {},
    tech_stack: (obj.tech_stack as Record<string, unknown>) ?? {},
    automation_needs: (obj.automation_needs as Record<string, unknown>) ?? {},
    ai_readiness: (obj.ai_readiness as Record<string, unknown>) ?? {},
    budget_timeline: (obj.budget_timeline as Record<string, unknown>) ?? {},
    decision_making: (obj.decision_making as Record<string, unknown>) ?? {},
    diagnostic_summary: typeof obj.diagnostic_summary === 'string' ? obj.diagnostic_summary : undefined,
    key_insights: Array.isArray(obj.key_insights) ? obj.key_insights.filter((x): x is string => typeof x === 'string') : undefined,
    recommended_actions: Array.isArray(obj.recommended_actions) ? obj.recommended_actions.filter((x): x is string => typeof x === 'string') : undefined,
    urgency_score: typeof obj.urgency_score === 'number' ? Math.max(0, Math.min(10, obj.urgency_score)) : undefined,
    opportunity_score: typeof obj.opportunity_score === 'number' ? Math.max(0, Math.min(10, obj.opportunity_score)) : undefined,
    sales_notes: typeof obj.sales_notes === 'string' ? obj.sales_notes : undefined,
  }
}

/**
 * Fetch meetings, combine text, and extract diagnostic in one flow.
 * Throws if no meetings, no content, or over limits.
 */
export async function buildDiagnosticFromMeetings(
  contactSubmissionId?: number,
  clientProjectId?: string
): Promise<{ meetings: MeetingForAudit[]; combinedText: string; extracted: ExtractedDiagnostic }> {
  const meetings = await fetchMeetingsForAudit(contactSubmissionId, clientProjectId)
  if (meetings.length === 0) {
    throw new Error('No meetings with transcript content found for this lead or project')
  }

  const combinedText = combineMeetingText(meetings)
  if (!combinedText.trim()) {
    throw new Error('No transcript content to extract from')
  }
  if (combinedText.length > MAX_COMBINED_CHARS) {
    throw new Error(`Combined transcript exceeds ${MAX_COMBINED_CHARS} characters (${meetings.length} meetings). Use fewer meetings.`)
  }

  const extracted = await extractDiagnosticFromMeetingText(combinedText, { includeScores: true })
  return { meetings, combinedText, extracted }
}
