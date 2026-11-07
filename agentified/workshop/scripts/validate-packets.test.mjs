import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { validatePackets } from './validate-packets.mjs'

const read = (file) => readFileSync(file, 'utf8')

test('L01-L16 satisfy the registered packet contract', () => {
  assert.deepEqual(validatePackets(), [])
})

test('L13-L16 source, visual, timing, and disposition omissions fail closed', () => {
  const errors = validatePackets((file) => {
    const packet = read(file)
    switch (path.basename(file)) {
      case 'L13-research-with-a-gate.md': return packet.replace('../../manuscript/production-draft/chapters/ch23-autoresearch-without-autonomy-theater.md', 'missing-chapter.md')
      case 'L14-show-the-board-the-controls.md': return packet.replace('agentified/manuscript/visuals/rendered/publication-plates/figure-ii-1-authority-ladder-publication-plate.png', 'missing-visual.png')
      case 'L15-rehearse-the-agentified-day.md': return packet.replace('| 6:15–9:35 |', '| 6:20–9:35 |')
      case 'L16-audit-the-operating-file.md': return packet.replace('actual disposition: `pending`', 'actual disposition: `approved`')
      default: return packet
    }
  })
  assert.match(errors.join('\n'), /L13-research-with-a-gate.md: missing registered source citation/)
  assert.match(errors.join('\n'), /L14-show-the-board-the-controls.md: missing visual candidate binding/)
  assert.match(errors.join('\n'), /L15-rehearse-the-agentified-day.md: timed narration/)
  assert.match(errors.join('\n'), /L16-audit-the-operating-file.md: actual human disposition must remain pending/)
})

test('L09-L12 source, visual, timing, and authority omissions fail closed', () => {
  const errors = validatePackets((file) => {
    const packet = read(file)
    switch (path.basename(file)) {
      case 'L09-metrics-and-review.md': return packet.replace('../../manuscript/production-draft/chapters/ch15-metrics-that-matter-for-agents.md', 'missing-chapter.md')
      case 'L10-spend-and-decision-brief.md': return packet.replace('agentified/manuscript/visuals/rendered/publication-plates/figure-ii-1-authority-ladder-publication-plate.png', 'missing-visual.png')
      case 'L11-cockpit-and-unblock.md': return packet.replace('| 6:15–9:35 |', '| 6:20–9:35 |')
      case 'L12-proof-and-foundry.md': return packet.replace('revision 12', 'revision unknown')
      default: return packet
    }
  })
  assert.match(errors.join('\n'), /L09-metrics-and-review.md: missing registered source citation/)
  assert.match(errors.join('\n'), /L10-spend-and-decision-brief.md: missing visual candidate binding/)
  assert.match(errors.join('\n'), /L11-cockpit-and-unblock.md: timed narration/)
  assert.match(errors.join('\n'), /L12-proof-and-foundry.md: Operating File revision missing/)
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
