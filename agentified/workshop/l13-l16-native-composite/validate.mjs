#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUTHORIZATION_PATH, AUTHORIZATION_SHA256, REQUESTS, loadAuthorization, validateAuthorizationBinding } from './execution-authorization.mjs'
import { assertCaptionMatches, expectedCaptionText, extractSrtText, extractVttText } from './caption-contract.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim())
const streamSha = (file, stream) => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', stream, '-c', 'copy', '-f', 'hash', '-hash', 'sha256', 'pipe:1'], { encoding: 'utf8' }).trim().replace('SHA256=', '')
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const correctionReceiptPath = path.join(here, 'l13-caption-correction-receipt.json')
const correctionReceiptSha256 = 'dd6704d0509f03a892fed4b7fd0bc5b9caefe75190ed0df7faef73a267ef175a'

loadAuthorization(here)
const batch = JSON.parse(readFileSync(path.join(here, 'batch-provider-receipt.json')))
assert(batch.source_commit === '5d61cadff39b46d5d17add8e06370cc25a18de41', 'source commit drift')
assert(batch.batch_sha256 === '18b3a6bfa3ee1dc6fadedb2cc969a312e8a9acf935bfb50684ad0d812b0cb194', 'batch hash drift')
assert(batch.look_id === '7275ba9035f94b31ad589dda6532d002' && batch.voice_id === '4f53988b1c314610b514db98432fd0ef', 'identity drift')
assert(batch.calls_submitted === 8 && batch.retries === 0, 'call or retry limit failed')
assert(batch.exact_credit_cost === 48 && batch.cash_purchase_usd === 0, 'provider cost drift')
assert(batch.account_balance_after_batch === 720 && batch.account_balance_after_batch >= batch.minimum_balance_required, 'minimum balance failed')
assert(batch.execution_authorization_receipt?.path === AUTHORIZATION_PATH && batch.execution_authorization_receipt?.sha256 === AUTHORIZATION_SHA256, 'batch authorization binding drift')
assert(batch.caption_correction_receipt?.path === 'agentified/workshop/l13-l16-native-composite/l13-caption-correction-receipt.json' && batch.caption_correction_receipt?.sha256 === correctionReceiptSha256, 'batch caption correction binding drift')
assert(sha(correctionReceiptPath) === correctionReceiptSha256, 'caption correction receipt hash drift')
const correctionReceipt = JSON.parse(readFileSync(correctionReceiptPath))
assert(correctionReceipt.provider_calls === 0 && correctionReceipt.spend_usd === 0, 'caption correction provider scope drift')
assert(sha(path.join(root, correctionReceipt.human_qa_walkthrough.path)) === correctionReceipt.human_qa_walkthrough.sha256 && correctionReceipt.human_qa_walkthrough.privacy_safe, 'caption correction walkthrough drift')

