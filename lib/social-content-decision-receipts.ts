import type { SocialContentItem } from '@/lib/social-content'
import { artifactManifestSnapshot, validateArtifactEvidenceManifest, type ArtifactManifestSnapshot } from '@/lib/artifact-evidence-manifest'

export const SOCIAL_CONTENT_DECISION_RECEIPT_KEYS = [
  'source',
  'voice',
  'framework',
  'privacy',
  'visual',
  'challenger',
] as const

export const SOCIAL_CONTENT_DECISIONS = ['approve', 'request_revision', 'hold'] as const

export type SocialContentDecisionReceiptKey = (typeof SOCIAL_CONTENT_DECISION_RECEIPT_KEYS)[number]
export type SocialContentDecision = (typeof SOCIAL_CONTENT_DECISIONS)[number]

export type SocialContentEvidenceReceipt = {
  receipt_id: string
  status: string
  content_updated_at: string
}

export type SocialContentDecisionReviewPacket = {
  version: 'social-content-decision-review/v1'
  approval_id: string
  run_id: string
  work_item_id: string
  content_id: string
  content_updated_at: string
  current_gate: string
  next_gate: string
  receipts: Record<SocialContentDecisionReceiptKey, SocialContentEvidenceReceipt>
  candidate_projection?: Record<string, unknown> | null
}

export type SocialContentDecisionReadiness = {
  ready: boolean
  stale: boolean
  blockers: string[]
  packet: SocialContentDecisionReviewPacket | null
  recorded_decision: SocialContentRecordedDecision | null
}

export type SocialContentRecordedDecision = {
  receipt_id: string
  decision: SocialContentDecision
  reviewed_content_updated_at: string
  current_content_updated_at: string
  next_gate: string
  artifact_manifest_snapshot?: {
    manifest_id: string
    manifest_hash: string
    content_version: string
    evaluation_receipt_version: string | null
    evaluation_receipt_ids: string[]
  } | null
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string').sort() : []
}

function manifestSnapshotMatches(value: Record<string, unknown> | null, expected: ArtifactManifestSnapshot): boolean {
  return stringValue(value?.manifest_id) === expected.manifest_id
    && stringValue(value?.manifest_hash) === expected.manifest_hash
    && normalizeTimestamp(stringValue(value?.content_version)) === normalizeTimestamp(expected.content_version)
    && stringValue(value?.evaluation_receipt_version) === stringValue(expected.evaluation_receipt_version)
    && JSON.stringify(stringArray(value?.evaluation_receipt_ids)) === JSON.stringify([...expected.evaluation_receipt_ids].sort())
}

function requiresArtifactEvidenceManifest(
  ragContext: Record<string, unknown> | null,
  packetManifestSnapshot: Record<string, unknown> | null,
): boolean {
  const qaFixture = recordValue(ragContext?.qa_fixture)
  return Boolean(
    packetManifestSnapshot
    || ragContext?.artifact_evidence_required === true
    || stringValue(ragContext?.artifact_video_adaptation_id)
    || recordValue(ragContext?.approved_video_packet)
    || recordValue(ragContext?.social_video_review_package)
    || stringValue(qaFixture?.kind) === 'channel_native_video_review',
  )
}

