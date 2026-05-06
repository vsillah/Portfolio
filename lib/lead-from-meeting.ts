/**
 * Extract lead-creation fields from a meeting transcript.
 *
 * Reuses fetchMeetingsForAudit + combineMeetingText from audit-from-meetings.ts
 * but with a lighter, lead-focused extraction prompt (contact info, pain points,
 * quick wins) rather than the full 6-category diagnostic audit.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { combineMeetingText, type MeetingForAudit } from '@/lib/audit-from-meetings'
import { recordOpenAICost, type Usage } from '@/lib/cost-calculator'
import {
  evaluateAgentBudget,
  type AgentBudgetDecision,
} from '@/lib/agent-budget-policy'
import { recordAgentEvent, recordAgentStep } from '@/lib/agent-run'

const MAX_TRANSCRIPT_CHARS = 60_000
const LEAD_EXTRACTION_MODEL = 'gpt-4o-mini'
const LEAD_EXTRACTION_MAX_TOKENS = 2000

export interface ExtractedLeadFields {
  name?: string
  email?: string
  company?: string
  job_title?: string
  industry?: string
  phone?: string
  linkedin_url?: string
  company_website?: string
  pain_points?: string
  quick_wins?: string
  employee_count?: string
  meeting_context_summary?: string
}

export class LeadFromMeetingError extends Error {
  constructor(
    message: string,
    public readonly code: 'budget_blocked' | 'openai_not_configured' | 'openai_upstream' | 'invalid_response',
  ) {
    super(message)
    this.name = 'LeadFromMeetingError'
  }
}

const SYSTEM_PROMPT = `You are a sales intelligence assistant. Extract contact and business information from a meeting transcript so a salesperson can create a lead record.

Output valid JSON with these keys (omit any where you found no evidence):

- name: Full name of the external participant (not the host/salesperson).
- email: Email address if mentioned.
- company: Company or organization name.
- job_title: Role or title if mentioned.
- industry: Industry or sector (e.g. "Healthcare", "Technology", "Professional Services").
- phone: Phone number if mentioned.
- linkedin_url: LinkedIn URL if mentioned.
- company_website: Company website if mentioned.
- pain_points: 2-4 sentence summary of the challenges, bottlenecks, or frustrations they described. Use their own words where possible.
- quick_wins: 1-3 quick-win AI/automation opportunities you identified from the conversation, each in one sentence.
- employee_count: Estimated company size range if mentioned (one of: "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+").
- meeting_context_summary: 2-3 sentence summary of the meeting — what was discussed, what they need, and any next steps mentioned.

Be precise. Extract real details from the transcript, not generic placeholders. If something wasn't mentioned, omit that key. Output only valid JSON.`

export function buildLeadExtractionUserPrompt(transcript: string): string {
  return `Extract lead/contact information from this meeting transcript.\n\n${transcript}`
}

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4)
}

export function evaluateLeadFromMeetingBudget(input: {
  systemPrompt: string
  userPrompt: string
  model?: string
  maxTokens?: number
}): AgentBudgetDecision {
  return evaluateAgentBudget({
    runtime: 'manual',
    model: input.model ?? LEAD_EXTRACTION_MODEL,
    estimatedInputTokens: estimateTokensFromText(`${input.systemPrompt}\n${input.userPrompt}`),
    maxTokens: input.maxTokens ?? LEAD_EXTRACTION_MAX_TOKENS,
    metadata: {
      operation: 'lead_from_meeting',
    },
  })
}

async function recordLeadFromMeetingBudgetDecision(args: {
  agentRunId?: string | null
  meetingRecordId?: string | null
  decision: AgentBudgetDecision
}) {
  if (!args.agentRunId) return

  const metadata = {
    meeting_record_id: args.meetingRecordId ?? null,
    budget_status: args.decision.status,
    budget_rule_key: args.decision.rule.key,
    estimated_cost_usd: args.decision.estimatedCostUsd,
    warning_usd: args.decision.warningUsd,
    limit_usd: args.decision.limitUsd,
  }

  await recordAgentStep({
    runId: args.agentRunId,
    stepKey: 'budget_check',
    name: 'Checked meeting lead extraction budget',
    status: args.decision.status === 'blocked' ? 'failed' : 'completed',
    outputSummary: args.decision.reason,
    costUsd: args.decision.estimatedCostUsd,
    metadata,
    idempotencyKey: `${args.agentRunId}:meeting_lead_extraction:budget_check`,
  }).catch((err) => console.warn('[lead-from-meeting] agent budget step failed:', err))

  if (args.decision.status !== 'allowed') {
    await recordAgentEvent({
      runId: args.agentRunId,
      eventType: 'budget_check',
      severity: args.decision.status === 'blocked' ? 'error' : 'warning',
      message: args.decision.reason,
      metadata,
      idempotencyKey: `${args.agentRunId}:meeting_lead_extraction:budget_check:${args.decision.status}`,
    }).catch((err) => console.warn('[lead-from-meeting] agent budget event failed:', err))
  }
}

/**
 * Fetch a single meeting record by ID with transcript content.
 */
