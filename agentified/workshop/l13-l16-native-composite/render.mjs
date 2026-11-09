#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { expectedCaptionText, normalizeCaptionText, splitSentences } from './caption-contract.mjs'
import { AUTHORIZATION_PATH, AUTHORIZATION_SHA256, REQUESTS } from './execution-authorization.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const W = 1920
const H = 1080
const fps = 25
const pauseSeconds = 45
const sourceCommit = '5d61cadff39b46d5d17add8e06370cc25a18de41'
const batchSha = '18b3a6bfa3ee1dc6fadedb2cc969a312e8a9acf935bfb50684ad0d812b0cb194'
const lookId = '7275ba9035f94b31ad589dda6532d002'
const voiceId = '4f53988b1c314610b514db98432fd0ef'
const startingBalance = 768
const finalBalance = 720
const lessons = [
  { id: 'L13', request: 'ca8117572b7e862a9dcdd15b1b901886cfe1068dbc2be487c6cde6f17cb84876', presenterJob: '8aec6efe3400f99a533addcf34840a27', presenterCost: 10, narrationCost: 1, balanceAfter: 757 },
  { id: 'L14', request: '93414761a5a5a49ebc6068bf72ef5f0055418030f27ec57abe0fafe4f9781e6b', presenterJob: 'ad857f05cc75c54a48f7d1e143639625', presenterCost: 9, narrationCost: 1, balanceAfter: 747 },
  { id: 'L15', request: '9683b252bff8ec732942905713cc98f06f6d8643814c547d8ad1cc580c8dd224', presenterJob: '6bec2d5b09f8bc5f3b747f5c13c213bf', presenterCost: 11, narrationCost: 1, balanceAfter: 735 },
  { id: 'L16', request: '2a9fc51f0bdaa64401b57a10d3beac2989d51286187fc5fd11525ed2bb16b314', presenterJob: '25b6988235318f42abadd8b3b76c1a9c', presenterCost: 14, narrationCost: 1, balanceAfter: 720 },
]