for (const lesson of batch.lessons) {
  const id = lesson.lesson_id.toLowerCase()
  const receipt = JSON.parse(readFileSync(path.join(here, `${id}-provider-receipt.json`)))
  const candidate = JSON.parse(readFileSync(path.join(root, `agentified/workshop/l13-l16-continuous-preflight/${id}-request-candidate.json`)))
  const presenter = path.join(root, receipt.presenter_source.path)
  const narration = path.join(root, receipt.narration_source.path)
  const composite = path.join(root, receipt.composite.path)
  const presenterSubtitle = path.join(root, receipt.presenter_source.subtitle_path)
  const narrationTiming = path.join(root, receipt.narration_source.timing_path)
  const srtPath = path.join(root, receipt.captions.srt_path)
  const vttPath = path.join(root, receipt.captions.vtt_path)
  const timeline = receipt.timing_receipt
  assert(candidate.candidate_sha256 === REQUESTS[lesson.lesson_id] && receipt.request_sha256 === REQUESTS[lesson.lesson_id], `${lesson.lesson_id} request drift`)
  validateAuthorizationBinding(receipt.execution_authorization_receipt, lesson.lesson_id)
  assert(receipt.provider_calls === 2 && receipt.retries === 0, `${lesson.lesson_id} call or retry drift`)
  assert(receipt.provider_usage.lesson_credit_cost <= 150 && receipt.provider_usage.cash_purchase_usd === 0, `${lesson.lesson_id} credit cap failed`)
  assert(receipt.provider_usage.account_balance_after_lesson >= 168, `${lesson.lesson_id} minimum balance failed`)
  assert(sha(presenter) === receipt.presenter_source.sha256, `${lesson.lesson_id} presenter hash drift`)
  assert(sha(presenterSubtitle) === receipt.presenter_source.subtitle_sha256, `${lesson.lesson_id} presenter subtitle hash drift`)
  assert(sha(narration) === receipt.narration_source.sha256, `${lesson.lesson_id} narration hash drift`)
  assert(sha(narrationTiming) === receipt.narration_source.timing_sha256, `${lesson.lesson_id} narration timing hash drift`)
  assert(sha(composite) === receipt.composite.sha256, `${lesson.lesson_id} composite hash drift`)
  assert(Math.abs(duration(composite) - timeline.output_duration_seconds) < 0.03, `${lesson.lesson_id} duration drift`)
  assert(timeline.native_speed === 1 && timeline.presenter_windows.length === 2, `${lesson.lesson_id} presenter timing drift`)
  assert(Math.abs(timeline.guided_work_countdown.sequence_end - timeline.guided_work_countdown.sequence_start - 45) < 0.001, `${lesson.lesson_id} countdown drift`)
  assert(Math.abs(timeline.guided_work_countdown.sequence_start - (timeline.presenter_windows[0].sequence_end + timeline.guided_work_countdown.source_split_seconds)) < 0.001, `${lesson.lesson_id} countdown receipt drift`)
  assert(sha(srtPath) === receipt.captions.srt_sha256, `${lesson.lesson_id} SRT hash drift`)
  assert(sha(vttPath) === receipt.captions.vtt_sha256, `${lesson.lesson_id} VTT hash drift`)
  const expectedCaptions = expectedCaptionText(candidate)
  assertCaptionMatches(extractSrtText(readFileSync(srtPath, 'utf8')), expectedCaptions, `${lesson.lesson_id} SRT`)
  assertCaptionMatches(extractVttText(readFileSync(vttPath, 'utf8')), expectedCaptions, `${lesson.lesson_id} VTT`)
  const embeddedSrt = execFileSync('ffmpeg', ['-v', 'error', '-i', composite, '-map', '0:s:0', '-f', 'srt', 'pipe:1'], { encoding: 'utf8' })
  assertCaptionMatches(extractSrtText(embeddedSrt), expectedCaptions, `${lesson.lesson_id} embedded subtitle`)
  assert(receipt.background_treatment.native_presenter_pixels_preserved, `${lesson.lesson_id} presenter pixels changed`)
  if (lesson.lesson_id === 'L13') {
    assert(receipt.caption_correction_receipt?.sha256 === correctionReceiptSha256, 'L13 caption correction binding drift')
    assert(correctionReceipt.after.srt_sha256 === receipt.captions.srt_sha256 && correctionReceipt.after.vtt_sha256 === receipt.captions.vtt_sha256, 'L13 corrected caption hash drift')
    assert(correctionReceipt.after.composite_sha256 === receipt.composite.sha256, 'L13 corrected composite hash drift')
    assert(correctionReceipt.stream_copy_proof.video_stream_sha256_before === correctionReceipt.stream_copy_proof.video_stream_sha256_after, 'L13 video stream changed during caption remux')
    assert(correctionReceipt.stream_copy_proof.audio_stream_sha256_before === correctionReceipt.stream_copy_proof.audio_stream_sha256_after, 'L13 audio stream changed during caption remux')
    assert(streamSha(composite, '0:v:0') === correctionReceipt.stream_copy_proof.video_stream_sha256_after, 'L13 current video stream hash drift')
    assert(streamSha(composite, '0:a:0') === correctionReceipt.stream_copy_proof.audio_stream_sha256_after, 'L13 current audio stream hash drift')
  }
}

console.log('Agentified L13-L16 validation PASS: eight exact calls, 48 credits, zero retries, continuous narration, four synchronized 45-second countdowns')
