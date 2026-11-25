import assert from 'node:assert/strict'
import { test } from 'node:test'
import { digest, proposeRepair } from './engine.mjs'
import { syntheticCase } from './fixtures.mjs'
import { PLAYBOOKS, PLAYBOOK_IDS } from './playbooks.mjs'
import { evaluate } from './evaluate.mjs'

for (const id of PLAYBOOK_IDS) {
  test(`${id}: qualified proposal is shadow-only and reversible`, () => {
    const input = syntheticCase(id)
    const before = structuredClone(input.candidate)
    const result = proposeRepair(input)
    assert.equal(result.status, 'proposed')
    assert.equal(result.proposal.external_actions_allowed, false)
    assert.equal(result.proposal.mode, 'shadow_review_only')
    assert.equal(result.proposal.rollback.candidate_version, before.version)
    assert.match(result.proposal.rollback.previous_state_hash, /^sha256:[a-f0-9]{64}$/)
    assert.deepEqual(input.candidate, before)
    assert.ok(PLAYBOOKS[id].allowed_evidence.length)
    assert.ok(PLAYBOOKS[id].required_receipts.length)
    assert.ok(PLAYBOOKS[id].human_qa)
  })
  for (const variant of ['meaning_change', 'hash_tamper', 'rights_unknown', 'expired', 'unsupported_claim']) {
    test(`${id}: ${variant} fails closed`, () => {
      assert.equal(proposeRepair(syntheticCase(id, variant)).status, 'unresolved')
    })
  }
}

test('missing receipt and wrong candidate version fail closed', () => {
  assert.equal(proposeRepair(syntheticCase('owned_proof_binding', 'missing_receipt')).status, 'unresolved')
  const input = syntheticCase('freshness_renewal')
  input.evidence[0].candidate_version = 'v2'
  input.evidence[0].content = input.evidence[0].content.replace('"candidate_version":"v1"', '"candidate_version":"v2"')
  input.evidence[0].sha256 = `sha256:${digest(input.evidence[0].content)}`
  assert.equal(proposeRepair(input).reason, 'stale_candidate_binding')
})

test('hashed receipt binds clearance and proposed facts', () => {
  const clearance = syntheticCase('owned_proof_binding')
  clearance.evidence[0].rights = 'cleared'
  clearance.evidence[0].content = clearance.evidence[0].content.replace('"rights":"cleared"', '"rights":"unknown"')
  assert.equal(proposeRepair(clearance).status, 'unresolved')
  const forged = syntheticCase('authoritative_source_replacement')
  forged.change.primary_source = false
  assert.equal(proposeRepair(forged).reason, 'unattested_change')
})

test('specific semantic gates reject unqualified changes', () => {
  for (const id of PLAYBOOK_IDS) {
    const input = syntheticCase(id)
    const key = {
      freshness_renewal: 'same_source', authoritative_source_replacement: 'primary_source', claim_narrowing: 'approved_wording',
      duplicate_angle_repair: 'distinct_angle', owned_proof_binding: 'scene_id', evidence_region_mapping: 'region_id',
      channel_adaptation: 'scene_map_complete', candidate_substitution: 'replacement_qualified', typed_blocker_routing: 'owner'
    }[id]
    input.change[key] = null
    assert.equal(proposeRepair(input).status, 'unresolved', id)
  }
})

test('historical observations stay unresolved and evaluation has no disagreement', () => {
  const report = evaluate()
  assert.equal(report.historical.length, 6)
  assert.ok(report.historical.every((item) => item.actual === 'unresolved'))
  assert.equal(report.metrics.disagreements, 0)
  assert.equal(report.metrics.unsupported_change_rate, 0)
})
