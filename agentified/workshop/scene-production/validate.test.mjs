import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPacket } from './build.mjs'
import { validatePacket, validateAll } from './validate.mjs'

const changed = (edit) => { const packet = structuredClone(buildPacket(1)); edit(packet); return validatePacket(packet).join('\n') }

test('the first batch matches exact approved scripts and sources', () => assert.deepEqual(validateAll(4), []))
test('caption, timing, and audience leakage fail closed', () => {
  assert.match(changed((p) => { p.scenes[0].captions[0].text = 'changed' }), /caption text mismatch|packet differs/)
  assert.match(changed((p) => { p.scenes[1].start_seconds++ }), /timing gap or overlap/)
  assert.match(changed((p) => { p.scenes[0].audience_copy.push('QA note: internal') }), /audience copy leakage/)
})
test('visual identity, authority, and SAM boundary fail closed', () => {
  assert.match(changed((p) => { p.scenes[3].approved_visuals[0].sha256 = '0'.repeat(64) }), /visual source or approval mismatch/)
  assert.match(changed((p) => { p.scenes[0].status = 'provider_ready' }), /execution state changed/)
  assert.match(changed((p) => { p.boundaries.accelerated_sam_media = 'approved' }), /provider or SAM boundary changed/)
})
