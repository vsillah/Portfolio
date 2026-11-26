import { createHash } from 'node:crypto'
import { calibrateHistoricalShadow, type ApprovedOutcomeReceipt, type CalibrationPolicy, type CalibrationReport, type ShadowCase } from './attributable-shadow-calibration'
import { rawResponseSha256 } from './attributable-performance-evidence'
import type { RepairBinding } from './evidence-repair-human-qa'

/** A review-store decision supplied by the caller. This module cannot verify the store itself. */
export type CalibrationIntegrationApproval = {
  decision_receipt_id: string
  authority_id: string
  authority_version: string
  decision: 'allow_synthetic_review_candidate'
  report_sha256: string
  policy_id: string
  policy_version: string
  policy_approval_receipt_id: string
  case_id: string
  artifact_version: string
  evidence_version: string
  platform: string
  format: string
  cohort_receipt_sha256: string
  performance_receipt_sha256: string
  source_sha256: string
  repair_binding_hash: string
  decided_at: string
  valid_until: string
  privacy_cleared: boolean
  rights_cleared: boolean
  exclusions: string[]
  source_path: string
  rollback: string
  receipt_sha256: string
}

export type SyntheticRepairReview = {
  environment: 'synthetic_staging'
  binding: RepairBinding
  current_binding: RepairBinding
  candidate_status: 'human_qa_pending'
  linkage_status: 'unlinked'
  preparation_rerun_status: 'not_run'
  approved_copy_unchanged: true
  freshness_status: 'passed'
  provenance_status: 'verified_primary_source'
  privacy_cleared: true
  rights_cleared: true
  external_actions_allowed: false
}

