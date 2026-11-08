#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const sourceCommit = '558cd4669e1d48c74a715a99d23eb9d43f74af8d'
const compositeCommit = '50f384462565c7cea60cbce56a5ecd0db303811d'
const voiceId = '4f53988b1c314610b514db98432fd0ef'

const lessons = [
  { id: 'L05', request: '54bcd458518d54755c6bc76ae5fbed365440790548eeb02d299e45e589034099', openingEnd: 11.91, closingStart: 588.67 },
  { id: 'L06', request: 'cc6a0cc1320375eb4d8ee3bc22c32bcb3814822c02fefd8e5af901341c52acbc', openingEnd: 13.64, closingStart: 585.033 },
  { id: 'L07', request: 'f35b6f521276b7b7ee03806f3c58de0acb4236ea90c005859c293ee065a47bcd', openingEnd: 9.37, closingStart: 589.89 },
  { id: 'L08', request: '297bf76b3b3a4179c5ee07fc81039d58351ad10dce12aa01ebddcc3038fcf025', openingEnd: 13.525, closingStart: 590.621 },
]

function sha(value) {
  return createHash('sha256').update(value).digest('hex')
}

function normalize(value) {
  return value
    .replaceAll(/[“”]/g, '"')
    .replaceAll(/[‘’]/g, "'")
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function stripOuterQuotes(value) {
  const text = value.trim()
  return text.replace(/^[“"]/, '').replace(/[”"]$/, '').trim()
}

function removePrefix(text, prefix, label) {
  const normalizedText = normalize(stripOuterQuotes(text))
  const normalizedPrefix = normalize(prefix)
  if (!normalizedText.startsWith(normalizedPrefix)) throw new Error(`${label} opening presenter passage drift`)
  return normalizedText.slice(normalizedPrefix.length).trim()
}

function removeSuffix(text, suffix, label) {
  const normalizedText = normalize(stripOuterQuotes(text))
  const normalizedSuffix = normalize(suffix)
  if (!normalizedText.endsWith(normalizedSuffix)) throw new Error(`${label} closing presenter passage drift`)
  return normalizedText.slice(0, -normalizedSuffix.length).trim()
}

mkdirSync(here, { recursive: true })
const batch = []

for (const lesson of lessons) {
  const packetPath = path.join(root, `agentified/workshop/scene-production/packets/${lesson.id}.json`)
  const requestPath = path.join(root, `agentified/workshop/l05-l08-guided-video-preflight/${lesson.id.toLowerCase()}-request-candidate.json`)
  const packet = JSON.parse(readFileSync(packetPath, 'utf8'))
  const request = JSON.parse(readFileSync(requestPath, 'utf8'))
  if (request.request_sha256 !== lesson.request) throw new Error(`${lesson.id} request drift`)
  if (request.presenter_windows.length !== 2) throw new Error(`${lesson.id} presenter-window count drift`)

  const opening = request.presenter_windows[0]
  const closing = request.presenter_windows[1]
  const segments = packet.scenes.map((scene, index) => {
    let narration = stripOuterQuotes(scene.narration_exact)
    if (index === 0) narration = removePrefix(narration, opening.narration_exact, lesson.id)
    if (index === packet.scenes.length - 1) narration = removeSuffix(narration, closing.narration_exact, lesson.id)
    narration = normalize(narration)
    return narration ? {
      scene_id: scene.id,
      narration_exact: narration,
      narration_sha256: sha(narration),
    } : null
  }).filter(Boolean)

  const text = segments.map((segment) => segment.narration_exact).join('\n\n')
  const candidate = {
    schema_version: 1,
    status: 'provider_execution_blocked_pending_exact_authorization',
    lesson_id: lesson.id,
    correction_scope: 'continuous approved narration and narration-led picture edit while preserving exact native presenter passages',
    source_commit: sourceCommit,
    rejected_composite_commit: compositeCommit,
    packet_path: path.relative(root, packetPath),
    packet_sha256: sha(readFileSync(packetPath)),
    existing_avatar_request_sha256: lesson.request,
    provider_candidate: 'HeyGen create_speech',
    requested_call_limit: 1,
    automatic_retries: 0,
    manual_retries: 0,
    execution_allowed: false,
    spending_allowed: false,
    voice: {
      id: voiceId,
      engine: 'heygen_voice',
      purpose: `Agentified ${lesson.id} review-only off-screen narration correction`,
    },
    speech_request: {
      input_type: 'text',
      language: 'en',
      speed: 1,
      text,
      text_sha256: sha(text),
      character_count: text.length,
      word_count: text.split(/\s+/).length,
      requested_word_timestamps: true,
    },
    existing_presenter_audio: {
      opening: { sequence_start: 0, sequence_end: lesson.openingEnd },
      closing: { sequence_start: lesson.closingStart, sequence_end: closing.presenter_end_seconds },
      rule: 'Preserve native presenter audio in these windows and never layer synthesized narration over it.',
    },
    narration_segments: segments,
    edit_policy: {
      picture_clock: 'derive every visual change from the accepted narration timing rather than the rejected fixed ten-minute scene grid',
      transition_rule: 'change topics only after a sentence-complete spoken handoff; allow a short L-cut when the next visual supports the current sentence',
      ordinary_pause_limit_seconds: 2.5,
      guided_work_pause_seconds: 45,
      guided_work_treatment: 'visible countdown and explicit work prompt; optional low-volume rights-cleared music may run only in this bounded pause',
      music_under_narration: false,
      fixed_ten_minute_runtime_required: false,
    },
    stop_conditions: [
      'source, script, voice, identity or request hash drift',
      'missing or unreliable timing data',
      'provider error or uncertain result',
      'unexpected debit or cumulative project-spend breach',
      'omitted, repeated or altered narration',
      'any ordinary narration gap longer than 2.5 seconds',
      'any topic cut that precedes its sentence-complete spoken handoff',
    ],
    boundaries: {
      avatar_generation_allowed: false,
      video_generation_allowed: false,
      production_binding_allowed: false,
      publication_allowed: false,
      distribution_allowed: false,
    },
  }
  candidate.candidate_sha256 = sha(JSON.stringify(candidate))
  writeFileSync(path.join(here, `${lesson.id.toLowerCase()}-request-candidate.json`), `${JSON.stringify(candidate, null, 2)}\n`)
  batch.push({
    lesson_id: lesson.id,
    candidate_sha256: candidate.candidate_sha256,
    speech_text_sha256: candidate.speech_request.text_sha256,
    word_count: candidate.speech_request.word_count,
  })
}

const manifest = {
  schema_version: 1,
  status: 'four_narration_calls_blocked_pending_exact_authorization',
  source_commit: sourceCommit,
  rejected_composite_commit: compositeCommit,
  call_count: 4,
  retries: 0,
  voice_id: voiceId,
  engine: 'heygen_voice',
  lessons: batch,
}
manifest.batch_sha256 = sha(JSON.stringify(manifest))
writeFileSync(path.join(here, 'batch-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify(manifest, null, 2))
