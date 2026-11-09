#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AUTHORIZATION_PATH,
  AUTHORIZATION_SHA256,
  EXPECTED_AUTHORIZATION,
  loadAndValidateAuthorizationReceipt,
  validateAuthorizationBinding
} from './execution-authorization.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim())
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const batch = JSON.parse(readFileSync(path.join(here, 'batch-provider-receipt.json'), 'utf8'))
loadAndValidateAuthorizationReceipt(here)

assert(batch.source_commit === 'cb44c2389b4281aac7dae33d835363ae35c42ea2', 'source commit drift')
assert(batch.batch_sha256 === 'c339600cab53a406b01ae80399354bf718e94a36863322f934d795c424aa6ed5', 'batch hash drift')
assert(batch.look_id === '7275ba9035f94b31ad589dda6532d002', 'look identity drift')
assert(batch.voice_id === '4f53988b1c314610b514db98432fd0ef', 'voice identity drift')
assert(batch.jobs_submitted === 4 && batch.retries === 0, 'submission count or no-retry rule failed')
assert(batch.cash_purchase_usd === 0, 'unexpected cash purchase')
assert(batch.exact_known_credit_cost === 114, 'known L09 credit receipt drift')
assert(batch.lessons.filter((lesson) => lesson.credit_cost === null).length === 3, 'unexposed credit costs must remain undisclosed')
assert(batch.execution_authorization_receipt?.path === AUTHORIZATION_PATH, 'batch authorization receipt path drift')
assert(batch.execution_authorization_receipt?.sha256 === AUTHORIZATION_SHA256, 'batch authorization receipt hash binding drift')

for (const lesson of batch.lessons) {
  const id = lesson.lesson_id.toLowerCase()
  const receipt = JSON.parse(readFileSync(path.join(here, `${id}-provider-receipt.json`), 'utf8'))
  const candidate = JSON.parse(readFileSync(path.join(root, `agentified/workshop/l09-l12-continuous-preflight/${id}-request-candidate.json`), 'utf8'))
  const source = path.join(root, receipt.native_source.path)
  const composite = path.join(root, receipt.composite.path)
  const timeline = receipt.timing_receipt
  assert(candidate.candidate_sha256 === receipt.request_sha256, `${lesson.lesson_id} request drift`)
  assert(receipt.request_sha256 === EXPECTED_AUTHORIZATION.requests[lesson.lesson_id], `${lesson.lesson_id} approved request drift`)
  validateAuthorizationBinding(receipt.execution_authorization_receipt, lesson.lesson_id)
  assert(receipt.status === 'completed_once_no_retry_and_composited_provider_free' && receipt.submissions === 1 && receipt.retries === 0, `${lesson.lesson_id} retry rule failed`)
  assert(receipt.look_id === batch.look_id && receipt.voice_id === batch.voice_id, `${lesson.lesson_id} identity drift`)
  assert(sha(source) === receipt.native_source.sha256, `${lesson.lesson_id} native source hash drift`)
  assert(sha(composite) === receipt.composite.sha256, `${lesson.lesson_id} composite hash drift`)
  assert(Math.abs(duration(composite) - timeline.output_duration_seconds) < 0.03, `${lesson.lesson_id} composite duration drift`)
  assert(timeline.native_speed === 1, `${lesson.lesson_id} native speed changed`)
  assert(timeline.guided_work_countdown.seconds === 45, `${lesson.lesson_id} countdown duration drift`)
  assert(timeline.presenter_windows.length === 2, `${lesson.lesson_id} presenter window count drift`)
  assert(receipt.background_treatment.mode === 'provider_free_textured_studio_reconstruction', `${lesson.lesson_id} presenter background drift`)
  assert(receipt.background_treatment.native_presenter_pixels_preserved, `${lesson.lesson_id} presenter pixels changed`)
  assert(readFileSync(path.join(root, receipt.captions.srt_path), 'utf8').trim().length > 0, `${lesson.lesson_id} captions missing`)
  if (lesson.lesson_id === 'L10') {
    assert(timeline.l10_mobile_diagram_treatment?.mode === 'enlarged_full_width_plate', 'L10 mobile diagram treatment drift')
    assert(timeline.l10_mobile_diagram_treatment?.text_equivalent, 'L10 diagram text equivalent missing')
  }
}

const walkthrough = path.join(here, 'agentified-l09-l12-human-qa-walkthrough.mp4')
assert(duration(walkthrough) > 55 && duration(walkthrough) < 75, 'walkthrough duration outside review range')
console.log('Agentified L09-L12 validation PASS: four exact sources, continuous narration, 45-second countdowns, textured presenter windows, zero retries')
