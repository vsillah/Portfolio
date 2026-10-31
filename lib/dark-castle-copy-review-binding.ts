import { SOCIAL_CONTENT_DECISION_RECEIPT_KEYS } from '@/lib/social-content-decision-receipts'

export const DARK_CASTLE_COPY_CONTENT_ID = 'c12378f2-36de-4bf7-8c5d-0ce754e727eb'
export const DARK_CASTLE_COPY_CALENDAR_ID = '7b1b202c-eb24-4724-bc8e-313b07546884'

type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function instant(value: unknown): number | null {
  const parsed = Date.parse(text(value))
  return Number.isFinite(parsed) ? parsed : null
}

export type CopyBindingItem = { id: string; updated_at: string; rag_context: unknown }
export type CopyBindingCalendar = { id: string; social_content_id: string; due_status: string | null }

function inspectReceipts(bundle: unknown, expectedVersion: unknown, asOf: string, blockers: string[]) {
  const receipts = record(bundle)
  if (!receipts) blockers.push('The persisted copy-review evidence receipt bundle is missing.')
  const version = instant(expectedVersion)
  const now = instant(asOf)
  const seen = new Set<string>()
  for (const key of SOCIAL_CONTENT_DECISION_RECEIPT_KEYS) {
    const receipt = record(receipts?.[key])
    const id = text(receipt?.receipt_id)
    if (!id) {
      blockers.push(`${key} receipt identity is missing.`)
      continue
    }
    if (seen.has(id)) blockers.push(`${key} receipt identity duplicates another prerequisite.`)
    seen.add(id)
    if (!['approved', 'passed', 'complete'].includes(text(receipt?.status).toLowerCase())) {
      blockers.push(`${key} receipt is pending or unapproved.`)
    }
    if (version === null || instant(receipt?.content_updated_at) !== version) {
      blockers.push(`${key} receipt does not match the exact content version.`)
    }
    const expiry = receipt?.valid_until ?? receipt?.fresh_until ?? receipt?.expires_at
    if (expiry != null && (instant(expiry) === null || now === null || instant(expiry)! <= now)) {
      blockers.push(`${key} receipt is expired or has an invalid expiry.`)
    }
  }
}

export function inspectDarkCastleCopyReviewBinding(
  item: CopyBindingItem | null,
  calendars: CopyBindingCalendar[],
  asOf = new Date().toISOString(),
) {
  const blockers: string[] = []
  if (!item || item.id !== DARK_CASTLE_COPY_CONTENT_ID) blockers.push('The exact Dark Castle Social Content record is missing.')
  if (calendars.length !== 1 || calendars[0]?.id !== DARK_CASTLE_COPY_CALENDAR_ID
    || calendars[0]?.social_content_id !== DARK_CASTLE_COPY_CONTENT_ID) {
    blockers.push('Exactly one canonical Dark Castle calendar item must be linked.')
  } else if (['completed', 'cancelled'].includes(calendars[0].due_status || '')) {
    blockers.push('The canonical calendar item is completed or cancelled.')
  }

  const context = record(item?.rag_context)
  const packet = record(context?.mobile_decision_review)
  if (context?.mobile_decision_review != null) {
    if (!packet || text(packet.version) !== 'social-content-decision-review/v1'
      || text(packet.content_id) !== DARK_CASTLE_COPY_CONTENT_ID
      || text(packet.current_gate) !== 'copy_review'
      || instant(packet.content_updated_at) !== instant(item?.updated_at)
      || !text(packet.work_item_id) || !text(packet.approval_id) || !text(packet.run_id)) {
      blockers.push('The existing Decision Queue packet is stale or malformed.')
    }
    inspectReceipts(packet?.source_receipts, packet?.source_content_updated_at, asOf, blockers)
    if (!record(packet?.candidate_projection)) blockers.push('The existing Decision Queue candidate projection is missing.')
    return { ready: blockers.length === 0, blockers, content_id: DARK_CASTLE_COPY_CONTENT_ID,
      calendar_item_id: DARK_CASTLE_COPY_CALENDAR_ID, content_updated_at: item?.updated_at ?? null,
      replay_candidate: true, external_execution: false as const }
  }
  if (text(context?.current_gate) !== 'copy_review') blockers.push('The content current gate is not copy_review.')
  inspectReceipts(context?.copy_review_evidence_receipts, item?.updated_at, asOf, blockers)
  if (!record(context?.copy_review_candidate_projection)) {
    blockers.push('The persisted copy-review candidate projection is missing.')
  }
  return { ready: blockers.length === 0, blockers, content_id: DARK_CASTLE_COPY_CONTENT_ID,
    calendar_item_id: DARK_CASTLE_COPY_CALENDAR_ID, content_updated_at: item?.updated_at ?? null,
    replay_candidate: false, external_execution: false as const }
}
