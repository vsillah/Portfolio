import { describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabase', () => ({ supabaseAdmin: { from: calls.from } }))
import { readCalibrationApprovalStore } from './attributable-calibration-approval-store'

function emptySelect() {
  const query = {
    select: vi.fn(), eq: vi.fn(), limit: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  return query
}

describe('Phase 5K store adapter', () => {
  it('uses only exact identity and uniqueness-scope SELECTs and blocks an empty store', async () => {
    calls.from.mockImplementation(() => emptySelect())
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
})
