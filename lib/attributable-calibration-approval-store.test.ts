import { describe, expect, it, vi } from 'vitest'
import { rawResponseSha256 } from './attributable-performance-evidence'
import { calibrationAuthorityPayloadSha256 } from './attributable-calibration-approval-verification'

const calls = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabase', () => ({ supabaseAdmin: { from: calls.from } }))
import { readCalibrationApprovalStore } from './attributable-calibration-approval-store'

function selectRows(data: unknown[]) {
  const query = {
    select: vi.fn(), eq: vi.fn(), limit: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  return query
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const dimensions = ['report', 'policy', 'case', 'artifact', 'evidence', 'content',
  'channel', 'format', 'cohort', 'performance', 'source', 'repair'] as const
function fixture() {
  const source = {
    kind: 'synthetic' as const, source_path: 'fixtures/source.json', raw_response: { views: 20 },
    source_version: 'source-v1', expires_at: '2026-11-30T00:00:00Z',
    privacy_cleared: true, rights_cleared: true, approval_receipt_id: null,
    rollback_metadata: { action: 'discard', preserve_receipts: true },
  }
  const payload: Record<string, unknown> = {
    decision_receipt_id: id(1), authority_identity: id(2), authority_version: 'v1',
    decision: 'allow_synthetic_review_candidate', policy_id: 'synthetic-policy',
    policy_approval_receipt_id: id(4), case_id: 'synthetic-case',
    platform: 'youtube', channel: 'youtube', format: 'shorts',
    decided_at: '2026-11-26T11:00:00Z', valid_until: '2026-11-30T00:00:00Z',
    privacy_cleared: true, rights_cleared: true, exclusions: ['live data', 'external execution'],
    source_path: source.source_path, rollback_metadata: source.rollback_metadata,
    provenance: { source_kind: source.kind, source_path: source.source_path,
      source_version: source.source_version, source_sha256: rawResponseSha256(source.raw_response),
      source_expires_at: source.expires_at },
  }
  for (const [index, dimension] of dimensions.entries()) {
    payload[`${dimension}_version`] = `${dimension}-v1`
    payload[`${dimension}_sha256`] = index.toString(16).repeat(64)
  }
  payload.source_version = source.source_version
  payload.source_sha256 = rawResponseSha256(source.raw_response)
  payload.receipt_sha256 = calibrationAuthorityPayloadSha256(payload)
  const parent = {
    id: id(3), approval_type: 'attributable_calibration_integration', status: 'approved',
    decided_by_user_id: id(2), decided_at: payload.decided_at,
    metadata: { calibration_integration_authority: payload },
  }
  const row: Record<string, unknown> = {
    id: id(1), agent_approval_id: id(3), authority_identity: id(2), authority_version: 'v1',
    decision: payload.decision, decided_at: payload.decided_at, valid_until: payload.valid_until,
    receipt_sha256: payload.receipt_sha256, receipt_payload: payload,
    approval_snapshot: { id: parent.id, approval_type: parent.approval_type, status: parent.status,
      decided_by_user_id: parent.decided_by_user_id, decided_at: parent.decided_at },
    provenance: payload.provenance, rollback_metadata: payload.rollback_metadata,
  }
  for (const dimension of dimensions) {
    row[`${dimension}_version`] = payload[`${dimension}_version`]
    row[`${dimension}_sha256`] = payload[`${dimension}_sha256`]
  }
  return { row, parent, payload, source }
}

describe('Phase 5K store adapter', () => {
  it('uses only exact identity and uniqueness-scope SELECTs and blocks an empty store', async () => {
    calls.from.mockImplementation(() => selectRows([]))
    const result = await readCalibrationApprovalStore({
      receipt_id: '00000000-0000-4000-8000-000000000001',
      expected_payload: {
        decision_receipt_id: '00000000-0000-4000-8000-000000000001',
        report_sha256: 'a'.repeat(64), case_id: 'synthetic-case', case_version: 'v1',
        artifact_version: 'v1', repair_sha256: 'b'.repeat(64),
      },
      source: {
        kind: 'synthetic', source_path: 'fixtures/source.json', raw_response: {}, source_version: 'v1',
        expires_at: '2026-11-30T00:00:00Z', privacy_cleared: true, rights_cleared: true,
        approval_receipt_id: null, rollback_metadata: { action: 'discard' },
      },
      evaluated_at: '2026-11-26T12:00:00Z',
    })
    expect(result.status).toBe('blocked')
    expect(result.receipt_id).toBeNull()
    expect(calls.from).toHaveBeenCalledTimes(2)
    expect(calls.from).toHaveBeenNthCalledWith(1, 'attributable_calibration_integration_receipts')
    expect(calls.from).toHaveBeenNthCalledWith(2, 'attributable_calibration_integration_receipts')
    expect(result.production_writes_enabled).toBe(false)
    expect(result.external_actions_enabled).toBe(false)
  })

  it('reads exact identity, uniqueness scope, and parent to verify a synthetic receipt', async () => {
    calls.from.mockReset()
    const { row, parent, payload, source } = fixture()
    const identity = selectRows([row]), scope = selectRows([row]), approval = selectRows([parent])
    calls.from.mockReturnValueOnce(identity).mockReturnValueOnce(scope).mockReturnValueOnce(approval)
    const result = await readCalibrationApprovalStore({ receipt_id: id(1), expected_payload: payload,
      source, evaluated_at: '2026-11-26T12:00:00Z' })
    expect(result.status, result.blockers.join('; ')).toBe('verified')
    expect(result.receipt_id).toBe(id(1))
    expect(calls.from.mock.calls.map(call => call[0])).toEqual([
      'attributable_calibration_integration_receipts',
      'attributable_calibration_integration_receipts', 'agent_approvals',
    ])
    expect(identity.eq).toHaveBeenCalledWith('id', id(1))
    expect(scope.eq).toHaveBeenCalledWith('report_sha256', payload.report_sha256)
    expect(scope.eq).toHaveBeenCalledWith('repair_sha256', payload.repair_sha256)
    expect(approval.eq).toHaveBeenCalledWith('id', id(3))
  })

  it('blocks a conflicting scope without resolving either parent', async () => {
    calls.from.mockReset()
    const { row, payload, source } = fixture()
    calls.from.mockReturnValueOnce(selectRows([row]))
      .mockReturnValueOnce(selectRows([{ ...row, id: id(9), agent_approval_id: id(8) }]))
    const result = await readCalibrationApprovalStore({ receipt_id: id(1), expected_payload: payload,
      source, evaluated_at: '2026-11-26T12:00:00Z' })
    expect(result.status).toBe('blocked')
    expect(result.receipt_id).toBeNull()
    expect(calls.from).toHaveBeenCalledTimes(2)
  })
})
