import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { syntheticCase } from './fixtures.mjs'
import { PLAYBOOK_IDS } from './playbooks.mjs'
import { proposeRepair } from './engine.mjs'
import { compareOutcome, fixtureHash, outcomeHash, replay, replayCase } from './shadow-replay.mjs'

const digest = (s) => `sha256:${createHash('sha256').update(s).digest('hex')}`
const exclusions = ['provider', 'render', 'upload', 'platform_draft', 'schedule', 'publish', 'external_send', 'approval_mutation']
function labeled(playbook = 'freshness_renewal', scopeOverride = null) {
  const input = syntheticCase(playbook)
  const case_id = input.case_id
  const approval = { identity: 'synthetic-reviewer', type: 'explicit_human_repair_approval', approved_at: '2026-10-17T15:30:00Z' }
  const human_qa_scope = scopeOverride || { decision: 'passed', reviewed_fields: Object.keys(input.change), artifact_version: input.candidate.version }
  const record = JSON.stringify({ receipt_type: 'approved_evidence_repair_outcome', case_id, candidate_version: input.candidate.version, blocker_version: input.blocker.version, playbook, approval, approved_change: input.change, human_qa_scope })
  const source = { path: 'synthetic/explicit-approval.json', sha256: digest(record) }
  const fixture = { case_id, category: 'synthetic', playbook, label_kind: 'approved_outcome', as_of: '2026-10-18T00:00:00Z', candidate_version: input.candidate.version, blocker_version: input.blocker.version, sources: [source], input }
  fixture.fixture_sha256 = fixtureHash(fixture)
  const proposal = proposeRepair(input).proposal
  const outcome = { schema_version: 'approved-repair-outcome/v1', case_id, candidate_version: input.candidate.version, blocker_version: input.blocker.version, playbook, before: { meaning_id: input.candidate.meaning_id, claim_ids: [...input.candidate.claim_ids] }, after: { meaning_id: input.change.meaning_id, claim_ids: [...input.change.claim_ids] }, approved_change: structuredClone(input.change), sources: [source], approval: { ...approval, source_path: source.path, sha256: source.sha256 }, human_qa_scope: structuredClone(human_qa_scope), rollback: structuredClone(proposal.rollback), external_action_exclusions: [...exclusions] }
  outcome.outcome_sha256 = outcomeHash(outcome)
  return { fixture, outcome, read: (path) => { assert.equal(path, source.path); return Buffer.from(record) } }
}
test('historical corpus hashes verify and cannot produce an approval label', () => {
  const corpus = JSON.parse(readFileSync(new URL('./shadow-corpus.json', import.meta.url)))
  const report = replay(corpus)
  assert.equal(report.metrics.cases, 9)
  assert.equal(report.metrics.labeled_cases, 0)
  assert.equal(report.metrics.labeled_case_precision, null)
  assert.equal(report.metrics.unsupported_change_rate, null)
  assert.equal(report.metrics.counts.expected_unresolved, 2)
  assert.equal(report.metrics.counts.insufficient_label, 7)
  assert.equal(report.metrics.source_categories.length, 6)
})
test('every playbook remains provider free and candidate immutable during labeled replay', () => {
  for (const playbook of PLAYBOOK_IDS) {
    const { fixture, outcome, read } = labeled(playbook)
    const before = structuredClone(fixture.input.candidate)
    assert.equal(replayCase(fixture, [outcome], read).classification, 'exact_match', playbook)
    assert.deepEqual(fixture.input.candidate, before)
  }
})
test('fixture and source hash mismatches stop replay', () => {
  const x = labeled()
  x.fixture.category = 'tampered'
  assert.throws(() => replayCase(x.fixture, [x.outcome], x.read), /fixture hash mismatch/)
  x.fixture.fixture_sha256 = fixtureHash(x.fixture)
  x.fixture.sources[0].sha256 = digest('forged')
  x.fixture.fixture_sha256 = fixtureHash(x.fixture)
  assert.throws(() => replayCase(x.fixture, [x.outcome], x.read), /source hash mismatch/)
})
test('outcome hash, version, authority, and scope fail closed', () => {
  for (const [change, expected] of [
    [(o) => { o.after.meaning_id = 'tampered' }, 'outcome_hash'],
    [(o) => { o.candidate_version = 'v2' }, 'candidate_version_mismatch'],
    [(o) => { o.blocker_version = 'v2' }, 'blocker_version_mismatch'],
    [(o) => { o.approval.type = 'review_recommendation' }, 'missing_human_approval_authority'],
    [(o) => { o.human_qa_scope.decision = 'pending' }, 'missing_human_qa_scope'],
    [(o) => { o.approval.approved_at = '2026-10-19T00:00:00Z' }, 'approval_after_replay_cutoff'],
    [(o) => { o.rollback.previous_state_hash = digest('wrong') }, 'rollback_incomplete_or_mismatch'],
    [(o) => { o.external_action_exclusions.pop() }, 'external_action_exclusions_incomplete']
  ]) {
    const x = labeled()
    change(x.outcome)
    if (expected !== 'outcome_hash') x.outcome.outcome_sha256 = outcomeHash(x.outcome)
    assert.ok(replayCase(x.fixture, [x.outcome], x.read).missing_bindings.includes(expected), expected)
  }
})
test('schema and runtime require all eight external-action exclusions', () => {
  const schema = JSON.parse(readFileSync(new URL('./approved-outcome.schema.json', import.meta.url)))
  assert.equal(schema.properties.external_action_exclusions.minItems, 8)
  assert.equal(schema.properties.external_action_exclusions.maxItems, 8)
  assert.equal(schema.properties.external_action_exclusions.uniqueItems, true)
  assert.deepEqual([...schema.properties.external_action_exclusions.items.enum].sort(), [...exclusions].sort())
  const x = labeled()
  x.outcome.external_action_exclusions = exclusions.slice(0, 7)
  x.outcome.outcome_sha256 = outcomeHash(x.outcome)
  assert.ok(replayCase(x.fixture, [x.outcome], x.read).missing_bindings.includes('external_action_exclusions_incomplete'))
})
test('passed Human QA needs a reviewed field; internal routing may use an empty bounded scope', () => {
  const schema = JSON.parse(readFileSync(new URL('./approved-outcome.schema.json', import.meta.url)))
  const scopeSchema = schema.properties.human_qa_scope
  assert.equal(scopeSchema.allOf[0].then.properties.reviewed_fields.minItems, 1)
  assert.equal(scopeSchema.properties.reviewed_fields.maxItems, 16)
  assert.equal(schema.allOf[0].then.properties.playbook.const, 'typed_blocker_routing')
  const x = labeled()
  x.outcome.human_qa_scope.reviewed_fields = []
  x.outcome.outcome_sha256 = outcomeHash(x.outcome)
  assert.ok(replayCase(x.fixture, [x.outcome], x.read).missing_bindings.includes('missing_human_qa_scope'))

  const routing = labeled('typed_blocker_routing', { decision: 'not_required_for_internal_routing', reviewed_fields: [], artifact_version: 'v1' })
  assert.equal(replayCase(routing.fixture, [routing.outcome], routing.read).classification, 'exact_match')
})
test('meaning, claim, and unsupported facts cannot become approved outcomes', () => {
  for (const key of ['meaning_id', 'claim_ids', 'invented_fact']) {
    const x = labeled()
    if (key === 'meaning_id') x.outcome.before.meaning_id = 'new-meaning'
    else if (key === 'claim_ids') x.outcome.before.claim_ids = ['unsupported-claim']
    else x.outcome.approved_change.invented_fact = true
    x.outcome.outcome_sha256 = outcomeHash(x.outcome)
    const result = replayCase(x.fixture, [x.outcome], x.read)
    assert.equal(result.classification, 'insufficient_label')
  }
})
test('duplicate labels and unapproved historical observation stay insufficient', () => {
  const x = labeled()
  assert.deepEqual(replayCase(x.fixture, [x.outcome, structuredClone(x.outcome)], x.read).missing_bindings, ['duplicate_approved_outcomes'])
  assert.deepEqual(replayCase(x.fixture, [], x.read).missing_bindings, ['missing_explicit_approved_outcome'])
})
test('bounded disagreement and protected drift classify by field', () => {
  const x = labeled()
  const proposal = proposeRepair(x.fixture.input).proposal
  x.outcome.approved_change.new_observed_at = '2026-10-17T14:30:00Z'
  assert.equal(compareOutcome(proposal, x.outcome).classification, 'bounded_disagreement')
  x.outcome.after.meaning_id = 'new-meaning'
  assert.equal(compareOutcome(proposal, x.outcome).classification, 'unsupported_change')
})
