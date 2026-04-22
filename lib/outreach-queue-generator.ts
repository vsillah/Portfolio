/**
 * In-app outreach draft generation: OpenAI + insert into outreach_queue.
 *
 * Parity note vs WF-CLG-002 (n8n): Uses the same system_prompts template `email_cold_outreach`
 * ({{research_brief}}, {{social_proof}}, {{sender_name}}) and the same tiered research brief
 * as delivery emails. This path additionally appends "## Recent meeting context" from the latest
 * linked meeting_record when available (or from an explicit capped client-provided summary).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getSystemPrompt } from '@/lib/system-prompts'
import { recordOpenAICost } from '@/lib/cost-calculator'
import { loadLeadResearchBrief } from '@/lib/lead-research-context'
import {
  loadOpenOutreachTasksForContact,
  formatMeetingActionItemsBlock,
  applyMeetingActionItemsPlaceholders,
} from '@/lib/meeting-tasks-context'
import { appendPineconeAndChatContextToSystemPrompt } from '@/lib/email-llm-context'

const PROMPT_KEY = 'email_cold_outreach' as const

/** Max chars for user-supplied meeting summary (prompt injection / cost guard). */
export const MEETING_SUMMARY_MAX_CHARS = 8000

export function capMeetingSummary(text: string): string {
  const t = text.trim()
  if (t.length <= MEETING_SUMMARY_MAX_CHARS) return t
  return t.slice(0, MEETING_SUMMARY_MAX_CHARS) + '\n…[truncated]'
}

export function isInAppOutreachGenerationEnabled(): boolean {
  return process.env.ENABLE_IN_APP_OUTREACH_GEN !== 'false'
}

export type InAppOutreachGenerateResult =
  | { outcome: 'created'; id: string; subject: string; body: string }
  | { outcome: 'skipped'; reason: 'draft_exists' }

async function fetchLatestMeetingSnippet(contactId: number): Promise<string | null> {
  if (!supabaseAdmin) return null
  const { data: meetings } = await supabaseAdmin
    .from('meeting_records')
    .select('transcript, raw_notes, structured_notes')
    .eq('contact_submission_id', contactId)
    .order('meeting_date', { ascending: false })
    .limit(1)

  if (!meetings?.length) return null
  const meeting = meetings[0]
  const notes = meeting.structured_notes as Record<string, unknown> | null
  const raw =
    (notes?.summary as string) ||
    meeting.raw_notes ||
    (meeting.transcript ? meeting.transcript.substring(0, 1000) : null)
  if (!raw?.trim()) return null
  return capMeetingSummary(raw)
}

/**
 * Generate a cold-outreach email draft via OpenAI and insert into outreach_queue (status draft).
 *
 * `sourceTaskId` — when provided, the generated draft is linked back to a
 * meeting_action_task via outreach_queue.source_task_id. The draft-exists
 * guard also scopes to this field so a task-driven draft never collides with
 * a sequence-driven draft for the same contact/step (see 2026_04_17 migration,
 * CTO M3).
 */
