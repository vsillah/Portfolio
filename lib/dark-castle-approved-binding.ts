import { SOCIAL_CONTENT_DECISION_RECEIPT_KEYS } from '@/lib/social-content-decision-receipts'
import { DARK_CASTLE_COPY_CALENDAR_ID, DARK_CASTLE_COPY_CONTENT_ID } from '@/lib/dark-castle-copy-review-binding'

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const value = (input: unknown) => typeof input === 'string' ? input.trim() : ''
const sameTime = (a: unknown, b: unknown) => Boolean(value(a) && value(b) && Date.parse(value(a)) === Date.parse(value(b)))

export type ApprovedArtifactIdentity = {
  contentVersion: string; masterSha256: string; masterPath: string
  thumbnailSha256: string; thumbnailPath: string; thumbnailDirection: string
  selectionReceiptId: string; descriptionReceiptId: string; evidenceReceiptId: string
}

export function inspectDarkCastleApprovedBinding(
  item: Record<string, unknown> | null,
  calendars: Record<string, unknown>[],
  approved: ApprovedArtifactIdentity,
  now = new Date().toISOString(),
) {
  const blockers: string[] = []
  const rag = record(item?.rag_context)
  if (approved.thumbnailDirection !== 'C' || !approved.masterSha256 || !approved.thumbnailSha256
    || !approved.selectionReceiptId) blockers.push('Approved media or Direction C identity mismatch.')
  const description = record(rag?.youtube_description_receipt)
  const evidence = record(rag?.description_evidence_reconciliation_receipt)
  if (item?.id !== DARK_CASTLE_COPY_CONTENT_ID || item?.platform !== 'youtube' || item?.status !== 'draft'
    || rag?.content_version !== approved.contentVersion) blockers.push('Canonical record or content version mismatch.')
  if (calendars.length !== 1 || calendars[0]?.id !== DARK_CASTLE_COPY_CALENDAR_ID
    || calendars[0]?.social_content_id !== DARK_CASTLE_COPY_CONTENT_ID
    || ['completed', 'cancelled'].includes(value(calendars[0]?.due_status))) blockers.push('Canonical calendar identity is missing or ambiguous.')
  if (value(description?.receipt_id) !== approved.descriptionReceiptId
    || value(description?.social_content_id) !== DARK_CASTLE_COPY_CONTENT_ID
    || value(description?.content_version) !== approved.contentVersion
    || value(description?.description_sha256) !== value(item?.description_sha256)) blockers.push('Description receipt or saved description hash mismatch.')
  if (value(evidence?.receipt_id) !== approved.evidenceReceiptId
    || value(evidence?.social_content_id) !== DARK_CASTLE_COPY_CONTENT_ID
    || value(evidence?.content_version) !== approved.contentVersion
    || value(evidence?.status) !== 'passed'
    || value(evidence?.evidence_input_fingerprint) !== value(description?.evidence_input_fingerprint)) blockers.push('Evidence reconciliation receipt mismatch.')
  if (item?.video_url != null && item.video_url !== approved.masterPath
    || item?.image_url != null && item.image_url !== approved.thumbnailPath) blockers.push('Canonical media points to another asset.')
  const masterBinding = record(rag?.dark_castle_master_binding)
  const thumbnailBinding = record(rag?.dark_castle_thumbnail_binding)
  if (rag?.dark_castle_master_binding != null && (value(masterBinding?.sha256) !== approved.masterSha256
    || value(masterBinding?.path) !== approved.masterPath)) blockers.push('Existing master hash or path mismatch.')
  if (rag?.dark_castle_thumbnail_binding != null && (value(thumbnailBinding?.sha256) !== approved.thumbnailSha256
    || value(thumbnailBinding?.path) !== approved.thumbnailPath
    || value(thumbnailBinding?.direction) !== 'C')) blockers.push('Existing thumbnail direction, hash, or path mismatch.')
  if (rag?.current_gate != null && rag.current_gate !== 'copy_review') blockers.push('Copy review is not the current gate.')
  const packet = record(rag?.mobile_decision_review)
  const bundle = record(packet?.source_receipts) ?? record(rag?.copy_review_evidence_receipts)
  const receiptVersion = packet ? packet.source_content_updated_at : item?.updated_at
  if (!bundle) blockers.push('Six persisted copy-review evidence receipts are missing.')
  const seen = new Set<string>()
  for (const key of SOCIAL_CONTENT_DECISION_RECEIPT_KEYS) {
    const receipt = record(bundle?.[key])
    const id = value(receipt?.receipt_id)
    if (!id) { blockers.push(`${key} receipt identity is missing.`); continue }
    if (seen.has(id)) blockers.push(`${key} receipt duplicates another prerequisite.`)
    seen.add(id)
    if (!['approved', 'passed', 'complete'].includes(value(receipt?.status).toLowerCase())) blockers.push(`${key} receipt is pending.`)
    if (!sameTime(receipt?.content_updated_at, receiptVersion)) blockers.push(`${key} receipt version mismatch.`)
    const expiry = receipt?.valid_until ?? receipt?.fresh_until ?? receipt?.expires_at
    if (expiry != null && (!Number.isFinite(Date.parse(value(expiry))) || Date.parse(value(expiry)) <= Date.parse(now))) blockers.push(`${key} receipt expired.`)
  }
  if (rag?.mobile_decision_review != null) {
    if (item?.video_url !== approved.masterPath || item?.image_url !== approved.thumbnailPath
      || !masterBinding || !thumbnailBinding) blockers.push('Existing packet lacks the exact media binding.')
    if (value(packet?.content_id) !== DARK_CASTLE_COPY_CONTENT_ID || value(packet?.current_gate) !== 'copy_review'
      || !sameTime(packet?.content_updated_at, item?.updated_at) || !value(packet?.work_item_id)
      || !value(packet?.approval_id) || !value(packet?.run_id)) blockers.push('Existing Decision Queue packet is stale or malformed.')
  }
  return { ready: blockers.length === 0, blockers, contentUpdatedAt: value(item?.updated_at),
    packetPrepared: rag?.mobile_decision_review != null, externalExecution: false as const }
}
