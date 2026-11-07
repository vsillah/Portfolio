import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validate } from './validate.mjs'

const register = JSON.parse(readFileSync(new URL('./source-register.json', import.meta.url)))
const crosswalk = JSON.parse(readFileSync(new URL('./curriculum-crosswalk.json', import.meta.url)))
const copy = (value) => structuredClone(value)

test('canonical source and curriculum bindings pass', () => assert.deepEqual(validate(register, crosswalk), []))
test('missing or changed source fails closed', () => {
  const item = copy(register)
  item.sources[0].sha256 = 'wrong'
  assert.match(validate(item, crosswalk).join(' '), /source changed/)
})
test('missing lesson and duplicate chapter fail closed', () => {
  const missing = copy(crosswalk)
  missing.lessons.pop()
  assert.match(validate(register, missing).join(' '), /incomplete 16-lesson map/)
  const duplicate = copy(crosswalk)
  duplicate.lessons[1].chapters[0] = 1
  assert.match(validate(register, duplicate).join(' '), /duplicate chapter coverage/)
})
test('unbound visual, unattributed asset, and internal copy fail closed', () => {
  const visual = copy(crosswalk)
  visual.lessons[0].visual_candidates = ['missing.png']
  assert.match(validate(register, visual).join(' '), /unbound or unattributed visual/)
  const attribution = copy(register)
  attribution.sources.find((source) => source.role === 'rendered visual').provenance = ''
  assert.match(validate(attribution, crosswalk).join(' '), /unattributed visual/)
  const copyLeak = copy(crosswalk)
  copyLeak.lessons[0].exercise = 'Paste /Users/example/private/data here.'
  assert.match(validate(register, copyLeak).join(' '), /internal content leakage/)
})