function normalizeTimestamp(value: string): string | null {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function parseEvidenceReceipt(value: unknown): SocialContentEvidenceReceipt | null {
  const record = recordValue(value)
  if (!record) return null
  const receiptId = stringValue(record.receipt_id)
  const status = stringValue(record.status).toLowerCase()
  const contentUpdatedAt = stringValue(record.content_updated_at)
  if (!receiptId || !status || !contentUpdatedAt) return null
  return {
    receipt_id: receiptId,
    status,
    content_updated_at: contentUpdatedAt,
  }
}

export function getSocialContentDecisionReviewPacket(
  item: Pick<SocialContentItem, 'id' | 'rag_context'>,
): SocialContentDecisionReviewPacket | null {
  const ragContext = recordValue(item.rag_context)
  const packet = recordValue(ragContext?.mobile_decision_review)
  const receiptsRecord = recordValue(packet?.receipts)
  if (!packet || !receiptsRecord) return null

  const receipts = {} as Record<SocialContentDecisionReceiptKey, SocialContentEvidenceReceipt>
  for (const key of SOCIAL_CONTENT_DECISION_RECEIPT_KEYS) {
    const receipt = parseEvidenceReceipt(receiptsRecord[key])
    if (!receipt) return null
    receipts[key] = receipt
  }

  const version = stringValue(packet.version)
  const approvalId = stringValue(packet.approval_id)
  const runId = stringValue(packet.run_id)
  const workItemId = stringValue(packet.work_item_id)
  const contentId = stringValue(packet.content_id)
  const contentUpdatedAt = stringValue(packet.content_updated_at)
  const currentGate = stringValue(packet.current_gate)
  const nextGate = stringValue(packet.next_gate)
  if (
    version !== 'social-content-decision-review/v1'
    || !approvalId
    || !runId
    || !workItemId
    || !contentId
    || !contentUpdatedAt
    || !currentGate
    || !nextGate
  ) {
    return null
  }

  return {
    version: 'social-content-decision-review/v1',
    approval_id: approvalId,
    run_id: runId,
    work_item_id: workItemId,
    content_id: contentId,
    content_updated_at: contentUpdatedAt,
    current_gate: currentGate,
    next_gate: nextGate,
    receipts,
    candidate_projection: recordValue(packet.candidate_projection),
  }
}

export function getSocialContentDecisionReadiness(
  item: Pick<SocialContentItem, 'id' | 'updated_at' | 'rag_context' | 'recorded_internal_decision_receipt'>,
  evaluationAsOf: string = new Date().toISOString(),
): SocialContentDecisionReadiness {
  const ragContext = recordValue(item.rag_context)
  const rawPacket = recordValue(ragContext?.mobile_decision_review)
  const packet = getSocialContentDecisionReviewPacket(item)
  const blockers: string[] = []

  if (!rawPacket) {
    return {
      ready: false,
      stale: false,
      blockers: ['The central Decision Queue review packet is missing.'],
      packet: null,
      recorded_decision: null,
    }
  }

  if (!packet) {
    return {
      ready: false,
      stale: false,
      blockers: ['The central Decision Queue review packet is incomplete or malformed.'],
      packet: null,
      recorded_decision: null,
    }
  }

  const itemVersion = normalizeTimestamp(item.updated_at)
  const packetVersion = normalizeTimestamp(packet.content_updated_at)
  const youtubeFinal = stringValue(rawPacket?.platform) === 'youtube'
    && packet.current_gate === 'platform_submission'
  const sourceVersion = youtubeFinal
    ? normalizeTimestamp(stringValue(recordValue(recordValue(rawPacket?.source_receipts)?.source)?.content_updated_at))
    : packetVersion
  const beforePreparation = youtubeFinal
    ? normalizeTimestamp(stringValue(rawPacket?.prepared_from_content_updated_at))
    : null
  if (youtubeFinal && !beforePreparation) {
    blockers.push('The final YouTube packet is missing its preparation source version.')
  }
  if (youtubeFinal && sourceVersion && beforePreparation && sourceVersion > beforePreparation) {
    blockers.push('The final YouTube receipt version is newer than the source row.')
  }
  if (youtubeFinal && JSON.stringify(rawPacket?.source_receipts) !== JSON.stringify(rawPacket?.receipts)) {
    blockers.push('The final YouTube packet does not preserve its approved source receipts.')
  }
  const stale = packet.content_id !== item.id || !itemVersion || !packetVersion || itemVersion !== packetVersion
  if (packet.content_id !== item.id) blockers.push('The packet is bound to a different Social Content item.')

  const packetManifestSnapshot = recordValue(packet.candidate_projection?.artifact_evidence_manifest)
  const rawManifest = ragContext?.artifact_evidence_manifest
  const artifactManifestRequired = requiresArtifactEvidenceManifest(ragContext, packetManifestSnapshot)
  const manifestValidation = artifactManifestRequired || rawManifest != null
    ? validateArtifactEvidenceManifest(rawManifest, item.updated_at, evaluationAsOf)
    : null
  const expectedManifestSnapshot = rawManifest != null ? artifactManifestSnapshot(rawManifest) : null
  if (manifestValidation && !manifestValidation.ready) blockers.push(...manifestValidation.blockers)
  if (expectedManifestSnapshot) {
    if (!manifestSnapshotMatches(packetManifestSnapshot, expectedManifestSnapshot)) {
      blockers.push('The Decision Queue packet does not snapshot the current artifact manifest identity and hash.')
    }
  }

  for (const key of SOCIAL_CONTENT_DECISION_RECEIPT_KEYS) {
    const receipt = packet.receipts[key]
    if (!['approved', 'passed', 'complete'].includes(receipt.status)) {
      blockers.push(`${key[0].toUpperCase()}${key.slice(1)} receipt has not passed.`)
    }
    const receiptVersion = normalizeTimestamp(receipt.content_updated_at)
    if (!sourceVersion || !receiptVersion || receiptVersion !== sourceVersion) {
      blockers.push(`${key[0].toUpperCase()}${key.slice(1)} receipt is stale for this packet.`)
    }
  }

  const latestReceiptId = stringValue(ragContext?.latest_internal_decision_receipt_id)
  const latestDecision = stringValue(ragContext?.latest_internal_decision)
  const currentGate = stringValue(ragContext?.current_gate)
  const verifiedReceipt = recordValue(item.recorded_internal_decision_receipt)
  const verifiedReceiptId = stringValue(verifiedReceipt?.receipt_id)
  const verifiedDecision = stringValue(verifiedReceipt?.decision)
  const verifiedReviewedVersion = normalizeTimestamp(stringValue(verifiedReceipt?.reviewed_content_updated_at))
  const verifiedNextGate = stringValue(verifiedReceipt?.next_gate)
  const verifiedManifestSnapshot = recordValue(verifiedReceipt?.artifact_manifest_snapshot)
  const expectedRecordedGate = latestDecision === 'approve'
    ? packet.next_gate
    : packet.current_gate
  const recordedDecision = blockers.length === 0
    && packet.content_id === item.id
    && Boolean(itemVersion && packetVersion && itemVersion !== packetVersion)
    && Boolean(latestReceiptId)
    && isSocialContentDecision(latestDecision)
    && currentGate === expectedRecordedGate
    && verifiedReceipt?.verified === true
    && verifiedReceiptId === latestReceiptId
    && verifiedDecision === latestDecision
    && verifiedReviewedVersion === packetVersion
    && verifiedNextGate === currentGate
    ? {
        receipt_id: latestReceiptId,
        decision: latestDecision,
        reviewed_content_updated_at: packetVersion!,
        current_content_updated_at: itemVersion!,
        next_gate: currentGate,
        artifact_manifest_snapshot: verifiedManifestSnapshot ? {
          manifest_id: stringValue(verifiedManifestSnapshot.manifest_id),
          manifest_hash: stringValue(verifiedManifestSnapshot.manifest_hash),
          content_version: stringValue(verifiedManifestSnapshot.content_version),
          evaluation_receipt_version: stringValue(verifiedManifestSnapshot.evaluation_receipt_version) || null,
          evaluation_receipt_ids: stringArray(verifiedManifestSnapshot.evaluation_receipt_ids),
        } : null,
      }
    : null

  if ((latestReceiptId || latestDecision) && stale && !recordedDecision) {
    blockers.push('The recorded decision receipt could not be verified against the immutable receipt store.')
  }
  if ((!itemVersion || !packetVersion || itemVersion !== packetVersion) && !recordedDecision) {
    blockers.push('The review packet is stale for the current content version.')
  }

  return {
    ready: blockers.length === 0 && !stale,
    stale,
    blockers,
    packet,
    recorded_decision: recordedDecision,
  }
}

export function isSocialContentDecision(value: unknown): value is SocialContentDecision {
  return typeof value === 'string' && SOCIAL_CONTENT_DECISIONS.includes(value as SocialContentDecision)
}

export function socialContentDecisionIdempotencyKey(input: {
  approvalId: string
  contentUpdatedAt: string
  decision: SocialContentDecision
  currentGate?: string
}) {
  return [
    'social-content-decision',
    input.approvalId,
    encodeURIComponent(new Date(input.contentUpdatedAt).toISOString()),
    input.currentGate || 'unbound-gate',
    input.decision,
  ].join(':')
}

export function socialContentDecisionLabel(decision: SocialContentDecision) {
  if (decision === 'approve') return 'Approve'
  if (decision === 'request_revision') return 'Request revision'
  return 'Hold'
}
