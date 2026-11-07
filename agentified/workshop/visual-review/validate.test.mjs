import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { validate } from './validate.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const original = JSON.parse(readFileSync(path.join(here, 'packets.json')))
const changed = (edit) => { const packet = structuredClone(original); edit(packet); return validate(packet).join('\n') }

test('all sixteen packets remain read-only and source-bound', () => assert.deepEqual(validate(original), []))
test('missing lesson or visual identity fails closed', () => {
  assert.match(changed((p) => p.lessons.splice(0, 1)), /missing lesson packet|L01: missing or duplicate identity/)
  assert.match(changed((p) => { p.lessons[0].visuals[0].source_identity = '' }), /source mismatch/)
})
test('hash drift and source substitution fail closed', () => {
  assert.match(changed((p) => { p.lessons[0].visuals[0].register_sha256 = '0'.repeat(64) }), /source mismatch|visual hash drift/)
  assert.match(changed((p) => { p.lessons[0].visuals[0].source_path = p.lessons[1].visuals[0].source_path }), /missing visual identity/)
  assert.match(changed((p) => { p.crosswalk_sha256 = '0'.repeat(64) }), /crosswalk drift/)
})
test('stale or invented approval and unresolved rights fail closed', () => {
  assert.match(changed((p) => { p.lessons[0].visuals[0].approval.expires_at = '2026-11-06' }), /stale approval/)
  assert.match(changed((p) => { p.lessons[0].visuals[0].approval.status = 'approved' }), /unapproved visual reuse/)
  assert.match(changed((p) => { p.lessons[0].visuals[0].rights.status = 'approved' }), /rights ambiguity/)
})
test('accessibility and exact storyboard passage omissions fail closed', () => {
  assert.match(changed((p) => { p.lessons[0].visuals[0].accessibility.spoken_equivalent = '' }), /accessibility omission/)
  assert.match(changed((p) => { p.lessons[0].visuals[0].script_passage = 'related visual' }), /passage mismatch/)
  assert.match(changed((p) => { p.lessons[0].script_sha256 = '0'.repeat(64) }), /script hash drift/)
})
test('A.M.I.N.A. and disputed cover cannot be promoted by related assets', () => {
  assert.match(changed((p) => { p.lessons[3].visuals[0].blocker = 'author review complete' }), /blocked A.M.I.N.A. reuse/)
  assert.match(changed((p) => { p.cover_hold.disposition = 'approved' }), /blocked book-cover reuse/)
  assert.match(changed((p) => { p.cover_hold.jpg.sha256 = p.cover_hold.svg.sha256 }), /blocked book-cover reuse/)
})
test('customer-facing storyboard frames reject private paths and operator notes', () => {
  const root = path.resolve(here, '../../..')
  const readSource = (p) => p.endsWith('L01-receipt.md') ? Buffer.from('QA note: /Users/private') : readFileSync(path.join(root, p))
  assert.match(validate(original, { readSource }).join('\n'), /storyboard frame leakage L01-receipt.md/)
})