export async function generateOutreachDraftInApp(params: {
  contactId: number
  sequenceStep?: number
  force?: boolean
  /** When set, used as meeting context (capped). When omitted, latest linked meeting is used when present. */
  meetingSummary?: string | null
  /** When false, do not auto-load meeting context. Default true. */
  includeLatestMeeting?: boolean
  /** When set, links the draft to a meeting_action_task via outreach_queue.source_task_id. */
  sourceTaskId?: string | null
}): Promise<InAppOutreachGenerateResult> {
  if (!isInAppOutreachGenerationEnabled()) {
    throw new Error('In-app outreach generation is disabled (ENABLE_IN_APP_OUTREACH_GEN=false)')
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  if (!supabaseAdmin) {
    throw new Error('Database not available')
  }

  const sequenceStep =
    typeof params.sequenceStep === 'number' && params.sequenceStep >= 1 && params.sequenceStep <= 6
      ? params.sequenceStep
      : 1

  const { data: lead, error: leadError } = await supabaseAdmin
    .from('contact_submissions')
    .select('id, do_not_contact, removed_at, is_test_data')
    .eq('id', params.contactId)
    .single()

  if (leadError || !lead) {
    throw new Error('Lead not found')
  }

  if (lead.do_not_contact) {
    throw new Error('Lead is marked as do-not-contact')
  }

  if (lead.removed_at) {
    throw new Error('Lead has been removed')
  }

  const sourceTaskId = params.sourceTaskId ?? null

  if (!params.force) {
    // Scope the "draft already exists" guard by source_task_id so a
    // task-driven draft (sourceTaskId != null) never collides with a
    // sequence-driven draft (sourceTaskId IS NULL) for the same contact/step.
    let existingQuery = supabaseAdmin
      .from('outreach_queue')
      .select('id')
      .eq('contact_submission_id', params.contactId)
      .eq('channel', 'email')
      .eq('sequence_step', sequenceStep)
      .eq('status', 'draft')

    if (sourceTaskId === null) {
      existingQuery = existingQuery.is('source_task_id', null)
    } else {
      existingQuery = existingQuery.eq('source_task_id', sourceTaskId)
    }

    const { data: existing } = await existingQuery.limit(1).maybeSingle()

    if (existing?.id) {
      return { outcome: 'skipped', reason: 'draft_exists' }
    }
  }

  const { contact, researchBrief: baseBrief, socialProof } = await loadLeadResearchBrief(params.contactId)

  let meetingSnippet: string | null = null
  if (params.meetingSummary != null && params.meetingSummary.trim() !== '') {
    meetingSnippet = capMeetingSummary(params.meetingSummary)
  } else if (params.includeLatestMeeting !== false) {
    meetingSnippet = await fetchLatestMeetingSnippet(params.contactId)
  }

  const researchBrief =
    meetingSnippet && meetingSnippet.length > 0
      ? `${baseBrief}\n\n## Recent meeting context\n${meetingSnippet}`
      : baseBrief

  const promptRow = await getSystemPrompt(PROMPT_KEY)
  const senderName = process.env.EMAIL_FROM_NAME || 'Vambah Sillah'

  let systemPrompt =
    promptRow?.prompt ||
    `You are a BDR at AmaduTown. Use research brief and social proof. Respond with JSON: { "subject": "...", "body": "..." }`

  // Meeting action items gating:
  //   - Only surface for step 1; later steps already have their own talking points.
  //   - applyMeetingActionItemsPlaceholders runs unconditionally so that if the
  //     prompt carries {{meeting_action_items}} sentinels but we have no tasks,
  //     the block is blanked out (no raw placeholder leaks into the draft).
  const meetingActionItems =
    sequenceStep === 1
      ? await loadOpenOutreachTasksForContact(params.contactId)
      : []
  const meetingActionItemsBlock = formatMeetingActionItemsBlock(meetingActionItems)
  systemPrompt = applyMeetingActionItemsPlaceholders(systemPrompt, meetingActionItemsBlock)

  systemPrompt = systemPrompt
    .replace(/\{\{research_brief\}\}/g, researchBrief)
    .replace(/\{\{social_proof\}\}/g, socialProof)
    .replace(/\{\{sender_name\}\}/g, senderName)

  systemPrompt = await appendPineconeAndChatContextToSystemPrompt(systemPrompt, {
    contact,
    researchTextForRag: researchBrief,
  })

  const config = (promptRow?.config ?? {}) as { model?: string; temperature?: number; maxTokens?: number }
  const model = config.model || 'gpt-4o-mini'
  const temperature = config.temperature ?? 0.75
  const maxTokens = config.maxTokens ?? 600

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
        {
          role: 'user',
          content:
            'Draft the cold outreach email now. Respond only with JSON: { "subject": "...", "body": "..." }',
        },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[outreach-queue-generator] OpenAI error:', errText)
    throw new Error('Failed to generate outreach draft')
  }

  const result = await response.json()
  const content = result.choices?.[0]?.message?.content as string | undefined
  const usage = result.usage

  if (usage) {
    recordOpenAICost(usage, model, { type: 'contact', id: String(params.contactId) }, {
      operation: 'outreach_queue_in_app',
    }).catch(() => {})
  }

  if (!content) {
    throw new Error('No response from AI for outreach draft')
  }

  const parsed = JSON.parse(content) as { subject?: string; body?: string }
  const body = (parsed.body || '').trim()
  if (!body) {
    throw new Error('Generated outreach body is empty')
  }

  const subject = (parsed.subject || `Quick note for ${contact.name}`).trim()

  const isTestData = lead.is_test_data === true

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('outreach_queue')
    .insert({
      contact_submission_id: params.contactId,
      channel: 'email',
      subject,
      body,
      sequence_step: sequenceStep,
      status: 'draft',
      generation_model: model,
      generation_prompt_summary: `in_app:${PROMPT_KEY}`,
      is_test_data: isTestData,
      source_task_id: sourceTaskId,
    })
    .select('id')
    .single()

  if (insertErr || !inserted?.id) {
    console.error('[outreach-queue-generator] insert error:', insertErr)
    throw new Error('Failed to save outreach draft')
  }

  return {
    outcome: 'created',
    id: inserted.id as string,
    subject,
    body,
  }
}
