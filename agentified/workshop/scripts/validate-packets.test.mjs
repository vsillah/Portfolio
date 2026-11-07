import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { validatePackets } from './validate-packets.mjs'

const read = (file) => readFileSync(file, 'utf8')

test('approved L01-L04 and new L05-L08 satisfy the same packet contract', () => {
  assert.deepEqual(validatePackets(), [])
})

test('L01 source citation and L08 visual binding both fail closed', () => {
  const errors = validatePackets((file) => {
    const packet = read(file)
    if (path.basename(file) === 'L01-job-and-receipt.md') return packet.replace('../../manuscript/production-draft/chapters/ch01-the-first-receipt.md', 'missing-chapter.md')
    if (path.basename(file) === 'L08-handoff-and-eval.md') return packet.replace('agentified/manuscript/visuals/rendered/publication-plates/figure-1-1-first-receipt-publication-plate.png', 'missing-visual.png')
    return packet
  })
  assert.match(errors.join('\n'), /L01-job-and-receipt.md: missing registered source citation/)
  assert.match(errors.join('\n'), /L08-handoff-and-eval.md: missing visual candidate binding/)
})

test('L05 timing gap and L06 embedded image fail closed', () => {
  const errors = validatePackets((file) => {
    const packet = read(file)
    if (path.basename(file) === 'L05-operating-map.md') return packet.replace('| 6:15–9:35 |', '| 6:20–9:35 |')
    if (path.basename(file) === 'L06-permission-and-cull.md') return `${packet}\n![unapproved](asset.png)\n`
    return packet
  })
  assert.match(errors.join('\n'), /L05-operating-map.md: timed narration/)
  assert.match(errors.join('\n'), /L06-permission-and-cull.md: embedded media/)
})
