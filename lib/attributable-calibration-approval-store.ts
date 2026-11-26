import { supabaseAdmin } from './supabase'
import { verifyCalibrationApprovalStore, type CalibrationParentSnapshot,
  type CalibrationSourceFixture, type CalibrationStoreSnapshot } from './attributable-calibration-approval-verification'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The only database access in Phase 5K: bounded SELECTs from the owning store and parent. */
export async function readCalibrationApprovalStore(input: {
  receipt_id: string
  expected_payload: Record<string, unknown>
  source: CalibrationSourceFixture
  evaluated_at: string
}) {
  if (!UUID.test(input.receipt_id) || !supabaseAdmin) throw new Error('Calibration approval store is unavailable.')
  const expected = input.expected_payload
  if (expected.decision_receipt_id !== input.receipt_id || typeof expected.report_sha256 !== 'string'
    || typeof expected.case_id !== 'string' || typeof expected.case_version !== 'string'
    || typeof expected.artifact_version !== 'string' || typeof expected.repair_sha256 !== 'string') {
    throw new Error('Exact receipt and scope are required for the read-only lookup.')
  }
  // Query both identity and uniqueness scope. A conflicting second receipt blocks verification.
  const [identity, scope] = await Promise.all([
    supabaseAdmin.from('attributable_calibration_integration_receipts').select('*').eq('id', input.receipt_id).limit(2),
    supabaseAdmin.from('attributable_calibration_integration_receipts').select('*')
      .eq('report_sha256', expected.report_sha256).eq('case_id', expected.case_id)
      .eq('case_version', expected.case_version).eq('artifact_version', expected.artifact_version)
      .eq('repair_sha256', expected.repair_sha256).limit(2),
  ])
  if (identity.error || scope.error) throw new Error('Calibration approval receipt SELECT failed.')
  const rows = [...new Map([...(identity.data ?? []), ...(scope.data ?? [])]
    .map(row => [row.id, row as CalibrationStoreSnapshot])).values()]
  const parentId = rows.length === 1 ? rows[0].agent_approval_id : null
  let parent: CalibrationParentSnapshot | null = null
  if (parentId && UUID.test(parentId)) {
    const result = await supabaseAdmin.from('agent_approvals')
      .select('id,approval_type,status,decided_by_user_id,decided_at,metadata').eq('id', parentId).limit(2)
    if (result.error) throw new Error('Calibration parent approval SELECT failed.')
    if (result.data?.length === 1) parent = result.data[0] as CalibrationParentSnapshot
  }
  return verifyCalibrationApprovalStore({ rows, parent, expected_payload: expected,
    source: input.source, evaluated_at: input.evaluated_at })
}
