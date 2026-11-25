import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { syntheticCase } from './fixtures.mjs'
import { proposeRepair } from './engine.mjs'
import { fixtureHash } from './shadow-replay.mjs'
import { captureDecisionReceipt, EXCLUSIONS } from './decision-receipt.mjs'
import { evaluateShadowWorkflowBinding as evaluate } from './shadow-workflow-binding.mjs'

const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
function sample() {
  const input = syntheticCase('freshness_renewal')
  const source = { path: 'artifacts/synthetic/source.json', sha256: sha('source bytes') }
  const fixture = { case_id: input.case_id, playbook: input.playbook, label_kind: 'approved_outcome', as_of: '2026-10-18T00:00:00Z', candidate_version: input.candidate.version, blocker_version: input.blocker.version, sources: [source], input }
  fixture.fixture_sha256 = fixtureHash(fixture)
  const artifact = { version: input.candidate.version, content_path: 'artifacts/synthetic/content.txt', content_sha256: sha('content'), artifact_path: 'artifacts/synthetic/artifact.bin', artifact_sha256: sha('artifact'), pr_number: 1320, commit_sha: 'a'.repeat(40) }
  const decision = { kind: 'approved_repair', before: { meaning_id: input.candidate.meaning_id, claim_ids: input.candidate.claim_ids }, after: { meaning_id: input.change.meaning_id, claim_ids: input.change.claim_ids }, approved_change: input.change, rollback: proposeRepair(input).proposal.rollback }
  const approved_scope = { human_qa_decision: 'passed', reviewed_fields: Object.keys(input.change), approved_fields: Object.keys(input.change), exclusions: ['provider activation'] }
  const privacy_rights = { privacy: 'cleared', rights: 'cleared', reviewed_at: '2026-10-17T15:15:00Z' }
  const authority = { reviewer_id: 'synthetic-human', reviewer_role: 'human_repair_approver', approved_at: '2026-10-17T15:30:00Z', source: { path: 'artifacts/synthetic/decision.json', sha256: '' } }
  const sources = [source]
  const approval = { receipt_type: 'explicit_human_repair_approval', case_id: fixture.case_id, candidate_version: fixture.candidate_version, blocker_version: fixture.blocker_version, playbook: fixture.playbook, artifact, reviewer_id: authority.reviewer_id, reviewer_role: authority.reviewer_role, approved_at: authority.approved_at, decision, approved_scope, privacy_rights, sources }
  const bytes = new Map([[source.path, Buffer.from('source bytes')], [artifact.content_path, Buffer.from('content')], [artifact.artifact_path, Buffer.from('artifact')], [authority.source.path, Buffer.from(JSON.stringify(approval))]])
  authority.source.sha256 = sha(bytes.get(authority.source.path))
  const read = (path) => { if (!bytes.has(path)) throw Error('missing source'); return bytes.get(path) }
  const packet = { version: 'social-content-decision-review/v1', approval_id: 'synthetic-approval', work_item_id: 'synthetic-work-item', content_id: input.candidate.id, content_updated_at: input.candidate.version, current_gate: 'copy_review' }
  const result = { ok: true, decision: 'approve', external_execution: false, receipt: { id: 'synthetic-stage-receipt', decision: 'approve', external_execution: false }, item: { id: input.candidate.id, rag_context: { latest_internal_decision_receipt_id: 'synthetic-stage-receipt' } } }
  const human_qa = { decision: 'passed', case_id: fixture.case_id, candidate_version: fixture.candidate_version, blocker_version: fixture.blocker_version, work_item_id: packet.work_item_id, stage_receipt_id: result.receipt.id, reviewer_id: authority.reviewer_id, approved_at: authority.approved_at, approval_source_path: authority.source.path, approval_source_sha256: authority.source.sha256 }
  const binding = { artifact, decision, approved_scope, privacy_rights, authority, sources, exclusions: [...EXCLUSIONS] }
  return { value: { mode: 'synthetic_local', data_class: 'synthetic', fixture, workflow: { packet, result }, human_qa, binding }, bytes, read }
}

