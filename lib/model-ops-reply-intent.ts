import crypto from 'node:crypto'

export const MODEL_OPS_REPLY_INTENT_TARGET = 200

export type ReplyIntentReviewStatus = 'pending' | 'reviewed' | 'unsure' | 'skipped'

export type ReplyIntentSuggestedLabels = {
  scheduling_intent: boolean
  ooo: boolean
  not_interested: boolean
  interested: boolean
  needs_followup: boolean
}

export type OutreachReplySourceRow = {
  id: string
  channel?: string | null
  sequence_step?: number | null
  status?: string | null
  replied_at?: string | null
  created_at?: string | null
  reply_content?: string | null
}

export type ReplyIntentReviewRow = {
  id?: string
  source_table: 'outreach_queue'
  source_id: string
  source_hash: string
  reply_hash: string
  channel?: string | null
  replied_at?: string | null
  outreach_status?: string | null
  sequence_step?: number | null
  redacted_reply: string
  suggested_labels: ReplyIntentSuggestedLabels
  review_status: ReplyIntentReviewStatus
  human_scheduling_intent?: boolean | null
  notes?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type ReplyIntentQueueItem = {
  source_id: string
  source_table: 'outreach_queue'
  source_hash: string
  reply_hash: string
  channel: string | null
  replied_at: string | null
  outreach_status: string | null
  sequence_step: number | null
  redacted_reply: string
  suggested_labels: ReplyIntentSuggestedLabels
  review_status: ReplyIntentReviewStatus
  human_scheduling_intent: boolean | null
  notes: string
  reviewed_at: string | null
  existing_review_id: string | null
}

const NAME_PATTERN = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi

const SCHEDULING_PATTERNS = [
  /\bscheduled zoom\b/,
  /\bzoom meeting\b/,
  /\bzoom invite\b/,
  /\bcalendar\b/,
  /\bcalendly\b/,
  /\bbook a call\b/,
  /\bschedule\b/,
  /\bavailable\b/,
  /\bavailability\b/,
  /\bmeet with\b/,
  /\bcan your team meet\b/,
  /\bwant to meet\b/,
  /\bmeeting\b/,
  /\bdiscovery call\b/,
  /\bshort call\b/,
  /\bquick call\b/,
  /\bset up a time\b/,
  /\bsend (me )?(a few )?times\b/,
  /\btimes that work\b/,
  /\blet'?s chat\b/,
  /\blet'?s talk\b/,
  /\bfree this week\b/,
  /\bwhat time\b/,
  /\bmove this to\b/,
  /\bput something on the calendar\b/,
]

const OUT_OF_OFFICE_PHRASES = [
  'out of office',
  'ooo',
  'on vacation',
  'annual leave',
  'away from the office',
  'traveling until',
  'unavailable until',
  'back on',
]

const NOT_INTERESTED_PHRASES = [
  'not interested',
  'unsubscribe',
  'remove me',
  'no thanks',
  'not a fit',
  'stop emailing',
]

const FOLLOW_UP_PHRASES = [
  "i'll get back",
  'i will get back',
  'on my list',
  'circle back',
  'review this',
  'reconnect after',
  'follow up later',
  'respond when i return',
]

export function stableHash(value: unknown) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12)
}

export function redactReplyText(value: unknown) {
  let out = String(value || '')
  out = out.replace(EMAIL_PATTERN, (match) => `[email:${stableHash(match.toLowerCase())}]`)
  out = out.replace(URL_PATTERN, (match) => {
    try {
      const url = new URL(match)
      return `[url:${url.hostname}:${stableHash(match)}]`
    } catch {
      return `[url:${stableHash(match)}]`
    }
  })
  out = out.replace(PHONE_PATTERN, (match) => `[phone:${stableHash(match)}]`)
  out = out.replace(NAME_PATTERN, (match) => `[name:${stableHash(match)}]`)
  return out.replace(/\s+/g, ' ').trim()
}

