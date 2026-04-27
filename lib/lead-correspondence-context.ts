/**
 * Phase 3 — Prior outreach correspondence context.
 *
 * Loads the most recent outreach + replies for a lead and renders a compact,
 * model-ready block for the `{{#prior_outreach_history}}…{{/prior_outreach_history}}`
 * sentinel in outreach system prompts. Goal: give the LLM enough memory to
 * avoid repeating itself and to thread continuity ("as I mentioned last week
 * about your AI rollout…") without leaking pages of stale content.
 *
 * Source of truth (priority order):
 *   1. `outreach_queue`     — outbound drafts that were sent / replied / approved
 *      (carries full body, subject, sequence_step, channel) plus `reply_content`
 *      when the lead replied to that exact thread.
 *   2. `contact_communications` — inbound replies + manual notes that are not
 *      tied to an outreach_queue row (e.g. cold inbound, manually-logged DMs).
 *
 * `email_messages` is intentionally NOT a source — it stores body_preview only
 * (≤500 chars) and is fully derived from `contact_communications` + outbound
 * sends, so reading it would just truncate the same data we already have.
 *
 * The output is plain text (no JSON, no Mustache); it is templated into the
 * system prompt by `lib/email-llm-context.ts#applyPriorOutreachHistorySentinel`.
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { OutreachChannel } from '@/lib/constants/prompt-keys'

/** Max characters we inject into the prompt (across all entries). */
export const PRIOR_OUTREACH_TOTAL_CHAR_CAP = 3_000
/** Max entries (outbound rows) we surface. Each may have an associated reply. */
export const PRIOR_OUTREACH_MAX_ENTRIES = 5
/** Per-row body cap before injection. */
const PER_ROW_BODY_CHAR_CAP = 700
const PER_REPLY_CHAR_CAP = 500

const HEADING =
  '## Prior outreach history with this lead (use for continuity; do not repeat content already sent)'

export interface PriorOutreachMetadata {
  /** Raw entries we considered before capping. Always >= entriesIncluded. */
  entriesConsidered: number
  /** Entries that actually made it into the rendered block. */
  entriesIncluded: number
  /** Length (chars) of the rendered block, including heading. 0 when block is null. */
  chars: number
  /** True when at least one inbound reply was injected. */
  hasInbound: boolean
}

interface OutreachQueueRow {
  id: string
  channel: OutreachChannel
  subject: string | null
  body: string
  sequence_step: number | null
  status: string
  reply_content: string | null
  sent_at: string | null
  replied_at: string | null
  created_at: string
}

interface ContactCommunicationsRow {
  id: string
  channel: string
  direction: 'outbound' | 'inbound'
  message_type: string
  subject: string | null
  body: string
  source_system: string
  source_id: string | null
  status: string
  sent_at: string | null
  created_at: string
}

interface RenderableEntry {
  /** Anchor timestamp used for ordering and "x days ago" formatting. */
  timestamp: string
  channel: string
  /** Outbound message (always present — the entry is anchored on outbound). */
  outbound: {
    subject: string | null
    body: string
    sequenceStep: number | null
    status: string
    /** Was this draft sent (vs queued/approved/etc.)? Used to vary copy. */
    sentAt: string | null
  }
  /** Reply, if any. Either from outreach_queue.reply_content or matched comms. */
  reply: {
    body: string
    receivedAt: string | null
  } | null
}

/**
 * Load prior outreach history for a contact.
 *
 * @param contactId  — `contact_submissions.id`
 * @param channel    — current channel being generated; influences scope. Today
 *                     we surface ALL channels for the lead (so an email
 *                     generator sees prior LinkedIn DMs and vice versa) since
 *                     reps treat the lead as one relationship. Pass `'email'`
 *                     or `'linkedin'` for forward-compatibility — future
 *                     versions may scope strictly.
 * @returns          - `block`: the rendered text block (or null when nothing).
 *                   - `metadata`: structured trace for `generation_inputs`.
 */
