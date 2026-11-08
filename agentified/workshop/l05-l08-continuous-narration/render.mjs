#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const W = 1920
const H = 1080
const fps = 25
const sourceCommit = 'a260c7593758fd6757ea21ef240a9abc83cc3725'
const batchSha = '398b0032f735cae199817634f997db89099dbf0c0a9b6c6c123d318c3067eeb1'
const voiceId = '4f53988b1c314610b514db98432fd0ef'
const ordinaryGap = 0.35
const guidedWorkDuration = 45
const closingCardDuration = 3

const lessons = [
  { id: 'L05', request: '430d9d8621ff77887c79009dca44b122b2e45b1e3f926ce1de025d3cc431fd93', split: 11.91 },
  { id: 'L06', request: '32b04067a9da47f0a640717e3bffe2afb75ba82734f0cfb7b0c7ed927545f189', split: 13.64 },
  { id: 'L07', request: '5f1b708ecb0f91e6360914171cf8ebbea8e89298aeb3af7206141ff1b62f7944', split: 9.37 },
  { id: 'L08', request: '4b702f78df6ea271ea70a1c1e68783b6a27984be5f5aa5ca711df2c009ea5c38', split: 13.525 },
]

function run(args) {
  execFileSync('ffmpeg', ['-y', ...args], { stdio: 'inherit' })
}

function probe(file) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim())
}

function sha(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function esc(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('“', '').replaceAll('”', '')
}

function lines(text, max = 34) {
  const output = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (`${line} ${word}`.trim().length <= max) line = `${line} ${word}`.trim()
    else {
      if (line) output.push(line)
      line = word
    }
  }
  if (line) output.push(line)
  return output
}

function textBlock(values, x, y, size, max, color, weight = 400, gap = 1.18) {
  let cursor = y
  let svg = ''
  for (const value of values) {
    for (const line of lines(value, max)) {
      svg += `<text x="${x}" y="${cursor}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}">${esc(line)}</text>`
      cursor += size * gap
    }
    cursor += size * 0.32
  }
  return svg
}

