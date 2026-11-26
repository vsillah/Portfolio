import { createHash } from 'node:crypto'
import { rawResponseSha256 } from './attributable-performance-evidence'

// This contract consumes an owning-store SELECT snapshot. It has no persistence
// dependency or path from a verified result to a production action.
const DIMENSIONS = ['report', 'policy', 'case', 'artifact', 'evidence', 'content',
  'channel', 'format', 'cohort', 'performance', 'source', 'repair'] as const
const SHA = /^[a-f0-9]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : object(value) ? Object.fromEntries(Object.entries(object(value)!).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const validTime = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null
const safePath = (value: unknown) => typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !value.split('/').includes('..')

export type CalibrationStoreSnapshot = {
  id: string
  agent_approval_id: string
  authority_identity: string
  authority_version: string
  decision: string
  decided_at: string
  valid_until: string
  receipt_sha256: string
  receipt_payload: Record<string, unknown>
  approval_snapshot: Record<string, unknown>
  provenance: Record<string, unknown>
  rollback_metadata: Record<string, unknown>
  [key: string]: unknown
}

export type CalibrationParentSnapshot = {
  id: string
  approval_type: string
  status: string
  decided_by_user_id: string | null
  decided_at: string | null
  metadata: Record<string, unknown>
}

export type CalibrationSourceFixture = {
  kind: 'synthetic' | 'approved_historical'
  source_path: string
  raw_response: unknown
  source_version: string
  expires_at: string
  privacy_cleared: boolean
  rights_cleared: boolean
  approval_receipt_id: string | null
  rollback_metadata: Record<string, unknown>
}

export type CalibrationAuthorityResult = {
  contract_version: 'calibration-approval-store-verification-v1'
  status: 'verified' | 'blocked'
  blockers: string[]
  receipt_id: string | null
  receipt_sha256: string | null
  verification_sha256: string
  scope: 'internal_read_only_review'
  production_writes_enabled: false
  packet_linkage_enabled: false
  label_promotion_enabled: false
  notification_enabled: false
  policy_changes_enabled: false
  external_actions_enabled: false
}

/** SHA-256 of the canonical JSON payload, excluding its self-referential digest. */
export function calibrationAuthorityPayloadSha256(payload: Record<string, unknown>): string {
  const { receipt_sha256: _digest, ...body } = payload
  return hash(body)
}

/** Verify an exact SELECT snapshot and retained fixture; never infer authority from a caller flag. */
export function verifyCalibrationApprovalStore(input: {
  rows: CalibrationStoreSnapshot[]
  parent: CalibrationParentSnapshot | null
  expected_payload: Record<string, unknown>
  source: CalibrationSourceFixture
  evaluated_at: string
}): CalibrationAuthorityResult {
  const blockers: string[] = []
  const expected = input.expected_payload
  const row = input.rows[0]
  const parent = input.parent
  const source = input.source
  const now = validTime(input.evaluated_at)
  if (input.rows.length !== 1 || !row) blockers.push('Exact owning-store receipt is missing, duplicate, or ambiguous.')
  if (!parent || !row || parent.id !== row.agent_approval_id || parent.approval_type !== 'attributable_calibration_integration'
    || parent.status !== 'approved' || parent.decided_by_user_id !== row.authority_identity
    || validTime(parent.decided_at) !== validTime(row.decided_at)
    || !same(object(parent.metadata)?.calibration_integration_authority, row.receipt_payload)
    || !same(row.approval_snapshot, { id: parent.id, approval_type: parent.approval_type, status: parent.status,
      decided_by_user_id: parent.decided_by_user_id, decided_at: parent.decided_at })) {
    blockers.push('Owning approval is missing, changed, revoked, or superseded.')
  }
  if (row && (!UUID.test(row.id) || !UUID.test(row.agent_approval_id) || !UUID.test(row.authority_identity)
    || row.id !== expected.decision_receipt_id || row.authority_identity !== expected.authority_identity
    || row.authority_version !== expected.authority_version || row.decision !== 'allow_synthetic_review_candidate'
    || row.decision !== expected.decision)) blockers.push('Stored receipt identity or decision differs.')
  if (row && !same(row.receipt_payload, expected)) blockers.push('Stored receipt payload differs.')
  if (row && (!same(row.provenance, expected.provenance)
    || !same(row.rollback_metadata, expected.rollback_metadata))) blockers.push('Stored provenance or rollback differs.')
  if (row && (!SHA.test(row.receipt_sha256) || row.receipt_sha256 !== expected.receipt_sha256
    || row.receipt_sha256 !== row.receipt_payload.receipt_sha256
    || row.receipt_sha256 !== calibrationAuthorityPayloadSha256(row.receipt_payload))) {
    blockers.push('Immutable receipt content hash differs.')
  }
  for (const dimension of DIMENSIONS) {
    const version = `${dimension}_version`, digest = `${dimension}_sha256`
    if (!row || typeof expected[version] !== 'string' || !expected[version]
      || typeof expected[digest] !== 'string' || !SHA.test(expected[digest])
      || row[version] !== expected[version] || row[digest] !== expected[digest]
      || row.receipt_payload[version] !== expected[version] || row.receipt_payload[digest] !== expected[digest]) {
      blockers.push(`Exact ${dimension} version/hash binding differs.`)
    }
  }
  if (!row || expected.platform !== expected.channel || expected.channel !== row.receipt_payload.channel
    || expected.format !== row.receipt_payload.format || !expected.platform || !expected.format) {
    blockers.push('Exact channel or format boundary differs.')
  }
  const decided = validTime(row?.decided_at), until = validTime(row?.valid_until)
  if (now === null || decided === null || until === null || decided > now || until <= now || until <= decided
    || validTime(expected.decided_at) !== decided || validTime(expected.valid_until) !== until) {
    blockers.push('Decision time is stale, future-dated, or changed.')
  }
  const exclusions = expected.exclusions
  const provenance = object(expected.provenance)
  if (expected.privacy_cleared !== true || expected.rights_cleared !== true
    || !Array.isArray(exclusions) || exclusions.length === 0
    || exclusions.some(item => typeof item !== 'string' || !item.trim())
    || new Set(exclusions).size !== exclusions.length
    || !safePath(expected.source_path) || provenance?.source_path !== expected.source_path
    || provenance?.source_kind !== 'synthetic'
    || provenance?.source_version !== expected.source_version
    || provenance?.source_sha256 !== expected.source_sha256
    || provenance?.source_expires_at !== source.expires_at
    || !object(expected.rollback_metadata) || !Object.keys(object(expected.rollback_metadata)!).length) {
    blockers.push('Privacy, rights, exclusion, provenance, or rollback binding is incomplete.')
  }
  if (!safePath(source.source_path) || source.source_path !== expected.source_path
    || source.source_version !== expected.source_version || rawResponseSha256(source.raw_response) !== expected.source_sha256
    || source.kind !== provenance?.source_kind || source.source_path !== provenance?.source_path
    || source.source_version !== provenance?.source_version
    || rawResponseSha256(source.raw_response) !== provenance?.source_sha256
    || source.expires_at !== provenance?.source_expires_at
    || source.privacy_cleared !== true || source.rights_cleared !== true
    || validTime(source.expires_at) === null || now === null || validTime(source.expires_at)! <= now
    || !same(source.rollback_metadata, expected.rollback_metadata)
    || source.kind !== 'synthetic' || source.approval_receipt_id !== null) {
    blockers.push('Retained source, approval, expiry, privacy, rights, or rollback differs.')
  }
  const body = {
    contract_version: 'calibration-approval-store-verification-v1' as const,
    status: blockers.length ? 'blocked' as const : 'verified' as const,
    blockers, receipt_id: blockers.length ? null : row.id,
    receipt_sha256: blockers.length ? null : row.receipt_sha256,
    scope: 'internal_read_only_review' as const,
    production_writes_enabled: false as const, packet_linkage_enabled: false as const,
    label_promotion_enabled: false as const, notification_enabled: false as const,
    policy_changes_enabled: false as const, external_actions_enabled: false as const,
  }
  return { ...body, verification_sha256: hash(body) }
}
