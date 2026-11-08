import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const packetPath = path.join(root, 'agentified/workshop/scene-production/packets/L01.json')
const currentCompositePath = path.join(root, 'agentified/workshop/l01-gray-sweater-replacement/agentified-l01-gray-sweater-composite.mp4')
const currentSourcePath = path.join(root, 'agentified/workshop/l01-gray-sweater-replacement/agentified-l01-gray-sweater-source.mp4')
const outputPath = path.join(here, 'request-candidate.json')
const receiptPath = path.join(here, 'validation-receipt.json')

const sha = (value) => createHash('sha256').update(value).digest('hex')
const fileSha = (value) => sha(readFileSync(value))
const normalize = (value) => value.replace(/^[“"]|[”"]$/g, '').trim()
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const packet = JSON.parse(readFileSync(packetPath, 'utf8'))
const opening = 'Friday afternoon. Morgan runs a small community learning program. For this course, we’ll follow Harbor Learning Circle, an illustrative case built from fictional records. Someone suggests adding a free digital-skills session next month.'
const closing = 'Next we will name the decision Morgan actually owns.'
const sceneNarration = packet.scenes.map((scene) => ({
  scene_id: scene.id,
  sequence_start: scene.start_seconds,
  sequence_end: scene.end_seconds,
  narration_exact: normalize(scene.narration_exact),
}))

assert(sceneNarration[0].narration_exact.startsWith(opening), 'Approved L01 opening passage drifted')
assert(sceneNarration.at(-1).narration_exact.endsWith(closing), 'Approved L01 closing passage drifted')

const missingSegments = sceneNarration.map((scene, index) => {
  let text = scene.narration_exact
  let placementStart = scene.sequence_start
  let placementEnd = scene.sequence_end
  if (index === 0) {
    text = text.slice(opening.length).trim()
    placementStart = 13.633
  }
  if (index === sceneNarration.length - 1) {
    text = text.slice(0, -closing.length).trim()
    placementEnd = 518.84
  }
  return {
    scene_id: scene.scene_id,
    sequence_start: placementStart,
    sequence_end: placementEnd,
    available_seconds: Number((placementEnd - placementStart).toFixed(3)),
    narration_exact: text,
    narration_sha256: sha(text),
  }
}).filter((segment) => segment.narration_exact.length > 0)

const speechText = missingSegments.map((segment) => segment.narration_exact).join('\n\n')
const wordCount = speechText.split(/\s+/).filter(Boolean).length
assert(speechText.length <= 5000, 'Narration request exceeds HeyGen create_speech text limit')

const candidate = {
  schema_version: 1,
  status: 'provider_execution_blocked_pending_exact_authorization',
  lesson_id: 'L01',
  correction_scope: 'continuous approved narration under provider-free slides while preserving existing presenter windows',
  portfolio_pr: 1251,
  correction_head: '437787e12c1589b1852ab9fde971c75c6097b89f',
  approved_script_source_commit: 'e51b09b746256e1c6825d249438bcd4a0e6f181e',
  script_path: 'agentified/workshop/scripts/L01-job-and-receipt.md',
  script_sha256: packet.script_sha256,
  packet_path: 'agentified/workshop/scene-production/packets/L01.json',
  packet_sha256: fileSha(packetPath),
  existing_native_source_sha256: fileSha(currentSourcePath),
  existing_composite_sha256: fileSha(currentCompositePath),
  provider_candidate: 'HeyGen create_speech',
  requested_call_limit: 1,
  automatic_retries: 0,
  manual_retries: 0,
  execution_allowed: false,
  spending_allowed: false,
  voice: {
    id: '14b592b937744404a4fa7c01aafd7dbe',
    name: 'Vambah avatar-native voice',
    engine: 'heygen_voice',
    purpose: 'Agentified L01 review-only off-screen narration correction',
  },
  speech_request: {
    input_type: 'text',
    language: 'en',
    speed: 1,
    text: speechText,
    text_sha256: sha(speechText),
    character_count: speechText.length,
    word_count: wordCount,
    requested_word_timestamps: true,
  },
  existing_presenter_audio: {
    opening: { sequence_start: 0, sequence_end: 13.633 },
    closing: { sequence_start: 518.84, sequence_end: 521.593 },
    rule: 'Preserve native presenter audio in these windows. Never layer synthesized narration over it.',
  },
  narration_segments: missingSegments,
  composition_rules: [
    'Presenter footage may yield to approved teaching plates after a sentence-complete handoff.',
    'Approved narration continues under teaching plates except during the intentional guided-work pause.',
    'Use returned word timestamps to split the single narration source at exact segment boundaries.',
    'Place each segment at its version-bound sequence start and fail closed if it exceeds its available scene window.',
    'Preserve the existing 09:00 lesson duration, presenter footage, teaching plates, captions, privacy boundaries and final provider-free close.',
  ],
  quiet_window: {
    scene_id: 'L01-07',
    purpose: 'guided learner work',
    rule: 'Only the unused remainder after the approved L01-07 narration may remain quiet.',
  },
  stop_conditions: [
    'source, script, voice, identity or request hash drift',
    'missing or unreliable timing data',
    'any segment exceeding its version-bound scene window',
    'provider error or uncertain result',
    'unexpected debit or cumulative project-spend breach',
    'omitted, repeated or altered narration',
  ],
  boundaries: {
    upload_allowed: false,
    avatar_generation_allowed: false,
    video_generation_allowed: false,
    publication_allowed: false,
    distribution_allowed: false,
    production_binding_allowed: false,
  },
}

candidate.candidate_sha256 = sha(JSON.stringify(candidate))

const receipt = {
  schema_version: 1,
  status: 'validated_provider_free_preflight_only',
  provider_calls: 0,
  media_generated: 0,
  spend_usd: 0,
  candidate_sha256: candidate.candidate_sha256,
  checks: {
    exact_approved_narration: true,
    existing_presenter_passages_excluded: true,
    one_speech_call: true,
    request_under_character_limit: true,
    version_bound_placements: true,
    intentional_quiet_work_preserved: true,
    execution_blocked: true,
  },
}

mkdirSync(here, { recursive: true })
for (const [destination, value] of [[outputPath, candidate], [receiptPath, receipt]]) {
  const body = `${JSON.stringify(value, null, 2)}\n`
  if (process.argv.includes('--check')) {
    assert(readFileSync(destination, 'utf8') === body, `${path.basename(destination)} is stale`)
  } else {
    writeFileSync(destination, body)
  }
}

console.log(`L01 continuous narration candidate ${candidate.candidate_sha256}`)