export type CalibrationIntegrationCandidate = {
  contract_version: 'calibration-integration-v1'
  scope: 'internal_captain_review_only'
  status: 'ready' | 'blocked'
  blockers: string[]
  candidate_sha256: string
  report_sha256: string
  approval_receipt_sha256: string | null
  repair_binding_hash: string
  review_path: string | null
  provenance: { source_path: string; source_sha256: string; cohort_receipt_sha256: string; performance_receipt_sha256: string; historical_record_id: string } | null
  rollback: string | null
  production_writes_enabled: false
  packet_linkage_enabled: false
  label_promotion_enabled: false
  notification_enabled: false
  external_actions_enabled: false
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const present = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const safePath = (value: unknown) => present(value) && !value.startsWith('/') && !value.split('/').includes('..')
const time = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export function calibrationIntegrationApprovalSha256(approval: CalibrationIntegrationApproval) {
  const { receipt_sha256: _digest, ...body } = approval
  return hash(body)
}

function validRepairBinding(binding: RepairBinding) {
  const { bindingHash, ...body } = binding
  return digest(bindingHash) && bindingHash === hash(body)
    && [binding.packetId, binding.originalPacketId, binding.calendarItemId, binding.socialContentId].every(uuid)
    && [binding.sourceSha256, binding.approvedCopySha256, binding.claimBoundarySha256].every(digest)
    && [binding.caseId, binding.packetVersion, binding.originalPacketVersion, binding.sourceExpiresAt, binding.evidenceVersion, binding.contentVersion].every(present)
}

/** Pure, read-only bridge from exact 5I replay to the existing repair review binding. */
export function prepareSyntheticCalibrationIntegration(input: {
  cases: ShadowCase[]
  outcomes: ApprovedOutcomeReceipt[]
  policy: CalibrationPolicy
  expected_report: CalibrationReport
  approval: CalibrationIntegrationApproval | null
  authority_verified: boolean
  review: SyntheticRepairReview
}): CalibrationIntegrationCandidate {
  const { policy } = input
  const report = calibrateHistoricalShadow({ cases: input.cases, outcomes: input.outcomes, policy })
  const blockers: string[] = []
  const approval = input.approval
  const trace = approval ? report.traces.find(row => row.case_id === approval.case_id && row.artifact_version === approval.artifact_version) : null
  const group = trace ? report.groups.find(row => row.platform === trace.platform && row.format === trace.format) : null
  const source = trace?.cohort_receipt.decisions[0]

  if (input.expected_report.receipt_sha256 !== report.receipt_sha256 || input.expected_report.contract_version !== report.contract_version) blockers.push('Calibration report differs from the current replay.')
  if (report.orphan_outcome_receipts.length) blockers.push('Orphan or conflicting outcome receipts remain.')
  if (!approval || !input.authority_verified) blockers.push('Exact approval authority is missing or unverified.')
  if (!trace || !source || !group) blockers.push('Approved case or exact channel and format is missing.')
  if (group && (!group.reportable || !group.confidence_eligible || group.blockers.length)) blockers.push('Calibration group is not reportable under its approved policy.')
  if (trace && (trace.inclusion !== 'included' || !trace.approved || trace.label_reasons.length || trace.approved.unsupported_change || trace.predicted === 'unscored' || trace.cohort_receipt.status !== 'Scored' || trace.source_and_cohort_rejections.length)) blockers.push('Case has unresolved, unsupported, or Unscored evidence.')
  if (source && (source.status !== 'Included' || !source.rights_privacy.privacy_cleared || !source.rights_privacy.rights_cleared || !source.fixture_approval || source.fixture_approval.kind !== 'synthetic')) blockers.push('Synthetic source, privacy, or rights binding is invalid.')
  if (approval) {
    if (approval.receipt_sha256 !== calibrationIntegrationApprovalSha256(approval) || !digest(approval.receipt_sha256) || !present(approval.decision_receipt_id) || !present(approval.authority_id) || !present(approval.authority_version) || approval.decision !== 'allow_synthetic_review_candidate') blockers.push('Approval receipt or decision authority is invalid.')
    const decided = time(approval.decided_at), until = time(approval.valid_until), at = time(policy.evaluated_at)
    if (decided === null || until === null || at === null || decided > at || until <= at || until <= decided) blockers.push('Approval is stale or future-dated.')
    if (!approval.privacy_cleared || !approval.rights_cleared || !Array.isArray(approval.exclusions) || approval.exclusions.some(item => !present(item)) || !safePath(approval.source_path) || !present(approval.rollback)) blockers.push('Approval provenance, exclusions, privacy, rights, or rollback is incomplete.')
    if (approval.report_sha256 !== report.receipt_sha256 || approval.policy_id !== policy.policy_id || approval.policy_version !== policy.policy_version || approval.policy_approval_receipt_id !== policy.approval_receipt_id || approval.case_id !== trace?.case_id || approval.artifact_version !== trace?.artifact_version || approval.evidence_version !== source?.evidence_version || approval.platform !== trace?.platform || approval.format !== trace?.format || approval.cohort_receipt_sha256 !== trace?.cohort_receipt_sha256 || approval.performance_receipt_sha256 !== trace?.performance_receipt_sha256 || approval.source_sha256 !== source?.raw_response_sha256 || approval.repair_binding_hash !== input.review.binding.bindingHash) blockers.push('Approval differs from the exact report, policy, case, source, or repair binding.')
  }
  const review = input.review
  if (review.environment !== 'synthetic_staging' || !validRepairBinding(review.binding) || !validRepairBinding(review.current_binding) || JSON.stringify(review.binding) !== JSON.stringify(review.current_binding)) blockers.push('Current synthetic repair binding is missing or changed.')
  if (review.candidate_status !== 'human_qa_pending' || review.linkage_status !== 'unlinked' || review.preparation_rerun_status !== 'not_run' || review.approved_copy_unchanged !== true || review.freshness_status !== 'passed' || review.provenance_status !== 'verified_primary_source' || review.privacy_cleared !== true || review.rights_cleared !== true || review.external_actions_allowed !== false) blockers.push('Repair review state or external lock is invalid.')
  if (source && (review.binding.sourceSha256 !== source.raw_response_sha256 || time(review.binding.sourceExpiresAt) === null || time(review.binding.sourceExpiresAt)! <= time(policy.evaluated_at)! || rawResponseSha256(input.cases.find(item => item.case_id === trace?.case_id)?.candidate.raw_response) !== source.raw_response_sha256)) blockers.push('Repair source hash, expiry, or retained response changed.')

  const body = {
    contract_version: 'calibration-integration-v1' as const,
    scope: 'internal_captain_review_only' as const,
    status: blockers.length ? 'blocked' as const : 'ready' as const,
    blockers,
    report_sha256: report.receipt_sha256,
    approval_receipt_sha256: approval?.receipt_sha256 ?? null,
    repair_binding_hash: review.binding.bindingHash,
    review_path: blockers.length ? null : `/admin/agents/content-intelligence?section=research&packet=${encodeURIComponent(review.binding.packetId)}`,
    provenance: blockers.length || !source || !trace ? null : { source_path: approval!.source_path, source_sha256: source.raw_response_sha256, cohort_receipt_sha256: trace.cohort_receipt_sha256, performance_receipt_sha256: trace.performance_receipt_sha256!, historical_record_id: source.historical_record_id },
    rollback: blockers.length ? null : approval!.rollback,
    production_writes_enabled: false as const, packet_linkage_enabled: false as const, label_promotion_enabled: false as const,
    notification_enabled: false as const, external_actions_enabled: false as const,
  }
  return { ...body, candidate_sha256: hash(body) }
}
