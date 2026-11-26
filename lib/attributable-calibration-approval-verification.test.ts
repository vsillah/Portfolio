import { describe, expect, it, vi } from 'vitest'
import { rawResponseSha256 } from './attributable-performance-evidence'
import { calibrationAuthorityPayloadSha256, verifyCalibrationApprovalStore,
  type CalibrationParentSnapshot, type CalibrationSourceFixture,
  type CalibrationStoreSnapshot } from './attributable-calibration-approval-verification'

const dimensions = ['report', 'policy', 'case', 'artifact', 'evidence', 'content',
  'channel', 'format', 'cohort', 'performance', 'source', 'repair'] as const
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const evaluated_at = '2026-11-26T12:00:00.000Z'
const source: CalibrationSourceFixture = {
  kind: 'synthetic', source_path: 'fixtures/calibration.json', raw_response: { views: 200, impressions: 1000 },
  source_version: 'source-v1', expires_at: '2026-11-30T00:00:00.000Z',
  privacy_cleared: true, rights_cleared: true, approval_receipt_id: null,
  rollback_metadata: { action: 'discard_derived_result', preserve_receipts: true },
}

function setup() {
  const payload: Record<string, unknown> = {
    decision_receipt_id: id(1), authority_identity: id(2), authority_version: 'authority-v1',
    decision: 'allow_synthetic_review_candidate', policy_id: 'synthetic-policy',
    policy_approval_receipt_id: id(4), case_id: 'synthetic-case',
    platform: 'youtube', channel: 'youtube', format: 'shorts',
    decided_at: '2026-11-26T11:00:00.000Z', valid_until: '2026-11-30T00:00:00.000Z',
    privacy_cleared: true, rights_cleared: true,
    exclusions: ['live data', 'external execution'], source_path: source.source_path,
    provenance: { source_kind: source.kind, source_path: source.source_path,
      source_version: source.source_version, source_sha256: rawResponseSha256(source.raw_response),
      source_expires_at: source.expires_at },
    rollback_metadata: source.rollback_metadata,
  }
  for (const [index, dimension] of dimensions.entries()) {
    payload[`${dimension}_version`] = `${dimension}-v1`
    payload[`${dimension}_sha256`] = String(index.toString(16)).repeat(64)
  }
  payload.source_version = source.source_version
  payload.source_sha256 = rawResponseSha256(source.raw_response)
  payload.receipt_sha256 = calibrationAuthorityPayloadSha256(payload)
  const parent: CalibrationParentSnapshot = {
    id: id(3), approval_type: 'attributable_calibration_integration', status: 'approved',
    decided_by_user_id: id(2), decided_at: payload.decided_at as string,
    metadata: { calibration_integration_authority: structuredClone(payload) },
  }
  const row: CalibrationStoreSnapshot = {
    id: id(1), agent_approval_id: id(3), authority_identity: id(2),
    authority_version: 'authority-v1', decision: 'allow_synthetic_review_candidate',
    decided_at: payload.decided_at as string, valid_until: payload.valid_until as string,
    receipt_sha256: payload.receipt_sha256 as string, receipt_payload: structuredClone(payload),
    approval_snapshot: { id: parent.id, approval_type: parent.approval_type, status: parent.status,
      decided_by_user_id: parent.decided_by_user_id, decided_at: parent.decided_at },
    provenance: structuredClone(payload.provenance as Record<string, unknown>),
    rollback_metadata: structuredClone(source.rollback_metadata),
  }
  for (const dimension of dimensions) {
    row[`${dimension}_version`] = payload[`${dimension}_version`]
    row[`${dimension}_sha256`] = payload[`${dimension}_sha256`]
  }
  return { rows: [row], parent, expected_payload: payload, source: structuredClone(source), evaluated_at }
}

