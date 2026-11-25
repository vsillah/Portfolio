import { captureDecisionReceipt, reconciliationEligibility } from './decision-receipt-runtime.mjs'

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value)
const bound = (value) => typeof value === 'string' && value.trim().length > 0
const syntheticPath = (value) => typeof value === 'string' && value.startsWith('artifacts/synthetic/') && !value.split('/').includes('..')
const report = (status, reason, receipt = null) => ({
  schema_version: 'evidence-repair-shadow-workflow-review/v1',
  status,
  reason,
  receipt_sha256: receipt?.receipt_sha256 ?? null,
  receipt_candidate: receipt ? structuredClone(receipt) : null,
  reconciliation: receipt ? 'eligible_for_review' : 'ineligible',
  label_promoted: false,
  workflow_mutated: false,
  external_actions_enabled: false,
})

/**
 * Read-only projection of the existing Social Content decision route's packet
 * and response. The additional Human QA decision is case-specific authority;
 * a generic stage approval cannot stand in for it. The decision route invokes
 * this adapter only after a synthetic local or staging-preview decision; its
 * production path never invokes the adapter.
 */
export function evaluateShadowWorkflowBinding(input, existing = [], readSource) {
  if (!isRecord(input) || !['synthetic_local', 'staging_shadow'].includes(input.mode) || input.data_class !== 'synthetic') return report('blocked', 'shadow_mode_required')
  const { fixture, workflow, human_qa: humanQa, binding } = input
  if (!isRecord(fixture) || !isRecord(workflow) || !isRecord(humanQa) || !isRecord(binding) || typeof readSource !== 'function' || !Array.isArray(existing)) return report('blocked', 'incomplete_shadow_input')
  if (fixture.synthetic !== true || !fixture.case_id?.startsWith('synthetic:') || fixture.input?.case_id !== fixture.case_id || !bound(fixture.input?.candidate?.id) || !Array.isArray(fixture.sources) || !fixture.sources.length || !fixture.sources.every((source) => syntheticPath(source.path)) || !Array.isArray(binding.sources) || !binding.sources.every((source) => syntheticPath(source.path)) || !syntheticPath(binding.artifact?.content_path) || !syntheticPath(binding.artifact?.artifact_path) || !syntheticPath(binding.authority?.source?.path)) return report('blocked', 'synthetic_sources_required')

  const { packet, result } = workflow
  if (packet?.version !== 'social-content-decision-review/v1' || !bound(packet.approval_id) || !bound(packet.work_item_id) || packet.content_id !== fixture.input.candidate.id || packet.content_updated_at !== fixture.candidate_version || packet.content_updated_at !== binding.artifact.version || !bound(packet.current_gate)) return report('blocked', 'workflow_packet_mismatch')
  if (result?.ok !== true || result.decision !== 'approve' || result.external_execution !== false || result.receipt?.decision !== 'approve' || !bound(result.receipt?.id) || result.receipt.external_execution !== false || result.item?.id !== packet.content_id || result.item?.rag_context?.latest_internal_decision_receipt_id !== result.receipt.id) return report('blocked', 'workflow_decision_mismatch')
  if (humanQa.decision !== 'passed' || humanQa.case_id !== fixture.case_id || humanQa.candidate_version !== fixture.candidate_version || humanQa.blocker_version !== fixture.blocker_version || humanQa.work_item_id !== packet.work_item_id || humanQa.stage_receipt_id !== result.receipt.id || humanQa.reviewer_id !== binding.authority?.reviewer_id || humanQa.approved_at !== binding.authority?.approved_at || humanQa.approval_source_path !== binding.authority?.source?.path || humanQa.approval_source_sha256 !== binding.authority?.source?.sha256) return report('blocked', 'case_specific_human_qa_required')
  if (binding.approved_scope?.human_qa_decision !== 'passed') return report('blocked', 'human_qa_scope_mismatch')

  try {
    const decisionInput = {
      fixture,
      artifact: binding.artifact,
      authority: binding.authority,
      decision: binding.decision,
      approved_scope: binding.approved_scope,
      exclusions: binding.exclusions,
      privacy_rights: binding.privacy_rights,
      sources: binding.sources,
    }
    const captured = captureDecisionReceipt(decisionInput, existing, readSource)
    if (reconciliationEligibility(captured.receipt, fixture, readSource).status !== 'eligible_for_review') return report('ineligible', 'receipt_verification_failed')
    return report(captured.status, captured.status === 'exact_replay' ? 'all_bindings_match' : 'case_specific_decision_verified', captured.receipt)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('conflicting replay')) return report('blocked', 'conflicting_replay')
    if (message.includes('stale') || message.includes('version')) return report('ineligible', 'stale_version')
    if (message.includes('hash') || message.includes('source')) return report('ineligible', 'source_bytes_or_binding_changed')
    if (message.includes('privacy') || message.includes('rights')) return report('ineligible', 'privacy_or_rights_uncleared')
    return report('ineligible', 'receipt_contract_rejected')
  }
}