export async function loadLeadCorrespondenceExcerpt(
  contactId: number,
  // Reserved for future channel-scoped filtering. Currently unused — see JSDoc.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  channel: OutreachChannel,
): Promise<{ block: string | null; metadata: PriorOutreachMetadata }> {
  const empty: PriorOutreachMetadata = {
    entriesConsidered: 0,
    entriesIncluded: 0,
    chars: 0,
    hasInbound: false,
  }

  if (!supabaseAdmin || !Number.isFinite(contactId) || contactId <= 0) {
    return { block: null, metadata: empty }
  }

  const [oqRes, ccRes] = await Promise.all([
    supabaseAdmin
      .from('outreach_queue')
      .select(
        'id, channel, subject, body, sequence_step, status, reply_content, sent_at, replied_at, created_at',
      )
      .eq('contact_submission_id', contactId)
      .in('status', ['sent', 'replied', 'bounced', 'approved'])
      .order('created_at', { ascending: false })
      .limit(PRIOR_OUTREACH_MAX_ENTRIES * 2),
    supabaseAdmin
      .from('contact_communications')
      .select(
        'id, channel, direction, message_type, subject, body, source_system, source_id, status, sent_at, created_at',
      )
      .eq('contact_submission_id', contactId)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(PRIOR_OUTREACH_MAX_ENTRIES * 2),
  ])

  const oqRows = (oqRes.data ?? []) as OutreachQueueRow[]
  const ccInboundRows = (ccRes.data ?? []) as ContactCommunicationsRow[]

  // Index outreach_queue by id so we can flag inbound comms that already have
  // their reply text stored on outreach_queue.reply_content (avoid duplication).
  const oqIds = new Set(oqRows.map((r) => r.id))

  const entries: RenderableEntry[] = []

  // 1. Outbound (with optional reply attached) from outreach_queue.
  for (const row of oqRows) {
    const outboundTs =
      row.sent_at ??
      row.created_at
    const reply = row.reply_content?.trim()
      ? {
          body: row.reply_content!.trim(),
          receivedAt: row.replied_at ?? null,
        }
      : null

    entries.push({
      timestamp: outboundTs,
      channel: row.channel,
      outbound: {
        subject: row.subject,
        body: row.body,
        sequenceStep: row.sequence_step,
        status: row.status,
        sentAt: row.sent_at,
      },
      reply,
    })
  }

  // 2. Inbound comms that don't reference an outreach_queue row (e.g. cold
  //    replies, manual logs). We render these as standalone "[reply]" entries
  //    so the model still sees lead-side signal.
  for (const row of ccInboundRows) {
    if (
      row.source_system === 'outreach_queue' &&
      row.source_id &&
      oqIds.has(row.source_id)
    ) {
      // Already represented via outreach_queue.reply_content above (or will be).
      continue
    }
    entries.push({
      timestamp: row.sent_at ?? row.created_at,
      channel: row.channel,
      outbound: {
        subject: row.subject,
        body: '(inbound — no matching outreach in outreach_queue)',
        sequenceStep: null,
        status: 'reply_only',
        sentAt: null,
      },
      reply: {
        body: row.body,
        receivedAt: row.sent_at,
      },
    })
  }

  // Sort newest first, cap entry count.
  entries.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
  const considered = entries.length
  const top = entries.slice(0, PRIOR_OUTREACH_MAX_ENTRIES)

  if (top.length === 0) {
    return { block: null, metadata: empty }
  }

  // Render entries oldest-first so the model reads the conversation in time
  // order. Truncate the whole block to the global cap.
  const ordered = [...top].reverse()
  const now = Date.now()
  const lines: string[] = [HEADING]
  let totalLen = HEADING.length + 2
  let included = 0
  let hasInbound = false

  for (const e of ordered) {
    const rendered = renderEntry(e, now)
    // +2 for the newline separator between entries.
    if (totalLen + rendered.length + 2 > PRIOR_OUTREACH_TOTAL_CHAR_CAP) {
      lines.push('[earlier history truncated]')
      break
    }
    lines.push('')
    lines.push(rendered)
    totalLen += rendered.length + 2
    included += 1
    if (e.reply) hasInbound = true
  }

  const block = lines.join('\n')
  return {
    block,
    metadata: {
      entriesConsidered: considered,
      entriesIncluded: included,
      chars: block.length,
      hasInbound,
    },
  }
}

function renderEntry(entry: RenderableEntry, nowMs: number): string {
  const when = formatRelative(entry.timestamp, nowMs)
  const channel = capitalize(entry.channel)
  const step =
    typeof entry.outbound.sequenceStep === 'number'
      ? ` · step ${entry.outbound.sequenceStep}`
      : ''
  const status = ` · ${entry.outbound.status}`
  const subject =
    entry.outbound.subject && entry.outbound.subject.trim() !== ''
      ? `\nSubject: ${entry.outbound.subject.trim()}`
      : ''
  const body = truncate(entry.outbound.body.trim(), PER_ROW_BODY_CHAR_CAP)

  let out = `[${when}] ${channel}${step}${status}${subject}\n${body}`

  if (entry.reply) {
    const reply = truncate(entry.reply.body.trim(), PER_REPLY_CHAR_CAP)
    const replyWhen = entry.reply.receivedAt
      ? formatRelative(entry.reply.receivedAt, nowMs)
      : 'after'
    out += `\n\n[reply received · ${replyWhen}]\n${reply}`
  }

  return out
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

function formatRelative(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'recently'
  const diffMs = nowMs - then
  if (diffMs < 0) return 'just now'
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`
  const months = Math.round(days / 30)
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`
  const years = Math.round(months / 12)
  return years === 1 ? '1 year ago' : `${years} years ago`
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