test('explicit case-specific approval captures an internal candidate and exact replay is idempotent', () => {
  const x = sample()
  const first = evaluate(x.value, [], x.read)
  assert.deepEqual({ status: first.status, reconciliation: first.reconciliation, label_promoted: first.label_promoted, external_actions_enabled: first.external_actions_enabled }, { status: 'captured', reconciliation: 'eligible_for_review', label_promoted: false, external_actions_enabled: false })
  const prior = captureDecisionReceipt({ fixture: x.value.fixture, ...x.value.binding }, [], x.read).receipt
  assert.deepEqual(evaluate(x.value, [prior], x.read), { ...first, status: 'exact_replay', reason: 'all_bindings_match' })
  assert.equal(JSON.stringify(first).includes('source bytes'), false)
  assert.equal(JSON.stringify(first).includes('approved_change'), false)
})

test('general or missing approval, cross-case reuse, and stale workflow version fail closed', () => {
  for (const edit of [
    (x) => { delete x.human_qa },
    (x) => { x.human_qa.decision = 'general_approval' },
    (x) => { x.human_qa.case_id = 'other-case' },
    (x) => { x.workflow.packet.content_updated_at = 'stale' },
    (x) => { x.workflow.result.receipt.id = 'other-receipt' },
    (x) => { x.workflow.result.external_execution = true },
  ]) {
    const x = sample(); edit(x.value)
    assert.equal(evaluate(x.value, [], x.read).status, 'blocked')
  }
})

test('changed bytes, conflicting replay, unclear rights, changed meaning, and production mode fail closed', () => {
  const x = sample()
  const prior = captureDecisionReceipt({ fixture: x.value.fixture, ...x.value.binding }, [], x.read).receipt
  x.bytes.set(x.value.binding.artifact.artifact_path, Buffer.from('changed'))
  assert.equal(evaluate(x.value, [], x.read).status, 'ineligible')
  const conflict = sample()
  conflict.value.binding.artifact.commit_sha = 'b'.repeat(40)
  const approvalPath = conflict.value.binding.authority.source.path
  const approval = JSON.parse(conflict.bytes.get(approvalPath))
  approval.artifact.commit_sha = 'b'.repeat(40)
  const changedApprovalPath = 'artifacts/synthetic/decision-v2.json'
  conflict.bytes.set(changedApprovalPath, Buffer.from(JSON.stringify(approval)))
  conflict.value.binding.authority.source.path = changedApprovalPath
  conflict.value.binding.authority.source.sha256 = sha(conflict.bytes.get(changedApprovalPath))
  conflict.value.human_qa.approval_source_path = changedApprovalPath
  conflict.value.human_qa.approval_source_sha256 = conflict.value.binding.authority.source.sha256
  assert.deepEqual({ status: evaluate(conflict.value, [prior], conflict.read).status, reason: evaluate(conflict.value, [prior], conflict.read).reason }, { status: 'blocked', reason: 'conflicting_replay' })
  const rights = sample(); rights.value.binding.privacy_rights.rights = 'unknown'
  assert.equal(evaluate(rights.value, [], rights.read).status, 'ineligible')
  const meaning = sample(); meaning.value.binding.decision.after.meaning_id = 'unsupported'
  assert.equal(evaluate(meaning.value, [], meaning.read).status, 'ineligible')
  const production = sample(); production.value.mode = 'production'
  assert.deepEqual(evaluate(production.value, [], production.read), { schema_version: 'evidence-repair-shadow-workflow-review/v1', status: 'blocked', reason: 'shadow_mode_required', receipt_sha256: null, reconciliation: 'ineligible', label_promoted: false, workflow_mutated: false, external_actions_enabled: false })
})

test('staging shadow accepts only synthetic inputs and never invokes workflow or external actions', () => {
  const x = sample(); x.value.mode = 'staging_shadow'
  const before = structuredClone(x.value)
  assert.equal(evaluate(x.value, [], x.read).status, 'captured')
  assert.deepEqual(x.value, before)
  x.value.binding.artifact.content_path = 'artifacts/human-qa/real.txt'
  assert.deepEqual(evaluate(x.value, [], x.read).reason, 'synthetic_sources_required')
})
