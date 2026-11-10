#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const receipts = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/presentation-illustration-audit/composite-receipts.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(path.join(root, 'lib/agentified-illustrated-bindings.json'), 'utf8'))
const { agentifiedSourceMedia } = await import('../lib/agentified-source-media.ts')
const sha = (file) => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')
assert.equal(manifest.sourceApprovalCommit, '6b288adc0ddefbe37f0b7889debafaf5eec855c1')
assert.equal(manifest.correctionBaseCommit, 'f5d65b6078ebef02c18b574b3afa70b2b60084ed')
assert.equal(manifest.correctionReviewState, 'human_qa_pending')
assert.equal(receipts.composites.length, 16)
assert.equal(Object.keys(manifest.bindings).length, 16)
for (const [index, row] of receipts.composites.entries()) {
  const id = `L${String(index + 1).padStart(2, '0')}`
  const binding = manifest.bindings[id]
  const media = agentifiedSourceMedia[id]
  assert.equal(row.lesson_id, id)
  assert.ok(binding, `${id}: binding missing`)
  assert.equal(binding.sourceVideo, `/${row.source_path.replace(/^public\//, '')}`)
  assert.equal(binding.sourceSha256, row.source_sha256)
  assert.equal(binding.sourceVideo, media.video)
  assert.equal(binding.captions, media.captions)
  assert.equal(binding.durationSeconds, media.durationSeconds)
  assert.equal(binding.captionsSha256, sha(`public${media.captions}`), `${id}: caption hash drift`)
  assert.equal(binding.transcriptSha256, createHash('sha256').update(JSON.stringify(media.spokenCues)).digest('hex'), `${id}: transcript hash drift`)
  assert.equal(binding.compositeSha256, row.output_sha256)
  assert.equal(binding.video, `/agentified/lessons/${id.toLowerCase()}/illustrated-${row.output_sha256.slice(0, 8)}/agentified-${id.toLowerCase()}-illustrated-composite.mp4`)
  assert.equal(sha(row.source_path), row.source_sha256, `${id}: source hash drift`)
  assert.equal(sha(row.output_path), row.output_sha256, `${id}: approved composite hash drift`)
  assert.equal(sha(`public${binding.video}`), row.output_sha256, `${id}: public composite hash drift`)
}
console.log('PASS: 16 source, composite, caption, transcript, and duration bindings')
