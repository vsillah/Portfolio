#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim())
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const batch = JSON.parse(readFileSync(path.join(here, 'batch-provider-receipt.json'), 'utf8'))

assert(batch.source_commit === '558cd4669e1d48c74a715a99d23eb9d43f74af8d', 'source commit drift')
assert(batch.batch_sha256 === '392593a8132208a7da39d5a5254f0887e72e6c509bf2d640f3a07fa8be291dee', 'batch hash drift')
assert(batch.look_id === '7275ba9035f94b31ad589dda6532d002', 'look identity drift')
assert(batch.voice_id === '4f53988b1c314610b514db98432fd0ef', 'voice identity drift')
assert(batch.jobs_submitted === 4 && batch.retries === 0, 'submission count or no-retry rule failed')
assert(batch.credits_before === 1293 && batch.credits_after === 1250 && batch.aggregate_credit_cost === 43, 'credit ledger drift')
assert(batch.cash_purchase_usd === 0, 'unexpected cash purchase')

for (const lesson of batch.lessons) {
  const id = lesson.lesson_id.toLowerCase()
  const receipt = JSON.parse(readFileSync(path.join(here, `${id}-provider-receipt.json`), 'utf8'))
  const candidate = JSON.parse(readFileSync(path.join(root, `agentified/workshop/l05-l08-guided-video-preflight/${id}-request-candidate.json`), 'utf8'))
  const source = path.join(root, receipt.native_source.path)
  const composite = path.join(root, receipt.composite.path)
  assert(candidate.request_sha256 === receipt.request_sha256, `${lesson.lesson_id} request drift`)
  assert(receipt.status === 'completed_once_no_retry' && receipt.submissions === 1 && receipt.retries === 0, `${lesson.lesson_id} retry rule failed`)
  assert(receipt.look_id === batch.look_id && receipt.voice_id === batch.voice_id, `${lesson.lesson_id} identity drift`)
  assert(sha(source) === receipt.native_source.sha256, `${lesson.lesson_id} native source hash drift`)
  assert(sha(composite) === receipt.composite.sha256, `${lesson.lesson_id} composite hash drift`)
  assert(Math.abs(duration(composite) - 600) < 0.01, `${lesson.lesson_id} composite duration drift`)
  assert(receipt.timing_receipt.native_speed === 1, `${lesson.lesson_id} native speed changed`)
  assert(receipt.timing_receipt.provider_free_closing_card.end === 600, `${lesson.lesson_id} closing card incomplete`)
  assert(receipt.background_treatment.native_presenter_pixels_preserved, `${lesson.lesson_id} presenter treatment drift`)
  assert(readFileSync(path.join(root, receipt.captions.srt_path), 'utf8').trim().length > 0, `${lesson.lesson_id} captions missing`)
}

const walkthrough = path.join(here, 'agentified-l05-l08-human-qa-walkthrough.mp4')
assert(duration(walkthrough) > 55 && duration(walkthrough) < 75, 'walkthrough duration outside review range')
console.log('Agentified L05-L08 validation PASS: four exact sources, four 10-minute composites, 43 credits, zero retries')
