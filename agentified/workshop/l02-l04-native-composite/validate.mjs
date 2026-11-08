#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const receipts = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/l02-l04-native-source/provider-receipts.json'), 'utf8'))
const expectedDurations = { L02: 510, L03: 600, L04: 600 }
const output = { schema_version: 1, status: 'passed', checked_at: new Date().toISOString(), lessons: [] }
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', file], { encoding: 'utf8' }))

assert.equal(receipts.auto_reload, 'off')
assert.equal(receipts.jobs.length, 3)
assert.ok(receipts.aggregate_debit_usd <= receipts.aggregate_cap_usd)
for (const job of receipts.jobs) {
  const lesson = job.lesson_id
  const source = path.join(root, job.native_path)
  assert.equal(sha(source), job.native_sha256)
  assert.equal(job.retry_count, 0)
  assert.ok(job.debit_usd <= 3.26)
  const composite = path.join(here, `agentified-${lesson.toLowerCase()}-native-composite.mp4`)
  const media = probe(composite)
  assert.ok(Math.abs(Number(media.format.duration) - expectedDurations[lesson]) < 0.08)
  assert.ok(media.streams.some(stream => stream.codec_type === 'video' && stream.width === 1920 && stream.height === 1080 && stream.r_frame_rate === '25/1'))
  assert.ok(media.streams.some(stream => stream.codec_type === 'audio'))
  assert.ok(media.streams.some(stream => stream.codec_type === 'subtitle'))
  const timeline = JSON.parse(readFileSync(path.join(here, `${lesson.toLowerCase()}-composite-timeline.json`), 'utf8'))
  assert.equal(timeline.source_sha256, job.native_sha256)
  assert.equal(timeline.placements.length, 2)
  assert.equal(timeline.provider_free_closing_card.end, expectedDurations[lesson])
  assert.ok(timeline.placements[0].sequence_end <= timeline.placements[1].sequence_start)
  assert.ok(timeline.placements[1].sequence_end <= timeline.provider_free_closing_card.start)
  output.lessons.push({ lesson_id: lesson, composite_sha256: sha(composite), duration_seconds: Number(media.format.duration), source_sha256: job.native_sha256, retry_count: 0, debit_usd: job.debit_usd })
}
const walkthrough = path.join(here, 'agentified-l02-l04-human-qa-walkthrough.mp4')
const walkthroughMedia = probe(walkthrough)
assert.ok(Number(walkthroughMedia.format.duration) >= 46 && Number(walkthroughMedia.format.duration) < 47)
output.walkthrough = { path: 'agentified/workshop/l02-l04-native-composite/agentified-l02-l04-human-qa-walkthrough.mp4', sha256: sha(walkthrough), duration_seconds: Number(walkthroughMedia.format.duration) }
writeFileSync(path.join(here, 'validation-receipt.json'), JSON.stringify(output, null, 2) + '\n')
console.log(JSON.stringify(output, null, 2))
