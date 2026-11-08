#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const probe = (file, field = 'format=duration') => execFileSync('ffprobe', ['-v', 'error', '-show_entries', field, '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim()
const frameDigest = (file, time) => execFileSync('ffmpeg', ['-v', 'error', '-ss', String(time), '-i', file, '-frames:v', '1', '-f', 'md5', '-'], { encoding: 'utf8' }).trim()
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const batch = JSON.parse(readFileSync(path.join(here, 'batch-provider-receipt.json'), 'utf8'))
const result = JSON.parse(readFileSync(path.join(here, 'batch-validation-receipt.json'), 'utf8'))

assert(batch.source_commit === 'a260c7593758fd6757ea21ef240a9abc83cc3725', 'source commit drift')
assert(batch.batch_sha256 === '398b0032f735cae199817634f997db89099dbf0c0a9b6c6c123d318c3067eeb1', 'batch hash drift')
assert(batch.voice_id === '4f53988b1c314610b514db98432fd0ef', 'voice identity drift')
assert(batch.jobs_submitted === 4 && batch.retries === 0, 'submission count or no-retry rule failed')
assert(batch.credits_before === 1250 && batch.credits_after === 1219 && batch.aggregate_credit_cost === 31, 'credit ledger drift')
assert(batch.aggregate_credit_cost <= batch.authorized_aggregate_cap && batch.lessons.every((lesson) => lesson.credit_cost <= 10), 'credit cap exceeded')
assert(batch.cash_purchase_usd === 0, 'unexpected cash purchase')
assert(result.lessons.length === 4 && result.music_used === false && result.fixed_ten_minute_padding === false, 'batch policy drift')

for (const lesson of result.lessons) {
  const id = lesson.lesson_id.toLowerCase()
  const receipt = JSON.parse(readFileSync(path.join(here, `${id}-validation-receipt.json`), 'utf8'))
  const composite = path.join(here, `agentified-${id}-continuous-narration-composite.mp4`)
  assert(sha(composite) === receipt.composite.sha256 && receipt.composite.sha256 === lesson.composite_sha256, `${lesson.lesson_id} composite hash drift`)
  assert(Math.abs(Number(probe(composite)) - receipt.composite.duration_seconds) < 0.02, `${lesson.lesson_id} duration drift`)
  assert(receipt.transition_policy.sentence_complete_handoffs && receipt.transition_policy.natural_source_pauses_preserved && receipt.transition_policy.ordinary_gap_seconds === 0, `${lesson.lesson_id} handoff policy failed`)
  assert(receipt.transition_policy.full_narration_tail_preserved && receipt.narration_audio_spans.length === 2, `${lesson.lesson_id} narration tail policy failed`)
  assert(Math.abs(receipt.narration_audio_spans[0].source_end - receipt.narration_audio_spans[1].source_start) < 0.0001, `${lesson.lesson_id} narration split overlap or loss`)
  assert(Math.abs(receipt.narration_audio_spans[1].source_end - receipt.narration_source.duration_seconds) < 0.0001, `${lesson.lesson_id} final source tail clipped`)
  assert(receipt.guided_work_window.duration === 45, `${lesson.lesson_id} guided-work duration drift`)
  assert(receipt.guided_work_window.purpose.includes('countdown'), `${lesson.lesson_id} countdown binding missing`)
  assert(frameDigest(composite, receipt.guided_work_window.start + 0.2) !== frameDigest(composite, receipt.guided_work_window.start + 2.2), `${lesson.lesson_id} countdown is static`)
  assert(receipt.continuity_validation.status === 'pass' && receipt.continuity_validation.unexpected_silences.length === 0, `${lesson.lesson_id} unexpected silence`)
  assert(receipt.segment_placements.length === 8 && receipt.sentence_placements.length > 8, `${lesson.lesson_id} narration timing incomplete`)
  assert(Number(probe(composite, 'stream=index').split('\n').length) >= 3, `${lesson.lesson_id} embedded captions missing`)
}

const walkthrough = path.join(here, 'agentified-l05-l08-continuity-walkthrough.mp4')
const walkthroughDuration = Number(probe(walkthrough))
assert(walkthroughDuration > 71 && walkthroughDuration < 73, 'walkthrough duration outside review range')
console.log('Agentified L05-L08 continuity validation PASS: four continuous narration composites, 31 credits, zero retries')
