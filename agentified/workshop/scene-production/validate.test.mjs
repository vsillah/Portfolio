import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPacket, presenterWindows } from './build.mjs'
import { validatePacket, validateAll } from './validate.mjs'

const changed = (edit) => { const packet = structuredClone(buildPacket(1)); edit(packet); return validatePacket(packet).join('\n') }

test('the first batch matches exact approved scripts and sources', () => assert.deepEqual(validateAll(4), []))
test('caption, timing, and audience leakage fail closed', () => {
  assert.match(changed((p) => { p.scenes[0].captions[0].text = 'changed' }), /caption text mismatch|packet differs/)
  assert.match(changed((p) => { p.scenes[1].start_seconds++ }), /timing gap or overlap/)
  assert.match(changed((p) => { p.scenes[0].audience_copy.push('QA note: internal') }), /audience copy leakage/)
  assert.match(changed((p) => { p.scenes[0].avatar_window.end_seconds += .25 }), /presenter handoff cuts a sentence|presenter window binding changed/)
  assert.match(changed((p) => { p.batch = 2 }), /review batch mismatch/)
  assert.match(changed((p) => { p.package_cover.path = 'public/agentified-cover.svg' }), /canonical cover binding changed/)
})
test('all approved presenter windows remain bound to the immutable manifest', () => {
  assert.equal(presenterWindows.source_head, '80080500516a448856a3fc44ee6c370b1e67672f')
  assert.equal(Object.keys(presenterWindows.windows).length, 32)
  for (let number = 1; number <= 16; number++) {
    const packet = buildPacket(number)
    for (const scene of packet.scenes) assert.deepEqual(scene.avatar_window, presenterWindows.windows[scene.id] ?? null)
  }
})
test('visual identity, authority, and SAM boundary fail closed', () => {
  assert.match(changed((p) => { p.scenes[3].approved_visuals[0].sha256 = '0'.repeat(64) }), /visual source or approval mismatch/)
  assert.match(changed((p) => { p.scenes[0].status = 'provider_ready' }), /execution state changed/)
  assert.match(changed((p) => { p.boundaries.accelerated_sam_media = 'approved' }), /provider, customer release, or SAM boundary changed/)
  assert.match(changed((p) => { p.boundaries.customer_release = 'ready' }), /customer release/)
})
