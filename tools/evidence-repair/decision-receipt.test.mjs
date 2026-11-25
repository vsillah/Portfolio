import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { syntheticCase } from './fixtures.mjs'
import { proposeRepair } from './engine.mjs'
import { fixtureHash } from './shadow-replay.mjs'
import { appendDecisionReceipt, captureDecisionReceipt, reconciliationEligibility, receiptHash, verifyDecisionReceipt, EXCLUSIONS } from './decision-receipt.mjs'

const sha = (x) => `sha256:${createHash('sha256').update(x).digest('hex')}`
function sample() {
  const input = syntheticCase('freshness_renewal')
  const source = { path: 'artifacts/synthetic/source.json', sha256: sha('source bytes') }
  const fixture = { case_id: input.case_id, playbook: input.playbook, label_kind: 'approved_outcome', as_of: '2026-10-18T00:00:00Z', candidate_version: input.candidate.version, blocker_version: input.blocker.version, sources: [source], input }
  fixture.fixture_sha256 = fixtureHash(fixture)
  const artifact = { version: input.candidate.version, content_path: 'artifacts/synthetic/content.txt', content_sha256: sha('content'), artifact_path: 'artifacts/synthetic/artifact.bin', artifact_sha256: sha('artifact'), pr_number: 1319, commit_sha: 'a'.repeat(40) }
  const decision = { kind: 'approved_repair', before: { meaning_id: input.candidate.meaning_id, claim_ids: input.candidate.claim_ids }, after: { meaning_id: input.change.meaning_id, claim_ids: input.change.claim_ids }, approved_change: input.change, rollback: proposeRepair(input).proposal.rollback }
  const approved_scope = { human_qa_decision: 'passed', reviewed_fields: Object.keys(input.change), approved_fields: Object.keys(input.change), exclusions: ['provider activation'] }
  const privacy_rights = { privacy: 'cleared', rights: 'cleared', reviewed_at: '2026-10-17T15:15:00Z' }
  const authority = { reviewer_id: 'synthetic-human', reviewer_role: 'human_repair_approver', approved_at: '2026-10-17T15:30:00Z', source: { path: 'artifacts/synthetic/decision.json', sha256: '' } }
  const sources = [source]
  const approval = { receipt_type: 'explicit_human_repair_approval', case_id: fixture.case_id, candidate_version: fixture.candidate_version, blocker_version: fixture.blocker_version, playbook: fixture.playbook, artifact, reviewer_id: authority.reviewer_id, reviewer_role: authority.reviewer_role, approved_at: authority.approved_at, decision, approved_scope, privacy_rights, sources }
  const bytes = new Map([[source.path, Buffer.from('source bytes')], [artifact.content_path, Buffer.from('content')], [artifact.artifact_path, Buffer.from('artifact')], [authority.source.path, Buffer.from(JSON.stringify(approval))]])
  authority.source.sha256 = sha(bytes.get(authority.source.path))
  const read = (path) => { if (!bytes.has(path)) throw new Error('missing source'); return bytes.get(path) }
  return { value: { fixture, artifact, authority, decision, approved_scope, exclusions: [...EXCLUSIONS], privacy_rights, sources }, bytes, read }
}

test('valid capture is deterministic, verified, and review-only eligible without promotion', () => {
  const x = sample()
  const first = captureDecisionReceipt(x.value, [], x.read)
  assert.equal(first.status, 'captured')
  assert.equal(first.receipt.receipt_sha256, receiptHash(first.receipt))
  assert.equal(verifyDecisionReceipt(first.receipt, x.read), true)
  assert.deepEqual(reconciliationEligibility(first.receipt, x.value.fixture, x.read), { status: 'eligible_for_review', promoted: false })
  const replay = captureDecisionReceipt(structuredClone(x.value), [first.receipt], x.read)
  assert.equal(replay.status, 'exact_replay')
  assert.deepEqual(replay.receipt, first.receipt)
})

test('missing authority, identity, hashes, scope, clearance, and version fail closed', () => {
  for (const edit of [
    (x) => { x.authority.reviewer_id = '' },
    (x) => { x.fixture.case_id = '' },
    (x) => { x.artifact.content_sha256 = '' },
    (x) => { x.approved_scope.approved_fields = [] },
    (x) => { x.privacy_rights.rights = 'unknown' },
    (x) => { x.artifact.commit_sha = '' },
    (x) => { x.artifact.version = 'stale-v2' },
    (x) => { x.fixture.blocker_version = 'stale-v2'; x.fixture.fixture_sha256 = fixtureHash(x.fixture) }
  ]) {
    const x = sample(); edit(x.value)
    assert.throws(() => captureDecisionReceipt(x.value, [], x.read), /decision receipt:/)
  }
})

test('conflicting replay, cross-case reuse, and changed source bytes fail closed', () => {
  const x = sample()
  const prior = captureDecisionReceipt(x.value, [], x.read).receipt
  const changed = sample()
  changed.value.artifact.commit_sha = 'b'.repeat(40)
  assert.throws(() => captureDecisionReceipt(changed.value, [prior], changed.read), /decision receipt:/)
  const other = sample()
  other.value.fixture.case_id = 'another-case'
  other.value.fixture.input.case_id = 'another-case'
  other.value.fixture.fixture_sha256 = fixtureHash(other.value.fixture)
  assert.throws(() => captureDecisionReceipt(other.value, [], other.read), /approval source does not bind decision/)
  x.bytes.set(x.value.sources[0].path, Buffer.from('tampered'))
  assert.equal(verifyDecisionReceipt(prior, x.read), false)
  assert.equal(reconciliationEligibility(prior, x.value.fixture, x.read).status, 'ineligible')
  assert.throws(() => captureDecisionReceipt(x.value, [prior], x.read), /source hash mismatch/)
})

test('receipt tampering and stale fixture binding cannot enter reconciliation review', () => {
  const x = sample()
  const receipt = captureDecisionReceipt(x.value, [], x.read).receipt
  const tampered = structuredClone(receipt)
  tampered.approved_scope.exclusions = []
  assert.equal(verifyDecisionReceipt(tampered, x.read), false)
  assert.equal(reconciliationEligibility(tampered, x.value.fixture, x.read).status, 'ineligible')
  const stale = structuredClone(x.value.fixture)
  stale.candidate_version = 'v2'
  assert.equal(reconciliationEligibility(receipt, stale, x.read).status, 'ineligible')
  const crossCase = structuredClone(x.value.fixture)
  crossCase.case_id = 'another-case'
  assert.equal(reconciliationEligibility(receipt, crossCase, x.read).status, 'ineligible')
})

test('local archive uses exclusive creation, exact replay, and rejects conflicting replacement', () => {
  const dir = mkdtempSync(join(tmpdir(), 'decision-receipt-'))
  try {
    const x = sample()
    const first = appendDecisionReceipt(dir, x.value, x.read)
    assert.equal(first.status, 'captured')
    const bytes = readFileSync(first.path)
    assert.equal(appendDecisionReceipt(dir, x.value, x.read).status, 'exact_replay')
    assert.deepEqual(readFileSync(first.path), bytes)
    const changed = sample()
    changed.value.artifact.commit_sha = 'b'.repeat(40)
    assert.throws(() => appendDecisionReceipt(dir, changed.value, changed.read), /decision receipt:/)
    assert.deepEqual(readFileSync(first.path), bytes)
    x.bytes.set(x.value.artifact.artifact_path, Buffer.from('changed'))
    assert.equal(verifyDecisionReceipt(first.receipt, x.read), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