function clock(value, separator = ',') {
  const ms = Math.round(value * 1000)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`
}

function parseClock(value) {
  const [h, m, tail] = value.replace(',', '.').split(':')
  return Number(h) * 3600 + Number(m) * 60 + Number(tail)
}

function parseSrt(file) {
  return readFileSync(file, 'utf8').trim().split(/\n\s*\n/).map((block) => {
    const rows = block.trim().split('\n')
    const timing = rows.find((row) => row.includes('-->'))
    const [start, end] = timing.split('-->').map((value) => parseClock(value.trim()))
    return { start, end, text: rows.slice(rows.indexOf(timing) + 1).join(' ').trim() }
  })
}

function sentences(text) {
  return text.match(/[^.!?]+(?:[.!?]+[’'"]?|$)/gu)?.map((value) => value.trim()).filter(Boolean) ?? [text]
}

function words(text) {
  return text.trim().split(/\s+/).filter(Boolean)
}

function cueLines(text, max = 47) {
  return lines(text, max).join('\n')
}

function detectSilences(file, threshold = '-42dB', duration = 0.5) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', `silencedetect=noise=${threshold}:d=${duration}`, '-f', 'null', '-'], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`Silence detection failed for ${file}`)
  const events = `${result.stdout}\n${result.stderr}`.split('\n')
  const silences = []
  let start = null
  for (const row of events) {
    const a = row.match(/silence_start:\s*([0-9.]+)/)
    if (a) start = Number(a[1])
    const b = row.match(/silence_end:\s*([0-9.]+)/)
    if (b && start !== null) {
      const end = Number(b[1])
      silences.push({ start, end, duration: end - start })
      start = null
    }
  }
  return silences
}

async function makeFrame(packet, scene, index, dir) {
  const visual = scene.approved_visuals[0]?.path ? path.join(root, scene.approved_visuals[0].path) : null
  const heading = textBlock([scene.audience_copy[0] || packet.title], 105, 210, 56, 31, '#f5eddb', 700)
  const support = textBlock(scene.audience_copy.slice(1), 108, 380, 34, 31, '#b9c8cf')
  let body = ''
  if (visual) body = '<rect x="100" y="325" width="1720" height="620" rx="18" fill="#061726" stroke="#d8ad43" stroke-width="5"/>'
  else if (![0, 7].includes(index)) body = '<rect x="110" y="430" width="1700" height="390" rx="28" fill="#0a2231" stroke="#526e7b" stroke-width="2"/><text x="160" y="510" fill="#d8ad43" font-family="Arial" font-size="24" font-weight="700">OPERATING FILE</text><text x="160" y="600" fill="#f5eddb" font-family="Arial" font-size="48" font-weight="700">Evidence travels with the work.</text><text x="160" y="675" fill="#b9c8cf" font-family="Arial" font-size="36">Human review remains the gate.</text>'
  const progress = Math.round(1720 * (index + 1) / packet.scenes.length)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="1920" height="1080" fill="#071b2a"/><rect x="48" y="42" width="1824" height="996" rx="24" fill="#0d2a3a" stroke="#54707d" stroke-width="2"/><line x1="88" y1="104" x2="1832" y2="104" stroke="#d8ad43" stroke-width="3"/><text x="92" y="80" fill="#f5eddb" font-family="Arial" font-size="24" font-weight="700">AMADUTOWN / AGENTIFIED</text><text x="1585" y="80" fill="#d8ad43" font-family="Arial" font-size="21" font-weight="700">${packet.id} • ${scene.id}</text>${heading}${support}${body}<rect x="100" y="1000" width="1720" height="16" rx="8" fill="#29424e"/><rect x="100" y="1000" width="${progress}" height="16" rx="8" fill="#d8ad43"/></svg>`
  let image = sharp(Buffer.from(svg)).png()
  if (visual) {
    const plate = await sharp(visual).resize({ width: 1690, height: 590, fit: 'contain', background: '#061726' }).png().toBuffer()
    image = image.composite([{ input: plate, left: 115, top: 340 }])
  }
  await image.toFile(path.join(dir, `${scene.id}.png`))
}

const studioBackdrop = `<svg xmlns="http://www.w3.org/2000/svg" width="748" height="412"><defs><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#153946"/><stop offset="0.55" stop-color="#0d2d3b"/><stop offset="1" stop-color="#071d28"/></linearGradient><radialGradient id="light" cx="72%" cy="22%" r="70%"><stop offset="0" stop-color="#66828a" stop-opacity="0.25"/><stop offset="1" stop-color="#071d28" stop-opacity="0"/></radialGradient><filter id="texture"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="17"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.035"/></feComponentTransfer></filter></defs><rect width="748" height="412" fill="url(#base)"/><rect width="748" height="412" fill="url(#light)"/><rect width="748" height="412" filter="url(#texture)" opacity="0.45"/><path d="M0 335 C180 300 300 355 465 325 C590 300 665 315 748 292 V412 H0Z" fill="#071d28" opacity="0.38"/><path d="M0 336 C180 301 300 356 465 326 C590 301 665 316 748 293" fill="none" stroke="#4c6a74" stroke-opacity="0.23"/></svg>`
const studioBackdropPath = path.join(here, 'studio-backdrop.png')
await sharp(Buffer.from(studioBackdrop)).png().toFile(studioBackdropPath)
const guidedWorkSignPath = path.join(here, 'guided-work-sign.png')
const guidedWorkSign = `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="100"><rect x="2" y="2" width="776" height="96" rx="12" fill="#071b2a" fill-opacity="0.94" stroke="#d8ad43" stroke-width="4"/><text x="390" y="63" fill="#f5eddb" font-family="Arial, sans-serif" font-size="42" font-weight="700" text-anchor="middle">GUIDED WORK  ·  45 SECONDS</text></svg>`
await sharp(Buffer.from(guidedWorkSign)).png().toFile(guidedWorkSignPath)

