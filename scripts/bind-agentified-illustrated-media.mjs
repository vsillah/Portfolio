#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const receipts = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/presentation-illustration-audit/composite-receipts.json'), 'utf8'))
const { agentifiedSourceMedia } = await import('../lib/agentified-source-media.ts')
assert.equal(receipts.composites.length, 16)
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const bindings = {}
for (const [index, row] of receipts.composites.entries()) {
  const id = `L${String(index + 1).padStart(2, '0')}`
  const media = agentifiedSourceMedia[id]
  assert.equal(row.lesson_id, id)
  assert.equal(media.video, `/${row.source_path.replace(/^public\//, '')}`, `${id}: source binding drift`)
  assert.equal(media.compositeSha256, row.source_sha256, `${id}: source media drift`)
  const source = path.join(root, row.source_path)
  const approved = path.join(root, row.output_path)
  assert.equal(sha(source), row.source_sha256, `${id}: source drift`)
  assert.equal(sha(approved), row.output_sha256, `${id}: approved composite drift`)
  const publicPath = `/agentified/lessons/${id.toLowerCase()}/illustrated-${row.output_sha256.slice(0, 8)}/agentified-${id.toLowerCase()}-illustrated-composite.mp4`
  const destination = path.join(root, 'public', publicPath)
  mkdirSync(path.dirname(destination), { recursive: true })
  copyFileSync(approved, destination)
  assert.equal(sha(destination), row.output_sha256, `${id}: public copy drift`)
  bindings[id] = { video: publicPath, compositeSha256: row.output_sha256, sourceVideo: media.video, sourceSha256: row.source_sha256, captions: media.captions, captionsSha256: sha(path.join(root, 'public', media.captions)), transcriptSha256: createHash('sha256').update(JSON.stringify(media.spokenCues)).digest('hex'), durationSeconds: media.durationSeconds }
}
writeFileSync(path.join(root, 'lib/agentified-illustrated-bindings.json'), `${JSON.stringify({ approvalCommit: '6b288adc0ddefbe37f0b7889debafaf5eec855c1', bindings }, null, 2)}\n`)
console.log('Bound 16 exact illustrated composites')