export async function fetchMeetingForExtraction(
  meetingRecordId: string
): Promise<MeetingForAudit | null> {
  const { data, error } = await supabaseAdmin
    .from('meeting_records')
    .select('id, meeting_type, meeting_date, transcript, structured_notes')
    .eq('id', meetingRecordId)
    .single()

  if (error || !data) return null

  const m = data as MeetingForAudit
  const hasContent =
    (m.transcript && m.transcript.trim().length > 0) ||
    (m.structured_notes &&
      typeof m.structured_notes === 'object' &&
      Object.keys(m.structured_notes as object).length > 0)

  return hasContent ? m : null
}

/**
 * Extract lead fields from a meeting transcript using OpenAI.
 */
export async function extractLeadFieldsFromTranscript(
  combinedText: string,
  options?: { agentRunId?: string | null; meetingRecordId?: string | null },
): Promise<ExtractedLeadFields> {
  const trimmed = combinedText.trim()
  if (!trimmed) {
    throw new Error('No transcript content to extract from')
  }
  if (trimmed.length > MAX_TRANSCRIPT_CHARS) {
    throw new Error(`Transcript exceeds ${MAX_TRANSCRIPT_CHARS} characters`)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new LeadFromMeetingError('OPENAI_API_KEY is not configured', 'openai_not_configured')
  }

  const userPrompt = buildLeadExtractionUserPrompt(trimmed)
  const budgetDecision = evaluateLeadFromMeetingBudget({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    model: LEAD_EXTRACTION_MODEL,
    maxTokens: LEAD_EXTRACTION_MAX_TOKENS,
  })
  await recordLeadFromMeetingBudgetDecision({
    agentRunId: options?.agentRunId,
    meetingRecordId: options?.meetingRecordId,
    decision: budgetDecision,
  })
  if (budgetDecision.status === 'blocked') {
    throw new LeadFromMeetingError(budgetDecision.reason, 'budget_blocked')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LEAD_EXTRACTION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: LEAD_EXTRACTION_MAX_TOKENS,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('OpenAI API error (lead-from-meeting):', errText)
    throw new LeadFromMeetingError('AI extraction failed', 'openai_upstream')
  }

  const result = await response.json()
  const content = result.choices?.[0]?.message?.content
  const usage = result.usage as Usage | undefined
  if (usage) {
    recordOpenAICost(
      usage,
      LEAD_EXTRACTION_MODEL,
      { type: 'lead_extraction', id: options?.meetingRecordId ?? 'from_meeting' },
      {
        operation: 'lead_from_meeting',
        budget_status: budgetDecision.status,
        budget_rule_key: budgetDecision.rule.key,
        budget_estimated_cost_usd: budgetDecision.estimatedCostUsd,
      },
      options?.agentRunId ?? undefined,
    ).catch(() => {})
  }
  if (!content) {
    throw new LeadFromMeetingError('No AI response', 'invalid_response')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    console.error('Failed to parse AI response (lead-from-meeting):', content)
    throw new LeadFromMeetingError('Failed to parse AI response', 'invalid_response')
  }

  const obj = parsed as Record<string, unknown>
  const str = (key: string) => (typeof obj[key] === 'string' ? (obj[key] as string) : undefined)

  return {
    name: str('name'),
    email: str('email'),
    company: str('company'),
    job_title: str('job_title'),
    industry: str('industry'),
    phone: str('phone'),
    linkedin_url: str('linkedin_url'),
    company_website: str('company_website'),
    pain_points: str('pain_points'),
    quick_wins: str('quick_wins'),
    employee_count: str('employee_count'),
    meeting_context_summary: str('meeting_context_summary'),
  }
}

/**
 * Full pipeline: fetch meeting → combine text → extract lead fields.
 */
export async function extractLeadFieldsFromMeeting(
  meetingRecordId: string,
  options?: { agentRunId?: string | null },
): Promise<{ meeting: MeetingForAudit; extracted: ExtractedLeadFields }> {
  const meeting = await fetchMeetingForExtraction(meetingRecordId)
  if (!meeting) {
    throw new Error('Meeting not found or has no transcript content')
  }

  const combinedText = combineMeetingText([meeting])
  if (!combinedText.trim()) {
    throw new Error('No transcript content to extract from')
  }

  const extracted = await extractLeadFieldsFromTranscript(combinedText, {
    agentRunId: options?.agentRunId,
    meetingRecordId,
  })
  return { meeting, extracted }
}
