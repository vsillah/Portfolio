import type { SocialContentItem } from '@/lib/social-content'
import {
  getSocialContentDecisionReviewPacket,
  isSocialContentDecision,
} from '@/lib/social-content-decision-receipts'

export type VerifiedSocialContentDecisionReceipt = {
  receipt_id: string
  decision: 'approve' | 'request_revision' | 'hold'
  reviewed_content_updated_at: string
  next_gate: string
  verified: true
  artifact_manifest_snapshot: {
    manifest_id: string
    manifest_hash: string
    content_version: string
  } | null
}

type ReceiptQueryResult = {
  data: unknown
  error?: unknown
}

type ReceiptReader = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<ReceiptQueryResult>
      }
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizedTimestamp(value: unknown): string | null {
  const timestamp = Date.parse(asString(value))
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

export async function readVerifiedSocialContentDecisionReceipt(
  reader: ReceiptReader,
  item: Pick<SocialContentItem, 'id' | 'updated_at' | 'rag_context'>,
): Promise<VerifiedSocialContentDecisionReceipt | null> {
  const ragContext = asRecord(item.rag_context)
  const packet = getSocialContentDecisionReviewPacket(item)
  const receiptId = asString(ragContext?.latest_internal_decision_receipt_id)
  const recordedDecision = asString(ragContext?.latest_internal_decision)
  const currentGate = asString(ragContext?.current_gate)
  if (!packet || !receiptId || !isSocialContentDecision(recordedDecision) || !currentGate) return null

  const packetVersion = normalizedTimestamp(packet.content_updated_at)
  const itemVersion = normalizedTimestamp(item.updated_at)
  if (!packetVersion || !itemVersion || packetVersion === itemVersion) return null

  const expectedGate = recordedDecision === 'approve'
    ? packet.next_gate
    : recordedDecision === 'request_revision'
      ? 'copy_revision'
      : packet.current_gate
  if (currentGate !== expectedGate) return null

  const { data, error } = await reader
    .from('social_content_decision_receipts')
    .select('id, social_content_id, agent_run_id, agent_approval_id, agent_work_item_id, content_updated_at, decision, current_gate, next_internal_gate, candidate_projection')
    .eq('id', receiptId)
    .maybeSingle()
  const row = asRecord(data)
  if (error || !row) return null

  const rowDecision = asString(row.decision)
  const rowVersion = normalizedTimestamp(row.content_updated_at)
  const packetProjection = asRecord(packet.candidate_projection)
  const packetManifest = asRecord(packetProjection?.artifact_evidence_manifest)
  const rowProjection = asRecord(row.candidate_projection)
  const rowManifest = asRecord(rowProjection?.artifact_evidence_manifest)
  if (
    asString(row.id) !== receiptId
    || asString(row.social_content_id) !== item.id
    || asString(row.agent_run_id) !== packet.run_id
    || asString(row.agent_approval_id) !== packet.approval_id
    || asString(row.agent_work_item_id) !== packet.work_item_id
    || rowVersion !== packetVersion
    || rowDecision !== recordedDecision
    || asString(row.current_gate) !== packet.current_gate
    || asString(row.next_internal_gate) !== currentGate
    || asString(rowManifest?.manifest_id) !== asString(packetManifest?.manifest_id)
    || asString(rowManifest?.manifest_hash) !== asString(packetManifest?.manifest_hash)
    || normalizedTimestamp(rowManifest?.content_version) !== normalizedTimestamp(packetManifest?.content_version)
  ) {
    return null
  }

  return {
    receipt_id: receiptId,
    decision: recordedDecision,
    reviewed_content_updated_at: packetVersion,
    next_gate: currentGate,
    verified: true,
    artifact_manifest_snapshot: packetManifest ? {
      manifest_id: asString(packetManifest.manifest_id),
      manifest_hash: asString(packetManifest.manifest_hash),
      content_version: asString(packetManifest.content_version),
    } : null,
  }
}
