#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const candidatePath = path.join(root, 'agentified/workshop/l01-continuous-narration-preflight/request-candidate.json')
const visualSource = path.join(root, 'agentified/workshop/l01-gray-sweater-replacement/agentified-l01-gray-sweater-composite.mp4')
const narrationSource = path.join(here, 'agentified-l01-continuous-narration-source.mp3')
const captionsPath = path.join(here, 'agentified-l01-continuous-narration-captions.srt')
const captionsVttPath = path.join(here, 'agentified-l01-continuous-narration-captions.vtt')
const outputPath = path.join(here, 'agentified-l01-continuous-narration-composite.mp4')
const receiptPath = path.join(here, 'validation-receipt.json')

const sourceRanges = [
  [0, 16.952],
  [17.187, 47.998],
  [48.309, 82.870],
  [83.084, 113.629],
  [113.863, 141.620],
  [141.983, 157.129],
  [157.373, 185.668],
  [186.031, 196.081],
]

function run(args) {
  execFileSync('ffmpeg', ['-y', ...args], { stdio: 'inherit' })
}

function sha(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function stamp(seconds, vtt = false) {
  const totalMs = Math.max(0, Math.round(seconds * 1000))
  const hours = Math.floor(totalMs / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  const secs = Math.floor((totalMs % 60_000) / 1000)
  const ms = totalMs % 1000
  const separator = vtt ? '.' : ','
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${separator}${String(ms).padStart(3, '0')}`
}

function sentences(text) {
  return text.match(/[^.!?]+(?:[.!?]+[’'"]?|$)/gu)?.map(value => value.trim()).filter(Boolean) ?? [text]
}

function detectSilences(file, noise = '-38dB', duration = 0.25) {
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-i', file,
    '-af', `silencedetect=noise=${noise}:d=${duration}`,
    '-f', 'null', '-',
  ], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`Silence detection failed for ${file}`)

  const events = `${result.stdout}\n${result.stderr}`.split('\n')
  const silences = []
  let start = null
  for (const line of events) {
    const startMatch = line.match(/silence_start:\s*([0-9.]+)/)
    if (startMatch) start = Number(startMatch[1])
    const endMatch = line.match(/silence_end:\s*([0-9.]+)/)
    if (endMatch && start !== null) {
      const end = Number(endMatch[1])
      silences.push({ start, end, center: (start + end) / 2, duration: end - start })
      start = null
    }
  }
  return silences
}

function alignSentenceRanges(text, sourceStart, sourceEnd, silences) {
  const parts = sentences(text)
  const weights = parts.map(sentence => sentence.split(/\s+/).length)
  const totalWeight = weights.reduce((sum, value) => sum + value, 0)
  const cuts = []
  let cumulativeWeight = 0
  let previousCut = sourceStart

  for (let index = 0; index < parts.length - 1; index += 1) {
    cumulativeWeight += weights[index]
    const expected = sourceStart + (sourceEnd - sourceStart) * cumulativeWeight / totalWeight
    const candidates = silences
      .filter(silence => silence.center > previousCut + 0.2 && silence.center < sourceEnd - 0.2)
      .sort((a, b) => Math.abs(a.center - expected) - Math.abs(b.center - expected))
    const selected = candidates[0]
    if (!selected || Math.abs(selected.center - expected) > 1.75) {
      throw new Error(`Could not align a sentence-complete cut near ${expected.toFixed(3)}s`)
    }
    cuts.push({ source_time: selected.center, expected, delta: selected.center - expected })
    previousCut = selected.center
  }

  const boundaries = [sourceStart, ...cuts.map(cut => cut.source_time), sourceEnd]
  return parts.map((textPart, index) => ({
    text: textPart,
    source_start: boundaries[index],
    source_end: boundaries[index + 1],
    alignment_delta_seconds: index < cuts.length ? cuts[index].delta : null,
  }))
}

function cueLines(text, max = 47) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = `${line} ${word}`.trim()
    if (next.length <= max) line = next
    else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.join('\n')
}

const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'))
if (candidate.candidate_sha256 !== '86587e8fbbf8673d18138603b5d4de825f2d7125acdced35cb686728c742e34d') {
  throw new Error('Narration request candidate drifted')
}
if (candidate.narration_segments.length !== sourceRanges.length) {
  throw new Error('Narration segment count drifted')
}

const cues = [
  { start: 0.2, end: 1.699, text: 'Friday afternoon.' },
  { start: 1.899, end: 4.458, text: 'Morgan runs a small community learning program.' },
  { start: 4.458, end: 10.075, text: 'For this course, we’ll follow Harbor Learning Circle, an illustrative case built from fictional records.' },
  { start: 10.075, end: 13.633, text: 'Someone suggests adding a free digital-skills session next month.' },
]
const sourceSilences = detectSilences(narrationSource, '-38dB', 0.12)
const sentencePlacements = []
const paragraphPlacements = []

candidate.narration_segments.forEach((segment, index) => {
  const [sourceStart, sourceEnd] = sourceRanges[index]
  const aligned = alignSentenceRanges(segment.narration_exact, sourceStart, sourceEnd, sourceSilences)
  const speechDuration = aligned.reduce((sum, sentence) => sum + sentence.source_end - sentence.source_start, 0)
  const availableDuration = segment.sequence_end - segment.sequence_start
  const guidedWorkScene = segment.scene_id === 'L01-07'
  const gap = guidedWorkScene ? 0.25 : (availableDuration - speechDuration) / (aligned.length + 1)
  if (gap < 0) throw new Error(`${segment.scene_id} narration exceeds its approved window`)

  let cursor = segment.sequence_start
  const placed = aligned.map((sentence, sentenceIndex) => {
    cursor += gap
    const sequenceStart = cursor
    const sequenceEnd = sequenceStart + sentence.source_end - sentence.source_start
    cursor = sequenceEnd
    const placement = {
      scene_id: segment.scene_id,
      sentence_index: sentenceIndex + 1,
      text: sentence.text,
      source_start: sentence.source_start,
      source_end: sentence.source_end,
      sequence_start: sequenceStart,
      sequence_end: sequenceEnd,
      alignment_delta_seconds: sentence.alignment_delta_seconds,
    }
    cues.push({ start: sequenceStart, end: sequenceEnd, text: sentence.text })
    sentencePlacements.push(placement)
    return placement
  })

  paragraphPlacements.push({
    scene_id: segment.scene_id,
    available_start: segment.sequence_start,
    available_end: segment.sequence_end,
    first_sentence_start: placed[0].sequence_start,
    last_sentence_end: placed.at(-1).sequence_end,
    sentence_count: placed.length,
    distributed_gap_seconds: gap,
  })
})

cues.push({
  start: 518.84,
  end: 521.586,
  text: 'Next we will name the decision Morgan actually owns.',
})
cues.sort((a, b) => a.start - b.start)

const srt = cues.map((cue, index) => `${index + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cueLines(cue.text)}\n`).join('\n')
const vtt = `WEBVTT\n\n${cues.map(cue => `${stamp(cue.start, true)} --> ${stamp(cue.end, true)}\n${cueLines(cue.text)}\n`).join('\n')}`
writeFileSync(captionsPath, srt)
writeFileSync(captionsVttPath, vtt)

const filters = ['[0:a]aformat=sample_rates=48000:channel_layouts=stereo[base]']
const narrationLabels = []
sentencePlacements.forEach((placement, index) => {
  const label = `n${index + 1}`
  const delayMs = Math.round(placement.sequence_start * 1000)
  filters.push(`[1:a]atrim=${placement.source_start}:${placement.source_end},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},aformat=sample_rates=48000:channel_layouts=stereo[${label}]`)
  narrationLabels.push(`[${label}]`)
})
filters.push(`[base]${narrationLabels.join('')}amix=inputs=${narrationLabels.length + 1}:duration=longest:normalize=0:dropout_transition=0,alimiter=limit=0.95[aout]`)

const rawPath = path.join(here, 'composite-raw.mp4')
run([
  '-i', visualSource,
  '-i', narrationSource,
  '-filter_complex', filters.join(';'),
  '-map', '0:v:0',
  '-map', '[aout]',
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ar', '48000',
  '-t', '540',
  rawPath,
])
run([
  '-i', rawPath,
  '-i', captionsPath,
  '-map', '0:v:0',
  '-map', '0:a:0',
  '-map', '1:0',
  '-c:v', 'copy',
  '-c:a', 'copy',
  '-c:s', 'mov_text',
  '-metadata:s:s:0', 'language=eng',
  '-disposition:s:0', 'default',
  '-movflags', '+faststart',
  outputPath,
])
execFileSync('rm', ['-f', rawPath])

const guidedWorkParagraph = paragraphPlacements.find(placement => placement.scene_id === 'L01-07')
const closingParagraph = paragraphPlacements.find(placement => placement.scene_id === 'L01-08')
const outputSilences = detectSilences(outputPath, '-42dB', 3)
const allowedQuietWindows = [
  { start: guidedWorkParagraph.last_sentence_end, end: closingParagraph.first_sentence_start + 0.25, purpose: 'guided learner work' },
  { start: 521.35, end: 540.1, purpose: 'provider-free closing evidence card' },
]
const unexpectedLongSilences = outputSilences.filter(silence => {
  if (silence.duration < 12) return false
  return !allowedQuietWindows.some(window => silence.start >= window.start - 0.25 && silence.end <= window.end + 0.25)
})
if (unexpectedLongSilences.length > 0) {
  throw new Error(`Unexpected long narration gaps: ${JSON.stringify(unexpectedLongSilences)}`)
}

writeFileSync(receiptPath, JSON.stringify({
  schema_version: 1,
  status: 'provider_free_composite_ready_for_human_qa',
  lesson_id: 'L01',
  request_candidate_sha256: candidate.candidate_sha256,
  speech_text_sha256: candidate.speech_request.text_sha256,
  provider_request_id: '6f37737b78bc4401953600004895c256',
  requested_engine: 'heygen_voice',
  returned_engine: 'orca',
  voice_id: candidate.voice.id,
  exact_credit_debit: 8,
  cash_purchase: 0,
  provider_duration_seconds: 196.31020408163266,
  narration_source: {
    path: path.relative(root, narrationSource),
    sha256: sha(narrationSource),
  },
  visual_source: {
    path: path.relative(root, visualSource),
    sha256: sha(visualSource),
  },
  composite: {
    path: path.relative(root, outputPath),
    sha256: sha(outputPath),
    duration_seconds: 540,
  },
  captions: {
    srt_path: path.relative(root, captionsPath),
    srt_sha256: sha(captionsPath),
    vtt_path: path.relative(root, captionsVttPath),
    vtt_sha256: sha(captionsVttPath),
  },
  preserved_presenter_audio: candidate.existing_presenter_audio,
  narration_placements: paragraphPlacements,
  sentence_placements: sentencePlacements,
  quiet_window: {
    scene_id: 'L01-07',
    start: guidedWorkParagraph.last_sentence_end,
    end: candidate.narration_segments[7].sequence_start,
    purpose: 'guided learner work',
  },
  continuity_validation: {
    maximum_unexpected_silence_seconds: 12,
    detected_silences_over_three_seconds: outputSilences,
    allowed_quiet_windows: allowedQuietWindows,
    unexpected_long_silences: unexpectedLongSilences,
    status: 'pass',
  },
  boundaries: {
    provider_calls_after_speech: 0,
    narration_rewritten: false,
    production_binding_changed: false,
    publication_or_distribution: false,
  },
}, null, 2) + '\n')

console.log(`${outputPath}\nsha256=${sha(outputPath)}`)
