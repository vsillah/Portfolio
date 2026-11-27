import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateCandidate } from './validate-youtube-external-policy-candidate.mjs'

const candidate = JSON.parse(readFileSync('artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/source-class-policy-receipt-candidate-v1.json', 'utf8'))
const sourceBytes = readFileSync(candidate.source_packet_path)
const source = JSON.parse(sourceBytes.toString('utf8'))
const check = (value, packet = source, bytes = sourceBytes) => validateCandidate(value, packet, bytes, new Date('2026-11-27T04:15:00Z')).blockers
const edit = (change) => { const copy = structuredClone(candidate); change(copy); return copy }

test('review candidate is internally consistent yet always blocked', () => {
  assert.deepEqual(check(candidate), [])
  assert.equal(validateCandidate(candidate, source, sourceBytes).status, 'blocked')
  assert.equal(candidate.retention_rule.expires_at, null)
})

test('missing, expired, or conflicting authority cannot mint an expiry', () => {
  assert.match(check(edit(c => { c.authority_receipt_id = 'self-issued' })).join(' '), /Unverified authority/)
  assert.match(check(edit(c => { c.retention_rule.expires_at = '2020-01-01T00:00:00Z' })).join(' '), /retention ceiling|expired/)
  assert.match(check(edit(c => { c.dimensions.derived_scoring = 'permitted' })).join(' '), /policy dimensions/)
})

test('exact evidence version and response provenance cannot drift', () => {
  assert.match(check(edit(c => { c.acquisition_receipt_sha256 = 'a'.repeat(64) })).join(' '), /Acquisition receipt/)
  assert.match(check(candidate, source, Buffer.concat([sourceBytes, Buffer.from(' ')])).join(' '), /Source packet bytes/)
  assert.match(check(edit(c => { c.rows[0].response_body_sha256_reported = 'b'.repeat(64) })).join(' '), /reported hash/)
  assert.match(check(edit(c => { c.rows[0].raw_response_sha256_verified = 'c'.repeat(64) })).join(' '), /raw provenance/)
})

test('privacy and rights are independent and all external actions remain locked', () => {
  assert.match(check(edit(c => { c.privacy_receipt.approved = true })).join(' '), /Privacy or rights/)
  assert.match(check(edit(c => { c.rights_receipt.approved = true })).join(' '), /Privacy or rights/)
  assert.match(check(edit(c => { c.locks.publish_enabled = true })).join(' '), /publish_enabled/)
  assert.match(check(edit(c => { c.locks.production_mutation_enabled = true })).join(' '), /production_mutation_enabled/)
  assert.match(check(edit(c => { c.rollback.production_records_unchanged = false })).join(' '), /Rollback/)
  assert.match(check(edit(c => { c.cohort.performance_weight = 1 })).join(' '), /performance weight/)
})