describe('Phase 5K owning-store read verification', () => {
  it('verifies an exact synthetic SELECT snapshot deterministically with all execution locks off', () => {
    const input = setup(), original = structuredClone(input)
    const first = verifyCalibrationApprovalStore(input)
    expect(first, first.blockers.join('; ')).toMatchObject({ status: 'verified', receipt_id: id(1),
      production_writes_enabled: false, packet_linkage_enabled: false,
      label_promotion_enabled: false, notification_enabled: false,
      policy_changes_enabled: false, external_actions_enabled: false })
    expect(verifyCalibrationApprovalStore(input)).toEqual(first)
    expect(input).toEqual(original)
  })

  it.each([
    ['missing', (v: ReturnType<typeof setup>) => { v.rows = [] }],
    ['duplicate', (v: ReturnType<typeof setup>) => { v.rows.push(structuredClone(v.rows[0])) }],
    ['conflicting', (v: ReturnType<typeof setup>) => { const other = structuredClone(v.rows[0]); other.id = id(9); v.rows.push(other) }],
    ['content hash', (v: ReturnType<typeof setup>) => { v.rows[0].receipt_payload.case_id = 'changed' }],
    ['stored hash', (v: ReturnType<typeof setup>) => { v.rows[0].receipt_sha256 = 'f'.repeat(64) }],
    ['changed replay', (v: ReturnType<typeof setup>) => { v.parent!.metadata.calibration_integration_authority = { ...v.expected_payload, case_id: 'changed' } }],
    ['revoked', (v: ReturnType<typeof setup>) => { v.parent!.status = 'revoked' }],
    ['superseded', (v: ReturnType<typeof setup>) => { v.parent!.status = 'superseded' }],
    ['wrong approval type', (v: ReturnType<typeof setup>) => { v.parent!.approval_type = 'other' }],
    ['wrong authority', (v: ReturnType<typeof setup>) => { v.parent!.decided_by_user_id = id(8) }],
    ['stale', (v: ReturnType<typeof setup>) => { v.evaluated_at = '2026-12-01T00:00:00Z' }],
    ['future', (v: ReturnType<typeof setup>) => { v.evaluated_at = '2026-11-25T00:00:00Z' }],
    ['cross channel', (v: ReturnType<typeof setup>) => { v.expected_payload.channel = 'x' }],
    ['cross format', (v: ReturnType<typeof setup>) => { v.expected_payload.format = 'long_form' }],
    ['version drift', (v: ReturnType<typeof setup>) => { v.expected_payload.artifact_version = 'artifact-v2' }],
    ['hash drift', (v: ReturnType<typeof setup>) => { v.rows[0].cohort_sha256 = 'f'.repeat(64) }],
    ['source drift', (v: ReturnType<typeof setup>) => { v.source.raw_response = { views: 201 } }],
    ['source expired', (v: ReturnType<typeof setup>) => { v.source.expires_at = '2026-11-25T00:00:00Z' }],
    ['caller-extended source expiry', (v: ReturnType<typeof setup>) => { v.source.expires_at = '2026-12-01T00:00:00Z' }],
    ['provenance expiry drift', (v: ReturnType<typeof setup>) => { (v.expected_payload.provenance as Record<string, unknown>).source_expires_at = '2026-12-01T00:00:00Z' }],
    ['provenance kind drift', (v: ReturnType<typeof setup>) => { (v.expected_payload.provenance as Record<string, unknown>).source_kind = 'approved_historical' }],
    ['provenance version drift', (v: ReturnType<typeof setup>) => { (v.expected_payload.provenance as Record<string, unknown>).source_version = 'source-v2' }],
    ['provenance SHA drift', (v: ReturnType<typeof setup>) => { (v.expected_payload.provenance as Record<string, unknown>).source_sha256 = 'f'.repeat(64) }],
    ['historical approval absent', (v: ReturnType<typeof setup>) => { v.source.kind = 'approved_historical' }],
    ['historical claim with an unverified receipt', (v: ReturnType<typeof setup>) => { v.source.kind = 'approved_historical'; v.source.approval_receipt_id = id(5) }],
    ['privacy', (v: ReturnType<typeof setup>) => { v.source.privacy_cleared = false }],
    ['rights', (v: ReturnType<typeof setup>) => { v.expected_payload.rights_cleared = false }],
    ['exclusion', (v: ReturnType<typeof setup>) => { v.expected_payload.exclusions = [] }],
    ['rollback', (v: ReturnType<typeof setup>) => { v.source.rollback_metadata = {} }],
    ['provenance', (v: ReturnType<typeof setup>) => { v.expected_payload.source_path = '../unsafe' }],
  ] as const)('blocks %s without an action path', (_, mutate) => {
    const input = setup(); mutate(input)
    const result = verifyCalibrationApprovalStore(input)
    expect(result.status).toBe('blocked')
    expect(result.blockers.length).toBeGreaterThan(0)
    expect(result.receipt_id).toBeNull()
    expect(result.production_writes_enabled).toBe(false)
    expect(result.packet_linkage_enabled).toBe(false)
    expect(result.label_promotion_enabled).toBe(false)
    expect(result.notification_enabled).toBe(false)
    expect(result.policy_changes_enabled).toBe(false)
    expect(result.external_actions_enabled).toBe(false)
  })

  it('reads no network or environment during fixture verification', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw Error('network forbidden') })
    const env = vi.spyOn(process, 'env', 'get').mockImplementation(() => { throw Error('environment forbidden') })
    try {
      expect(verifyCalibrationApprovalStore(setup()).status).toBe('verified')
      expect(fetch).not.toHaveBeenCalled()
      expect(env).not.toHaveBeenCalled()
    } finally { fetch.mockRestore(); env.mockRestore() }
  })
})