const batchReceipt = JSON.parse(readFileSync(path.join(here, 'batch-provider-receipt.json'), 'utf8'))
assert(batchReceipt.source_commit === sourceCommit, 'batch source commit drift')
assert(batchReceipt.batch_sha256 === batchSha, 'batch hash drift')
assert(batchReceipt.aggregate_credit_cost === 31 && batchReceipt.credits_before === 1250 && batchReceipt.credits_after === 1219, 'credit ledger drift')

const batchResults = []
for (const lesson of lessons) {
  const packet = JSON.parse(readFileSync(path.join(root, `agentified/workshop/scene-production/packets/${lesson.id}.json`), 'utf8'))
  const candidate = JSON.parse(readFileSync(path.join(root, `agentified/workshop/l05-l08-continuous-narration-preflight/${lesson.id.toLowerCase()}-request-candidate.json`), 'utf8'))
  const timing = JSON.parse(readFileSync(path.join(here, lesson.id, 'timing-receipt.json'), 'utf8'))
  const speechReceipt = JSON.parse(readFileSync(path.join(here, lesson.id, 'provider-receipt.json'), 'utf8'))
  assert(candidate.candidate_sha256 === lesson.request, `${lesson.id} request drift`)
  assert(speechReceipt.request_sha256 === lesson.request && speechReceipt.submissions === 1 && speechReceipt.retries === 0, `${lesson.id} provider receipt drift`)
  assert(speechReceipt.provider_usage.exact_credit_debit <= 10, `${lesson.id} credit cap exceeded`)

  const sourceDir = path.join(root, `agentified/workshop/l05-l08-native-source/${lesson.id}`)
  const presenterSource = path.join(sourceDir, `agentified-${lesson.id.toLowerCase()}-heygen-native-source.mp4`)
  const providerSrt = path.join(sourceDir, 'provider-captions.srt')
  const narrationSource = path.join(here, lesson.id, `agentified-${lesson.id.toLowerCase()}-continuous-narration-source.mp3`)
  const presenterDuration = probe(presenterSource)
  const narrationDuration = probe(narrationSource)
  const closingDuration = presenterDuration - lesson.split
  assert(lesson.split > 0 && closingDuration > 0, `${lesson.id} presenter split invalid`)
  assert(Math.abs(narrationDuration - timing.local_duration_seconds) < 0.02, `${lesson.id} narration duration drift`)

  const timedWords = timing.word_timestamps.filter((word) => !['<start>', '<end>'].includes(word.word))
  const expectedWords = candidate.narration_segments.flatMap((segment) => words(segment.narration_exact))
  assert(timedWords.length === expectedWords.length, `${lesson.id} provider word count drift`)

  let sourceCursor = 0
  let sequenceCursor = lesson.split + 0.25
  const segmentPlacements = []
  const sentencePlacements = []
  const cues = parseSrt(providerSrt).filter((cue) => cue.start < lesson.split + 0.01)
  let guidedWorkWindow = null

  candidate.narration_segments.forEach((segment, segmentIndex) => {
    const segmentWords = words(segment.narration_exact)
    const wordSlice = timedWords.slice(sourceCursor, sourceCursor + segmentWords.length)
    assert(wordSlice.length === segmentWords.length, `${lesson.id} ${segment.scene_id} timing underflow`)
    const sourceStart = wordSlice[0].start
    const sourceEnd = wordSlice.at(-1).end
    const sequenceStart = sequenceCursor
    const sequenceEnd = sequenceStart + sourceEnd - sourceStart
    const sentenceRows = sentences(segment.narration_exact)
    let sentenceWordCursor = 0
    for (const sentence of sentenceRows) {
      const count = words(sentence).length
      const sentenceWords = wordSlice.slice(sentenceWordCursor, sentenceWordCursor + count)
      const start = sequenceStart + sentenceWords[0].start - sourceStart
      const end = sequenceStart + sentenceWords.at(-1).end - sourceStart
      cues.push({ start, end, text: sentence })
      sentencePlacements.push({ scene_id: segment.scene_id, text: sentence, source_start: sentenceWords[0].start, source_end: sentenceWords.at(-1).end, sequence_start: start, sequence_end: end })
      sentenceWordCursor += count
    }
    assert(sentenceWordCursor === segmentWords.length, `${lesson.id} ${segment.scene_id} sentence timing drift`)
    segmentPlacements.push({ scene_id: segment.scene_id, source_start: sourceStart, source_end: sourceEnd, sequence_start: sequenceStart, sequence_end: sequenceEnd })
    sourceCursor += segmentWords.length
    sequenceCursor = sequenceEnd + ordinaryGap
    if (segmentIndex === 6) {
      guidedWorkWindow = { start: sequenceCursor, end: sequenceCursor + guidedWorkDuration, duration: guidedWorkDuration, purpose: 'clearly signposted guided learner work' }
      sequenceCursor = guidedWorkWindow.end
    }
  })
  assert(sourceCursor === timedWords.length, `${lesson.id} unbound provider words`)
  const closingStart = sequenceCursor
  const closingEnd = closingStart + closingDuration
  const totalDuration = closingEnd + closingCardDuration

  const closingCues = parseSrt(providerSrt)
    .filter((cue) => cue.end > lesson.split)
    .map((cue) => ({
      ...cue,
      start: closingStart + Math.max(0, cue.start - lesson.split),
      end: closingStart + cue.end - lesson.split,
    }))
  cues.push(...closingCues)
  cues.sort((a, b) => a.start - b.start)

  const frames = path.join(here, `frames-${lesson.id}`)
  mkdirSync(frames, { recursive: true })
  for (const [index, scene] of packet.scenes.entries()) await makeFrame(packet, scene, index, frames)

  const sceneStarts = [0, ...segmentPlacements.slice(1).map((placement) => placement.sequence_start)]
  const sceneEnds = [...sceneStarts.slice(1), totalDuration]
  const sceneDurations = sceneEnds.map((end, index) => end - sceneStarts[index])
  assert(sceneDurations.every((duration) => duration > 0), `${lesson.id} invalid scene durations`)
  const baseInputs = []
  const baseFilters = []
  packet.scenes.forEach((scene, index) => {
    baseInputs.push('-loop', '1', '-t', String(sceneDurations[index]), '-i', path.join(frames, `${scene.id}.png`))
    baseFilters.push(`[${index}:v]fps=${fps},format=yuv420p[v${index}]`)
  })
  baseFilters.push(`${packet.scenes.map((_, index) => `[v${index}]`).join('')}concat=n=${packet.scenes.length}:v=1:a=0[base]`)
  const basePath = path.join(here, `${lesson.id}-base.mp4`)
  run([...baseInputs, '-filter_complex', baseFilters.join(';'), '-map', '[base]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(fps), basePath])

  const inset = 'colorkey=0x00e868:0.28:0.08,despill=type=green:mix=0.05:expand=0.02,scale=748:412:force_original_aspect_ratio=decrease,pad=748:412:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba'
  const narrationFilters = segmentPlacements.map((placement, index) => {
    const delay = Math.round(placement.sequence_start * 1000)
    return `[2:a]atrim=${placement.source_start}:${placement.source_end},asetpts=PTS-STARTPTS,adelay=${delay}|${delay},aformat=sample_rates=48000:channel_layouts=stereo[n${index + 1}]`
  })
  const narrationInputs = segmentPlacements.map((_, index) => `[n${index + 1}]`).join('')
  const graph = [
    `color=c=#092433:s=768x432:r=${fps}:d=${lesson.split},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame1]`,
    `[3:v]trim=duration=${lesson.split},setpts=PTS-STARTPTS,scale=748:412[bg1]`,
    '[frame1][bg1]overlay=10:10:eof_action=pass:repeatlast=1[studio1]',
    `[1:v]trim=0:${lesson.split},setpts=PTS-STARTPTS,${inset}[p1]`,
    `[studio1][p1]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=${Math.max(0, lesson.split - 0.5)}:d=0.5:alpha=1[panel1]`,
    `color=c=black@0.0:s=768x432:r=${fps}:d=${totalDuration},format=rgba[p2blank]`,
    `color=c=#092433:s=768x432:r=${fps}:d=${closingDuration},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame2]`,
    `[3:v]trim=duration=${closingDuration},setpts=PTS-STARTPTS,scale=748:412[bg2]`,
    '[frame2][bg2]overlay=10:10:eof_action=pass:repeatlast=1[studio2]',
    `[1:v]trim=${lesson.split}:${presenterDuration},setpts=PTS-STARTPTS,${inset}[p2]`,
    `[studio2][p2]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=${Math.max(0, closingDuration - 0.3)}:d=0.3:alpha=1,setpts=PTS+${closingStart}/TB[p2shift]`,
    '[p2blank][p2shift]overlay=0:0:eof_action=pass:repeatlast=0:format=auto[p2track]',
    '[0:v][panel1]overlay=1048:326:eof_action=pass:repeatlast=0[v1]',
    '[v1][p2track]overlay=1048:326:eof_action=pass:repeatlast=0:format=auto[v2]',
    '[4:v]scale=780:100,format=rgba[guidedsign]',
    `[v2][guidedsign]overlay=570:870:eof_action=pass:repeatlast=1:enable='between(t,${guidedWorkWindow.start},${guidedWorkWindow.end})'[vout]`,
    `[1:a]atrim=0:${lesson.split},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a1]`,
    ...narrationFilters,
    `[1:a]atrim=${lesson.split}:${presenterDuration},asetpts=PTS-STARTPTS,adelay=${Math.round(closingStart * 1000)}|${Math.round(closingStart * 1000)},aformat=sample_rates=48000:channel_layouts=stereo[a2]`,
    `anullsrc=r=48000:cl=stereo:d=${totalDuration}[silence]`,
    `[silence][a1]${narrationInputs}[a2]amix=inputs=${segmentPlacements.length + 3}:duration=longest:normalize=0:dropout_transition=0,alimiter=limit=0.95[aout]`,
  ].join(';')

  const rawPath = path.join(here, `${lesson.id}-raw.mp4`)
  const outputPath = path.join(here, `agentified-${lesson.id.toLowerCase()}-continuous-narration-composite.mp4`)
  run(['-i', basePath, '-i', presenterSource, '-i', narrationSource, '-loop', '1', '-i', studioBackdropPath, '-loop', '1', '-i', guidedWorkSignPath, '-filter_complex', graph, '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(totalDuration), rawPath])

  const srt = cues.map((cue, index) => `${index + 1}\n${clock(cue.start)} --> ${clock(cue.end)}\n${cueLines(cue.text)}\n`).join('\n')
  const vtt = `WEBVTT\n\n${cues.map((cue) => `${clock(cue.start, '.')} --> ${clock(cue.end, '.')}\n${cueLines(cue.text)}\n`).join('\n')}`
  const srtPath = path.join(here, `agentified-${lesson.id.toLowerCase()}-continuous-narration-captions.srt`)
  const vttPath = path.join(here, `agentified-${lesson.id.toLowerCase()}-continuous-narration-captions.vtt`)
  writeFileSync(srtPath, srt)
  writeFileSync(vttPath, vtt)
  run(['-i', rawPath, '-i', srtPath, '-map', '0:v:0', '-map', '0:a:0', '-map', '1:0', '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default', '-movflags', '+faststart', outputPath])

  const silences = detectSilences(outputPath)
  const allowed = [
    { ...guidedWorkWindow, tolerance: 1.25 },
    { start: closingEnd, end: totalDuration, duration: closingCardDuration, purpose: 'provider-free close', tolerance: 0.5 },
  ]
  const unexpected = silences.filter((silence) => silence.duration > 2.5 && !allowed.some((window) => silence.start >= window.start - window.tolerance && silence.end <= window.end + window.tolerance))
  assert(unexpected.length === 0, `${lesson.id} unexpected silence: ${JSON.stringify(unexpected)}`)

  const receipt = {
    schema_version: 1,
    status: 'provider_free_continuous_narration_composite_ready_for_human_qa',
    lesson_id: lesson.id,
    source_commit: sourceCommit,
    batch_sha256: batchSha,
    request_candidate_sha256: candidate.candidate_sha256,
    speech_text_sha256: candidate.speech_request.text_sha256,
    provider_request_id: speechReceipt.request_id,
    voice_id: voiceId,
    exact_credit_debit: speechReceipt.provider_usage.exact_credit_debit,
    narration_source: { path: path.relative(root, narrationSource), sha256: sha(narrationSource), duration_seconds: narrationDuration },
    presenter_source: {
      path: path.relative(root, presenterSource),
      sha256: sha(presenterSource),
      source_split_seconds: lesson.split,
      placements: [
        { source_start: 0, source_end: lesson.split, sequence_start: 0, sequence_end: lesson.split },
        { source_start: lesson.split, source_end: presenterDuration, sequence_start: closingStart, sequence_end: closingEnd },
      ],
      background_treatment: 'provider_free_textured_studio_reconstruction',
    },
    segment_placements: segmentPlacements,
    sentence_placements: sentencePlacements,
    guided_work_window: guidedWorkWindow,
    transition_policy: { sentence_complete_handoffs: true, ordinary_gap_seconds: ordinaryGap, music_used: false, fixed_ten_minute_padding: false },
    composite: { path: path.relative(root, outputPath), sha256: sha(outputPath), duration_seconds: probe(outputPath) },
    captions: { srt_path: path.relative(root, srtPath), srt_sha256: sha(srtPath), vtt_path: path.relative(root, vttPath), vtt_sha256: sha(vttPath) },
    continuity_validation: { ordinary_silence_limit_seconds: 2.5, detected_silences: silences, allowed_quiet_windows: allowed, unexpected_silences: unexpected, status: 'pass' },
    boundaries: { provider_calls_after_speech: 0, learner_playback_changed: false, narration_rewritten: false, publication_or_distribution: false },
  }
  writeFileSync(path.join(here, `${lesson.id.toLowerCase()}-validation-receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`)
  batchResults.push({ lesson_id: lesson.id, composite_sha256: receipt.composite.sha256, duration_seconds: receipt.composite.duration_seconds, exact_credit_debit: receipt.exact_credit_debit })
  rmSync(basePath, { force: true })
  rmSync(rawPath, { force: true })
  rmSync(frames, { recursive: true, force: true })
  console.log(`${lesson.id}: ${receipt.composite.sha256} ${receipt.composite.duration_seconds.toFixed(3)}s`)
}

writeFileSync(path.join(here, 'batch-validation-receipt.json'), `${JSON.stringify({
  schema_version: 1,
  status: 'four_continuous_narration_composites_ready_for_human_qa',
  source_commit: sourceCommit,
  batch_sha256: batchSha,
  jobs_submitted: 4,
  retries: 0,
  aggregate_credit_cost: 31,
  music_used: false,
  fixed_ten_minute_padding: false,
  lessons: batchResults,
}, null, 2)}\n`)
rmSync(studioBackdropPath, { force: true })
rmSync(guidedWorkSignPath, { force: true })
console.log('L05-L08 continuous narration render complete')