const run = (args) => execFileSync('ffmpeg', ['-y', ...args], { stdio: 'inherit' })
const probe = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim())
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('“', '').replaceAll('”', '')
const normalizeWord = (value) => value.toLowerCase().replaceAll(/[’‘]/g, "'").replaceAll(/[^a-z0-9']/g, '')
const normalizeText = (value) => value.split(/\s+/).map(normalizeWord).filter(Boolean).join(' ')
const clock = (value, separator = ',') => {
  const ms = Math.max(0, Math.round(value * 1000))
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`
}

function parseSrt(value) {
  return value.trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n')
    const match = lines[1].match(/(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)/)
    assert(match, 'invalid presenter subtitle timing')
    const toSeconds = (offset) => Number(match[offset]) * 3600 + Number(match[offset + 1]) * 60 + Number(match[offset + 2]) + Number(match[offset + 3]) / 1000
    return { start: toSeconds(1), end: toSeconds(5), text: lines.slice(2).join(' ').trim() }
  })
}

function alignExpectedWords(expected, observed) {
  const n = expected.length
  const m = observed.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = 0; i <= n; i += 1) dp[i][0] = i
  for (let j = 0; j <= m; j += 1) dp[0][j] = j
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const cost = expected[i - 1] === observed[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  const mapping = new Array(n).fill(null)
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const cost = expected[i - 1] === observed[j - 1] ? 0 : 1
      if (dp[i][j] === dp[i - 1][j - 1] + cost) { mapping[i - 1] = j - 1; i -= 1; j -= 1; continue }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) { i -= 1; continue }
    j -= 1
  }
  let last = 0
  for (let k = 0; k < mapping.length; k += 1) {
    if (mapping[k] === null) mapping[k] = last
    last = mapping[k]
  }
  for (let k = mapping.length - 2; k >= 0; k -= 1) mapping[k] = Math.min(mapping[k], mapping[k + 1])
  return { mapping, distance: dp[n][m] }
}

function narrationCues(candidate, timing) {
  const segmentText = candidate.offscreen_narration.segments.map((segment) => segment.text).join('\n\n')
  assert(normalizeText(candidate.offscreen_narration.text) === normalizeText(segmentText), `${candidate.lesson_id} narration segment drift`)
  const observed = timing.original_words.map((word) => ({ ...word, normalized: normalizeWord(word.text) })).filter((word) => word.normalized)
  const observedWords = observed.map((word) => word.normalized)
  const expectedWords = []
  const sentences = []
  for (const segment of candidate.offscreen_narration.segments) {
    for (const text of splitSentences(segment.text)) {
      const startWord = expectedWords.length
      const words = text.split(/\s+/).map(normalizeWord).filter(Boolean)
      expectedWords.push(...words)
      sentences.push({ scene: segment.scene_id, text, startWord, endWord: expectedWords.length - 1 })
    }
  }
  const { mapping, distance } = alignExpectedWords(expectedWords, observedWords)
  const cues = sentences.map((sentence) => {
    const first = observed[mapping[sentence.startWord]]
    const last = observed[mapping[sentence.endWord]]
    assert(first && last, `${candidate.lesson_id} narration alignment failed`)
    return { ...sentence, sourceStart: first.start_time, sourceEnd: last.end_time }
  })
  return { cues, distance, expectedWordCount: expectedWords.length, observedWordCount: observedWords.length }
}

function wrap(text, max = 36) {
  const output = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (`${line} ${word}`.trim().length <= max) line = `${line} ${word}`.trim()
    else { if (line) output.push(line); line = word }
  }
  if (line) output.push(line)
  return output
}

function textBlock(values, x, y, size, max, color, weight = 400, gap = 1.18) {
  let cursor = y
  let svg = ''
  for (const value of values) {
    for (const line of wrap(value, max)) {
      svg += `<text x="${x}" y="${cursor}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}">${esc(line)}</text>`
      cursor += size * gap
    }
    cursor += size * 0.32
  }
  return svg
}

async function makeFrame(packet, scene, dir, isClosing = false) {
  const visual = !isClosing && scene.approved_visuals[0]?.path ? path.join(root, scene.approved_visuals[0].path) : null
  const primary = isClosing ? scene.audience_copy : [scene.audience_copy[0] || packet.title]
  const supportCopy = isClosing ? [] : scene.audience_copy.slice(1)
  const heading = textBlock(primary, 105, isClosing ? 405 : 210, isClosing ? 68 : 56, isClosing ? 38 : 31, '#f5eddb', 700)
  const support = textBlock(supportCopy, 108, 380, 34, 31, '#b9c8cf')
  let body = ''
  if (visual) body = '<rect x="100" y="325" width="1720" height="620" rx="18" fill="#061726" stroke="#d8ad43" stroke-width="5"/>'
  else if (!isClosing && ![`${packet.id}-01`, `${packet.id}-08`].includes(scene.id)) body = '<rect x="110" y="430" width="1700" height="390" rx="28" fill="#0a2231" stroke="#526e7b" stroke-width="2"/><text x="160" y="510" fill="#d8ad43" font-family="Arial" font-size="24" font-weight="700">OPERATING FILE</text><text x="160" y="600" fill="#f5eddb" font-family="Arial" font-size="48" font-weight="700">Evidence travels with the work.</text><text x="160" y="675" fill="#b9c8cf" font-family="Arial" font-size="36">Human review remains the gate.</text>'
  const label = isClosing ? 'LESSON COMPLETE' : `${packet.id} • ${scene.id}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="1920" height="1080" fill="#071b2a"/><rect x="48" y="42" width="1824" height="996" rx="24" fill="#0d2a3a" stroke="#54707d" stroke-width="2"/><line x1="88" y1="104" x2="1832" y2="104" stroke="#d8ad43" stroke-width="3"/><text x="92" y="80" fill="#f5eddb" font-family="Arial" font-size="24" font-weight="700">AMADUTOWN / AGENTIFIED</text><text x="1585" y="80" fill="#d8ad43" font-family="Arial" font-size="21" font-weight="700">${label}</text>${heading}${support}${body}</svg>`
  let image = sharp(Buffer.from(svg)).png()
  if (visual) {
    const plate = await sharp(visual).resize({ width: 1690, height: 590, fit: 'contain', background: '#061726' }).png().toBuffer()
    image = image.composite([{ input: plate, left: 115, top: 340 }])
  }
  await image.toFile(path.join(dir, isClosing ? `${scene.id}-closing.png` : `${scene.id}.png`))
}

async function makeCountdownFrames(base, dir) {
  for (let remaining = pauseSeconds; remaining >= 1; remaining -= 1) {
    const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect x="640" y="846" width="640" height="126" rx="18" fill="#071b2a" fill-opacity="0.94" stroke="#d8ad43" stroke-width="3"/><text x="960" y="925" text-anchor="middle" fill="#f5eddb" font-family="Arial, sans-serif" font-size="58" font-weight="700">GUIDED WORK  ${String(remaining).padStart(2, '0')}</text></svg>`
    await sharp(base).composite([{ input: Buffer.from(overlay), left: 0, top: 0 }]).png().toFile(path.join(dir, `countdown-${String(remaining).padStart(2, '0')}.png`))
  }
}

mkdirSync(here, { recursive: true })
const studioBackdrop = `<svg xmlns="http://www.w3.org/2000/svg" width="748" height="412"><defs><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#153946"/><stop offset="0.55" stop-color="#0d2d3b"/><stop offset="1" stop-color="#071d28"/></linearGradient><radialGradient id="light" cx="72%" cy="22%" r="70%"><stop offset="0" stop-color="#66828a" stop-opacity="0.25"/><stop offset="1" stop-color="#071d28" stop-opacity="0"/></radialGradient><filter id="texture"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="17"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.035"/></feComponentTransfer></filter></defs><rect width="748" height="412" fill="url(#base)"/><rect width="748" height="412" fill="url(#light)"/><rect width="748" height="412" filter="url(#texture)" opacity="0.45"/><path d="M0 335 C180 300 300 355 465 325 C590 300 665 315 748 292 V412 H0Z" fill="#071d28" opacity="0.38"/><path d="M0 336 C180 301 300 356 465 326 C590 301 665 316 748 293" fill="none" stroke="#4c6a74" stroke-opacity="0.23"/></svg>`
const studioBackdropPath = path.join(here, 'studio-backdrop.png')
await sharp(Buffer.from(studioBackdrop)).png().toFile(studioBackdropPath)

const batchLessons = []
for (const lesson of lessons) {
  const id = lesson.id.toLowerCase()
  const packet = JSON.parse(readFileSync(path.join(root, `agentified/workshop/scene-production/packets/${lesson.id}.json`), 'utf8'))
  const candidatePath = path.join(root, `agentified/workshop/l13-l16-continuous-preflight/${id}-request-candidate.json`)
  const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'))
  assert(candidate.candidate_sha256 === lesson.request && candidate.source_commit === sourceCommit, `${lesson.id} candidate drift`)
  const sourceDir = path.join(root, `agentified/workshop/l13-l16-native-source/${lesson.id}`)
  const presenter = path.join(sourceDir, `agentified-${id}-heygen-presenter-source.mp4`)
  const presenterSrt = path.join(sourceDir, `agentified-${id}-heygen-presenter-source.srt`)
  const narration = path.join(sourceDir, `agentified-${id}-heygen-narration.wav`)
  const timingPath = path.join(sourceDir, 'narration-word-timing.json')
  const presenterDuration = probe(presenter)
  const narrationDuration = probe(narration)
  const presenterCues = parseSrt(readFileSync(presenterSrt, 'utf8'))
  const presenterExpected = candidate.presenter_passages.map((passage) => passage.passage_exact).join(' ')
  assert(normalizeText(presenterCues.map((cue) => cue.text).join(' ')) === normalizeText(presenterExpected), `${lesson.id} presenter transcript drift`)
  const openingExpected = normalizeText(candidate.presenter_passages[0].passage_exact)
  let openingCount = 0
  for (let i = 1; i <= presenterCues.length; i += 1) {
    if (normalizeText(presenterCues.slice(0, i).map((cue) => cue.text).join(' ')) === openingExpected) { openingCount = i; break }
  }
  assert(openingCount > 0 && openingCount < presenterCues.length, `${lesson.id} presenter split missing`)
  const openingSubtitleEnd = presenterCues[openingCount - 1].end
  const closingSourceStart = presenterCues[openingCount].start
  const openingCut = Math.min(closingSourceStart - 0.05, openingSubtitleEnd + 0.12)
  const closingDuration = presenterDuration - closingSourceStart
  const timing = JSON.parse(readFileSync(timingPath, 'utf8'))
  const aligned = narrationCues(candidate, timing)
  const pauseCue = aligned.cues.filter((cue) => cue.scene === `${lesson.id}-07`).at(-1)
  assert(pauseCue, `${lesson.id} guided-work boundary missing`)
  const pauseAt = pauseCue.sourceEnd
  const narrationOffset = openingCut
  const finalTime = (sourceTime) => narrationOffset + sourceTime + (sourceTime >= pauseAt ? pauseSeconds : 0)
  const mappedNarrationCues = aligned.cues.map((cue) => ({ ...cue, start: finalTime(cue.sourceStart), end: finalTime(cue.sourceEnd), speaker: 'offscreen_narrator' }))
  const closingStart = narrationOffset + narrationDuration + pauseSeconds
  const closingEnd = closingStart + closingDuration
  const closingCardSeconds = candidate.timing.closing_card.overlay_on_final_presenter_passage ? 0 : candidate.timing.closing_card.duration_seconds
  const totalDuration = closingEnd + closingCardSeconds

  const mappedPresenterCues = presenterCues.map((cue, index) => index < openingCount
    ? { ...cue, scene: `${lesson.id}-01`, speaker: 'presenter' }
    : { ...cue, start: closingStart + cue.start - closingSourceStart, end: closingStart + cue.end - closingSourceStart, scene: `${lesson.id}-08`, speaker: 'presenter' })
  const captionCues = [...mappedPresenterCues.slice(0, openingCount), ...mappedNarrationCues, ...mappedPresenterCues.slice(openingCount)].sort((a, b) => a.start - b.start)
  assert(normalizeCaptionText(captionCues.map((cue) => cue.text).join(' ')) === normalizeCaptionText(expectedCaptionText(candidate)), `${lesson.id} caption transcript drift`)

  const frames = path.join(here, `frames-${lesson.id}`)
  mkdirSync(frames, { recursive: true })
  for (const scene of packet.scenes) await makeFrame(packet, scene, frames)
  await makeFrame(packet, packet.scenes.at(-1), frames, true)
  await makeCountdownFrames(path.join(frames, `${lesson.id}-07.png`), frames)

  const sceneStarts = packet.scenes.map((scene, index) => {
    if (index === 0) return 0
    return mappedNarrationCues.find((cue) => cue.scene === scene.id)?.start ?? closingStart
  })
  const sceneEnds = sceneStarts.slice(1).concat(closingEnd)
  const sequences = []
  packet.scenes.forEach((scene, index) => {
    const end = scene.id === `${lesson.id}-07` ? finalTime(pauseAt) - pauseSeconds : sceneEnds[index]
    sequences.push({ file: path.join(frames, `${scene.id}.png`), duration: Math.max(0.2, end - sceneStarts[index]) })
    if (scene.id === `${lesson.id}-07`) {
      for (let remaining = pauseSeconds; remaining >= 1; remaining -= 1) sequences.push({ file: path.join(frames, `countdown-${String(remaining).padStart(2, '0')}.png`), duration: 1 })
    }
  })
  if (closingCardSeconds) sequences.push({ file: path.join(frames, `${lesson.id}-08-closing.png`), duration: closingCardSeconds })

  const inputs = []
  const baseFilters = []
  sequences.forEach((sequence, index) => {
    inputs.push('-loop', '1', '-t', String(sequence.duration), '-i', sequence.file)
    baseFilters.push(`[${index}:v]fps=${fps},format=yuv420p[v${index}]`)
  })
  baseFilters.push(`${sequences.map((_, index) => `[v${index}]`).join('')}concat=n=${sequences.length}:v=1:a=0[base]`)
  const base = path.join(here, `${lesson.id}-base.mp4`)
  run([...inputs, '-filter_complex', baseFilters.join(';'), '-map', '[base]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(fps), base])

  const presenterFrame = 'colorkey=0x00e868:0.28:0.08,despill=type=green:mix=0.05:expand=0.02,scale=748:412:force_original_aspect_ratio=decrease,pad=748:412:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba'
  const graph = [
    `color=c=#092433:s=768x432:r=${fps}:d=${openingCut},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame1]`,
    `[2:v]trim=duration=${openingCut},setpts=PTS-STARTPTS,scale=748:412[bg1]`,
    '[frame1][bg1]overlay=10:10:eof_action=pass:repeatlast=1[studio1]',
    `[1:v]trim=0:${openingCut},setpts=PTS-STARTPTS,${presenterFrame}[p1]`,
    `[studio1][p1]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.34:alpha=1,fade=t=out:st=${Math.max(0, openingCut - 0.4)}:d=0.4:alpha=1[panel1]`,
    `color=c=black@0:s=768x432:r=${fps}:d=${totalDuration},format=rgba[p2blank]`,
    `color=c=#092433:s=768x432:r=${fps}:d=${closingDuration},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame2]`,
    `[2:v]trim=duration=${closingDuration},setpts=PTS-STARTPTS,scale=748:412[bg2]`,
    '[frame2][bg2]overlay=10:10:eof_action=pass:repeatlast=1[studio2]',
    `[1:v]trim=${closingSourceStart}:${presenterDuration},setpts=PTS-STARTPTS,${presenterFrame}[p2]`,
    `[studio2][p2]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=${Math.max(0, closingDuration - 0.35)}:d=0.35:alpha=1,setpts=PTS+${closingStart}/TB[p2shift]`,
    '[p2blank][p2shift]overlay=0:0:eof_action=pass:repeatlast=0:format=auto[p2track]',
    '[0:v][panel1]overlay=1048:326:eof_action=pass:repeatlast=0[v1]',
    '[v1][p2track]overlay=1048:326:eof_action=pass:repeatlast=0:format=auto[vout]',
    `[1:a]atrim=0:${openingCut},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[aopen]`,
    `[3:a]atrim=0:${pauseAt},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[na]`,
    `anullsrc=r=48000:cl=stereo:d=${pauseSeconds}[pause]`,
    `[3:a]atrim=${pauseAt}:${narrationDuration},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[nb]`,
    `[1:a]atrim=${closingSourceStart}:${presenterDuration},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[aclose]`,
    ...(closingCardSeconds ? [`anullsrc=r=48000:cl=stereo:d=${closingCardSeconds}[card]`, '[aopen][na][pause][nb][aclose][card]concat=n=6:v=0:a=1[aout]'] : ['[aopen][na][pause][nb][aclose]concat=n=5:v=0:a=1[aout]']),
  ].join(';')
  const raw = path.join(here, `${lesson.id}-raw.mp4`)
  const output = path.join(here, `agentified-${id}-native-composite.mp4`)
  run(['-i', base, '-i', presenter, '-loop', '1', '-i', studioBackdropPath, '-i', narration, '-filter_complex', graph, '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(totalDuration), raw])

  const srt = captionCues.map((cue, index) => `${index + 1}\n${clock(cue.start)} --> ${clock(cue.end)}\n${cue.text}\n`).join('\n')
  const vtt = `WEBVTT\n\n${captionCues.map((cue) => `${clock(cue.start, '.')} --> ${clock(cue.end, '.')}\n${cue.text}\n`).join('\n')}`
  const srtPath = path.join(here, `agentified-${id}-native-captions.srt`)
  const vttPath = path.join(here, `agentified-${id}-native-captions.vtt`)
  writeFileSync(srtPath, srt)
  writeFileSync(vttPath, vtt)
  run(['-i', raw, '-i', srtPath, '-map', '0:v:0', '-map', '0:a:0', '-map', '1:0', '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default', '-movflags', '+faststart', output])

  const timeline = {
    schema_version: 1,
    lesson_id: lesson.id,
    request_sha256: lesson.request,
    presenter_source_duration_seconds: Number(presenterDuration.toFixed(3)),
    narration_source_duration_seconds: Number(narrationDuration.toFixed(3)),
    native_speed: 1,
    output_duration_seconds: Number(totalDuration.toFixed(3)),
    presenter_windows: [
      { scene_id: `${lesson.id}-01`, source_in: 0, source_out: Number(openingCut.toFixed(3)), sequence_start: 0, sequence_end: Number(openingCut.toFixed(3)) },
      { scene_id: `${lesson.id}-08`, source_in: Number(closingSourceStart.toFixed(3)), source_out: Number(presenterDuration.toFixed(3)), sequence_start: Number(closingStart.toFixed(3)), sequence_end: Number(closingEnd.toFixed(3)) },
    ],
    narration_window: { sequence_start: Number(openingCut.toFixed(3)), source_pause_split: Number(pauseAt.toFixed(3)), source_duration: Number(narrationDuration.toFixed(3)) },
    guided_work_countdown: { source_split_seconds: Number(pauseAt.toFixed(3)), sequence_start: Number((narrationOffset + pauseAt).toFixed(3)), sequence_end: Number((narrationOffset + pauseAt + pauseSeconds).toFixed(3)), seconds: pauseSeconds },
    provider_free_closing_card: { start: Number((closingCardSeconds ? closingEnd : closingStart).toFixed(3)), end: Number(totalDuration.toFixed(3)), overlay_on_final_presenter_passage: !closingCardSeconds },
    sentence_alignment: { engine: 'HeyGen native word timing plus exact-script global alignment', distance: aligned.distance, expected_words: aligned.expectedWordCount, observed_words: aligned.observedWordCount },
    presenter_transform: { x: 1048, y: 326, width: 768, height: 432, fit: 'contain', border: 'solid_gold', background: 'provider_free_textured_studio' },
  }
  const receipt = {
    schema_version: 1,
    status: 'presenter_and_narration_completed_once_no_retry_and_composited_provider_free',
    lesson_id: lesson.id,
    source_commit: sourceCommit,
    batch_sha256: batchSha,
    request_sha256: lesson.request,
    provider: 'HeyGen Avatar IV plus HeyGen narration',
    presenter_job_id: lesson.presenterJob,
    look_id: lookId,
    voice_id: voiceId,
    provider_calls: 2,
    retries: 0,
    execution_authorization_receipt: { path: AUTHORIZATION_PATH, sha256: AUTHORIZATION_SHA256, request_sha256: REQUESTS[lesson.id] },
    provider_usage: { presenter_credit_cost: lesson.presenterCost, narration_credit_cost: lesson.narrationCost, lesson_credit_cost: lesson.presenterCost + lesson.narrationCost, account_balance_after_lesson: lesson.balanceAfter, cash_purchase_usd: 0 },
    presenter_source: { path: path.relative(root, presenter), sha256: sha(presenter), duration_seconds: Number(presenterDuration.toFixed(3)), subtitle_path: path.relative(root, presenterSrt), subtitle_sha256: sha(presenterSrt) },
    narration_source: { path: path.relative(root, narration), sha256: sha(narration), duration_seconds: Number(narrationDuration.toFixed(3)), text_sha256: candidate.offscreen_narration.text_sha256, timing_path: path.relative(root, timingPath), timing_sha256: sha(timingPath) },
    timing_receipt: timeline,
    background_treatment: { mode: 'provider_free_textured_studio_reconstruction', key: 'colorkey=0x00e868:0.28:0.08', edge_despill: 'green:mix=0.05:expand=0.02', native_presenter_pixels_preserved: true },
    composite: { path: path.relative(root, output), sha256: sha(output), duration_seconds: Number(probe(output).toFixed(3)) },
    captions: { srt_path: path.relative(root, srtPath), srt_sha256: sha(srtPath), vtt_path: path.relative(root, vttPath), vtt_sha256: sha(vttPath) },
  }
  writeFileSync(path.join(here, `${id}-provider-receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`)
  writeFileSync(path.join(here, `${id}-composite-timeline.json`), `${JSON.stringify(timeline, null, 2)}\n`)
  batchLessons.push({ lesson_id: lesson.id, presenter_job_id: lesson.presenterJob, request_sha256: lesson.request, presenter_source_sha256: receipt.presenter_source.sha256, narration_source_sha256: receipt.narration_source.sha256, composite_sha256: receipt.composite.sha256, output_duration_seconds: receipt.composite.duration_seconds, credit_cost: receipt.provider_usage.lesson_credit_cost })
  rmSync(base, { force: true })
  rmSync(raw, { force: true })
  rmSync(frames, { recursive: true, force: true })
  console.log(`${lesson.id}: ${receipt.composite.sha256}`)
}

rmSync(studioBackdropPath, { force: true })
writeFileSync(path.join(here, 'batch-provider-receipt.json'), `${JSON.stringify({ schema_version: 1, status: 'four_presenter_and_narration_pairs_completed_once_no_retry_and_composited_provider_free', source_commit: sourceCommit, batch_sha256: batchSha, look_id: lookId, voice_id: voiceId, calls_submitted: 8, presenter_jobs_submitted: 4, narration_calls_submitted: 4, retries: 0, starting_balance: startingBalance, account_balance_after_batch: finalBalance, cash_purchase_usd: 0, exact_credit_cost: startingBalance - finalBalance, minimum_balance_required: 168, execution_authorization_receipt: { path: AUTHORIZATION_PATH, sha256: AUTHORIZATION_SHA256 }, lessons: batchLessons }, null, 2)}\n`)
console.log(`L13-L16 complete: ${batchLessons.length} lessons, eight calls, zero retries, ${startingBalance - finalBalance} credits`)