export function suggestReplyIntentLabels(text: unknown): ReplyIntentSuggestedLabels {
  const raw = String(text || '')
  const lower = raw.toLowerCase()
  const schedulingIntent = SCHEDULING_PATTERNS.some((pattern) => pattern.test(lower))
  const ooo = OUT_OF_OFFICE_PHRASES.some((phrase) => lower.includes(phrase))
  const notInterested = NOT_INTERESTED_PHRASES.some((phrase) => lower.includes(phrase))
  const genericFollowup = FOLLOW_UP_PHRASES.some((phrase) => lower.includes(phrase))

  return {
    scheduling_intent: schedulingIntent,
    ooo,
    not_interested: notInterested,
    interested: schedulingIntent || (/\b(interested|sounds good|tell me more)\b/i.test(raw) && !notInterested),
    needs_followup: genericFollowup && !schedulingIntent && !notInterested,
  }
}

export function normalizeReviewStatus(value: unknown): ReplyIntentReviewStatus {
  if (value === 'reviewed' || value === 'unsure' || value === 'skipped') return value
  return 'pending'
}

export function toReplyIntentQueueItem(
  source: OutreachReplySourceRow,
  review?: Partial<ReplyIntentReviewRow> | null
): ReplyIntentQueueItem {
  const redactedReply = review?.redacted_reply || redactReplyText(source.reply_content)
  const suggestedLabels = normalizeSuggestedLabels(review?.suggested_labels, suggestReplyIntentLabels(redactedReply))

  return {
    source_id: source.id,
    source_table: 'outreach_queue',
    source_hash: review?.source_hash || stableHash(source.id),
    reply_hash: review?.reply_hash || stableHash(source.reply_content || redactedReply),
    channel: source.channel ?? review?.channel ?? null,
    replied_at: source.replied_at ?? review?.replied_at ?? source.created_at ?? null,
    outreach_status: source.status ?? review?.outreach_status ?? null,
    sequence_step: source.sequence_step ?? review?.sequence_step ?? null,
    redacted_reply: redactedReply,
    suggested_labels: suggestedLabels,
    review_status: normalizeReviewStatus(review?.review_status),
    human_scheduling_intent:
      typeof review?.human_scheduling_intent === 'boolean' ? review.human_scheduling_intent : null,
    notes: typeof review?.notes === 'string' ? review.notes : '',
    reviewed_at: review?.reviewed_at ?? null,
    existing_review_id: review?.id ?? null,
  }
}

export function buildReviewUpsertPayload(args: {
  source: OutreachReplySourceRow
  reviewStatus: ReplyIntentReviewStatus
  humanSchedulingIntent: boolean | null
  notes?: string | null
  reviewedBy: string
  reviewedAt?: string
}) {
  const redactedReply = redactReplyText(args.source.reply_content)
  const reviewedAt = args.reviewedAt || new Date().toISOString()
  const isReviewed = args.reviewStatus === 'reviewed'

  return {
    source_table: 'outreach_queue' as const,
    source_id: args.source.id,
    source_hash: stableHash(args.source.id),
    reply_hash: stableHash(args.source.reply_content || redactedReply),
    channel: args.source.channel ?? null,
    replied_at: args.source.replied_at ?? args.source.created_at ?? null,
    outreach_status: args.source.status ?? null,
    sequence_step: args.source.sequence_step ?? null,
    redacted_reply: redactedReply,
    suggested_labels: suggestReplyIntentLabels(redactedReply),
    review_status: args.reviewStatus,
    human_scheduling_intent: isReviewed ? args.humanSchedulingIntent : null,
    notes: typeof args.notes === 'string' ? args.notes.slice(0, 2000) : '',
    reviewed_by: args.reviewedBy,
    reviewed_at: reviewedAt,
  }
}

export function normalizeSuggestedLabels(
  value: unknown,
  fallback: ReplyIntentSuggestedLabels = suggestReplyIntentLabels('')
): ReplyIntentSuggestedLabels {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  const record = value as Record<string, unknown>
  return {
    scheduling_intent: Boolean(record.scheduling_intent),
    ooo: Boolean(record.ooo),
    not_interested: Boolean(record.not_interested),
    interested: Boolean(record.interested),
    needs_followup: Boolean(record.needs_followup),
  }
}
