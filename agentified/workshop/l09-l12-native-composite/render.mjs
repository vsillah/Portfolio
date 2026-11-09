#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
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
const pauseSeconds = 45
const sourceCommit = 'cb44c2389b4281aac7dae33d835363ae35c42ea2'
const batchSha = 'c339600cab53a406b01ae80399354bf718e94a36863322f934d795c424aa6ed5'
const lookId = '7275ba9035f94b31ad589dda6532d002'
const voiceId = '4f53988b1c314610b514db98432fd0ef'
const lessons = [
  { id: 'L09', request: 'cb89bf17ea0df2de96018439b3b54ce13aa5b4fbe017724b7c9ab5047c556fcd', job: '6621f0b631213c2ed0574a3a8a790d91', nativeSha: '690e7a4f1c645999531f9c3ac6c86d05f10358da265e39f598a373d5c430e365', closing: 9, knownCreditCost: 114 },
  { id: 'L10', request: '19a70e94acb9c75e633535211ce54af1b4e1075f2ec5da7d40048c90593694a8', job: 'ce566c1d43d38666e24de7716f8fc270', nativeSha: 'dfc8b28b72719b5ff903fe9c6d7b520a6716732c413ebc98b50449b80e18aa91', closing: 8, knownCreditCost: null },
  { id: 'L11', request: '7a139886e0f6b35daf35bab1b44ab4eb582127cd4aadedbcf59f810011cc74b8', job: 'b3388fddea1f31b76cd04dcc5071b026', nativeSha: '6883cb02be903c6613de24fb52b9db78d63e762d55f48ef033e0b09ffa5ea482', closing: 4, knownCreditCost: null },
  { id: 'L12', request: '56498ca2f4748dc058a63ca80efe27e340d3474d0025c4f335e93e1e9d8a15b7', job: 'c48607af323bb39a7d643df9d9ec2435', nativeSha: '83f196cc60bef391471a1f160849f4e595af070306cb2179b0afad0748d5507b', closing: 3, knownCreditCost: null },
]

const run = (args) => execFileSync('ffmpeg', ['-y', ...args], { stdio: 'inherit' })
const probe = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim())
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('“', '').replaceAll('”', '')
const normalizeWord = (value) => value.toLowerCase().replaceAll(/[’‘]/g, "'").replaceAll(/[^a-z0-9']/g, '')
const clock = (value, separator = ',') => {
  const ms = Math.max(0, Math.round(value * 1000))
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`
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

function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]+(?:["']?)(?=\s|$)|[^.!?]+$/g) || [text]).map((value) => value.trim()).filter(Boolean)
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

function sentenceCues(candidate, timing) {
  const blocks = [
    { scene: `${candidate.lesson_id}-01`, text: candidate.presenter_passages[0].passage_exact, kind: 'presenter_opening' },
    ...candidate.offscreen_narration.segments.map((segment) => ({ scene: segment.scene_id, text: segment.text, kind: 'narration' })),
    { scene: `${candidate.lesson_id}-08`, text: candidate.presenter_passages[1].passage_exact, kind: 'presenter_closing' },
  ]
  const sentences = []
  const expectedWords = []
  for (const block of blocks) {
    for (const text of splitSentences(block.text)) {
      const startWord = expectedWords.length
      const words = text.split(/\s+/).map(normalizeWord).filter(Boolean)
      expectedWords.push(...words)
      sentences.push({ ...block, text, startWord, endWord: expectedWords.length - 1 })
    }
  }
  const observed = timing.segments.flatMap((segment) => (segment.words || []).filter((word) => word.start !== null && word.end !== null))
  const observedWords = observed.map((word) => normalizeWord(word.word))
  const { mapping, distance } = alignExpectedWords(expectedWords, observedWords)
  const cues = sentences.map((sentence) => {
    const first = observed[mapping[sentence.startWord]]
    const last = observed[mapping[sentence.endWord]]
    if (!first || !last) throw new Error(`${candidate.lesson_id} sentence alignment failed`)
    return { ...sentence, sourceStart: first.start, sourceEnd: last.end }
  })
  return { cues, distance, expectedWordCount: expectedWords.length, observedWordCount: observedWords.length }
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
  const candidatePath = path.join(root, `agentified/workshop/l09-l12-continuous-preflight/${id}-request-candidate.json`)
  const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'))
  if (candidate.candidate_sha256 !== lesson.request || candidate.source_commit !== sourceCommit) throw new Error(`${lesson.id} candidate drift`)
  const sourceDir = path.join(root, `agentified/workshop/l09-l12-native-source/${lesson.id}`)
  const source = path.join(sourceDir, `agentified-${id}-heygen-native-source.mp4`)
  const timingPath = path.join(sourceDir, 'word-timing.json')
  const sourceDuration = probe(source)
  if (sha(source) !== lesson.nativeSha) throw new Error(`${lesson.id} native source hash drift`)
  const timing = JSON.parse(readFileSync(timingPath, 'utf8'))
  const aligned = sentenceCues(candidate, timing)
  const opening = aligned.cues.filter((cue) => cue.kind === 'presenter_opening')
  const closing = aligned.cues.filter((cue) => cue.kind === 'presenter_closing')
  const sceneEight = aligned.cues.find((cue) => cue.scene === `${lesson.id}-08` && cue.kind === 'narration')
  if (!opening.length || !closing.length || !sceneEight) throw new Error(`${lesson.id} missing approved boundary`)
  const openingEnd = opening.at(-1).sourceEnd
  const closingStart = closing[0].sourceStart
  const pauseAt = sceneEight.sourceStart
  const outTime = (value) => value + (value >= pauseAt ? pauseSeconds : 0)
  const mappedCues = aligned.cues.map((cue) => ({ ...cue, start: outTime(cue.sourceStart), end: outTime(cue.sourceEnd) }))
  const finalNarrationEnd = sourceDuration + pauseSeconds
  const totalDuration = finalNarrationEnd + lesson.closing

  const frames = path.join(here, `frames-${lesson.id}`)
  mkdirSync(frames, { recursive: true })
  for (const scene of packet.scenes) await makeFrame(packet, scene, frames)
  await makeFrame(packet, packet.scenes.at(-1), frames, true)
  await makeCountdownFrames(path.join(frames, `${lesson.id}-07.png`), frames)
  const sceneStarts = packet.scenes.map((scene) => mappedCues.find((cue) => cue.scene === scene.id)?.start).map((value, index, all) => value ?? (index ? all[index - 1] : 0))
  sceneStarts[0] = 0
  const sceneEnds = sceneStarts.slice(1).concat(finalNarrationEnd)
  const sequences = []
  packet.scenes.forEach((scene, index) => {
    const end = scene.id === `${lesson.id}-07` ? pauseAt : sceneEnds[index]
    sequences.push({ file: path.join(frames, `${scene.id}.png`), duration: Math.max(0.2, end - sceneStarts[index]) })
    if (scene.id === `${lesson.id}-07`) {
      for (let remaining = pauseSeconds; remaining >= 1; remaining -= 1) sequences.push({ file: path.join(frames, `countdown-${String(remaining).padStart(2, '0')}.png`), duration: 1 })
    }
  })
  sequences.push({ file: path.join(frames, `${lesson.id}-08-closing.png`), duration: lesson.closing })
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
    `color=c=#092433:s=768x432:r=${fps}:d=${openingEnd},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame1]`,
    `[2:v]trim=duration=${openingEnd},setpts=PTS-STARTPTS,scale=748:412[bg1]`,
    '[frame1][bg1]overlay=10:10:eof_action=pass:repeatlast=1[studio1]',
    `[1:v]trim=0:${openingEnd},setpts=PTS-STARTPTS,${presenterFrame}[p1]`,
    `[studio1][p1]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.34:alpha=1,fade=t=out:st=${Math.max(0, openingEnd - 0.45)}:d=0.45:alpha=1[panel1]`,
    `color=c=black@0:s=768x432:r=${fps}:d=${totalDuration},format=rgba[p2blank]`,
    `color=c=#092433:s=768x432:r=${fps}:d=${sourceDuration - closingStart},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame2]`,
    `[2:v]trim=duration=${sourceDuration - closingStart},setpts=PTS-STARTPTS,scale=748:412[bg2]`,
    '[frame2][bg2]overlay=10:10:eof_action=pass:repeatlast=1[studio2]',
    `[1:v]trim=${closingStart}:${sourceDuration},setpts=PTS-STARTPTS,${presenterFrame}[p2]`,
    `[studio2][p2]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=${Math.max(0, sourceDuration - closingStart - 0.35)}:d=0.35:alpha=1,setpts=PTS+${outTime(closingStart)}/TB[p2shift]`,
    '[p2blank][p2shift]overlay=0:0:eof_action=pass:repeatlast=0:format=auto[p2track]',
    '[0:v][panel1]overlay=1048:326:eof_action=pass:repeatlast=0[v1]',
    '[v1][p2track]overlay=1048:326:eof_action=pass:repeatlast=0:format=auto[vout]',
    `[1:a]atrim=0:${pauseAt},asetpts=PTS-STARTPTS[a1]`,
    `anullsrc=r=48000:cl=stereo:d=${pauseSeconds}[pause]`,
    `[1:a]atrim=${pauseAt}:${sourceDuration},asetpts=PTS-STARTPTS[a2]`,
    '[a1][pause][a2]concat=n=3:v=0:a=1,apad[aout]',
  ].join(';')
  const raw = path.join(here, `${lesson.id}-raw.mp4`)
  const output = path.join(here, `agentified-${id}-native-composite.mp4`)
  run(['-i', base, '-i', source, '-loop', '1', '-i', studioBackdropPath, '-filter_complex', graph, '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(totalDuration), raw])

  const srt = mappedCues.map((cue, index) => `${index + 1}\n${clock(cue.start)} --> ${clock(cue.end)}\n${cue.text}\n`).join('\n')
  const vtt = `WEBVTT\n\n${mappedCues.map((cue) => `${clock(cue.start, '.')} --> ${clock(cue.end, '.')}\n${cue.text}\n`).join('\n')}`
  const srtPath = path.join(here, `agentified-${id}-native-captions.srt`)
  const vttPath = path.join(here, `agentified-${id}-native-captions.vtt`)
  writeFileSync(srtPath, srt)
  writeFileSync(vttPath, vtt)
  run(['-i', raw, '-i', srtPath, '-map', '0:v:0', '-map', '0:a:0', '-map', '1:0', '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default', '-movflags', '+faststart', output])

  const timeline = {
    schema_version: 1,
    lesson_id: lesson.id,
    request_sha256: lesson.request,
    native_source_sha256: lesson.nativeSha,
    native_source_duration_seconds: Number(sourceDuration.toFixed(3)),
    native_speed: 1,
    output_duration_seconds: Number(totalDuration.toFixed(3)),
    presenter_windows: [
      { scene_id: `${lesson.id}-01`, source_in: 0, source_out: Number(openingEnd.toFixed(3)), sequence_start: 0, sequence_end: Number(openingEnd.toFixed(3)) },
      { scene_id: `${lesson.id}-08`, source_in: Number(closingStart.toFixed(3)), source_out: Number(sourceDuration.toFixed(3)), sequence_start: Number(outTime(closingStart).toFixed(3)), sequence_end: Number(finalNarrationEnd.toFixed(3)) },
    ],
    guided_work_countdown: { source_split_seconds: Number(pauseAt.toFixed(3)), sequence_start: Number(pauseAt.toFixed(3)), sequence_end: Number((pauseAt + pauseSeconds).toFixed(3)), seconds: pauseSeconds },
    provider_free_closing_card: { start: Number(finalNarrationEnd.toFixed(3)), end: Number(totalDuration.toFixed(3)) },
    sentence_alignment: { engine: 'faster-whisper small.en plus exact-script global alignment', distance: aligned.distance, expected_words: aligned.expectedWordCount, observed_words: aligned.observedWordCount },
    presenter_transform: { x: 1048, y: 326, width: 768, height: 432, fit: 'contain', border: 'solid_gold', background: 'provider_free_textured_studio' },
    l10_mobile_diagram_treatment: lesson.id === 'L10' ? { mode: 'enlarged_full_width_plate', text_equivalent: 'Authority ladder showing recommend is not execute and changed terms require new review.' } : null,
  }
  const receipt = {
    schema_version: 1,
    status: 'completed_once_no_retry_and_composited_provider_free',
    lesson_id: lesson.id,
    source_commit: sourceCommit,
    batch_sha256: batchSha,
    request_sha256: lesson.request,
    provider: 'HeyGen Avatar IV',
    job_id: lesson.job,
    look_id: lookId,
    voice_id: voiceId,
    submissions: 1,
    retries: 0,
    provider_usage: { credit_cost: lesson.knownCreditCost, account_balance_after_batch: 768, cash_purchase_usd: 0, note: lesson.knownCreditCost === null ? 'The connector exposed completion and account balance but not an immutable per-job credit debit for this job; no value is inferred.' : 'Exact debit observed for L09.' },
    native_source: { path: path.relative(root, source), sha256: sha(source), duration_seconds: Number(sourceDuration.toFixed(3)) },
    word_timing: { path: path.relative(root, timingPath), sha256: sha(timingPath), generated_provider_free: true },
    timing_receipt: timeline,
    background_treatment: {
      mode: 'provider_free_textured_studio_reconstruction',
      key: 'colorkey=0x00e868:0.28:0.08',
      edge_despill: 'green:mix=0.05:expand=0.02',
      native_presenter_pixels_preserved: true,
    },
    composite: { path: path.relative(root, output), sha256: sha(output), duration_seconds: Number(probe(output).toFixed(3)) },
    captions: { srt_path: path.relative(root, srtPath), srt_sha256: sha(srtPath), vtt_path: path.relative(root, vttPath), vtt_sha256: sha(vttPath) },
  }
  writeFileSync(path.join(here, `${id}-provider-receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`)
  writeFileSync(path.join(here, `${id}-composite-timeline.json`), `${JSON.stringify(timeline, null, 2)}\n`)
  batchLessons.push({ lesson_id: lesson.id, job_id: lesson.job, request_sha256: lesson.request, native_source_sha256: lesson.nativeSha, composite_sha256: receipt.composite.sha256, output_duration_seconds: receipt.composite.duration_seconds, credit_cost: lesson.knownCreditCost })
  rmSync(base, { force: true })
  rmSync(raw, { force: true })
  rmSync(frames, { recursive: true, force: true })
  console.log(`${lesson.id}: ${receipt.composite.sha256}`)
}

rmSync(studioBackdropPath, { force: true })

writeFileSync(path.join(here, 'batch-provider-receipt.json'), `${JSON.stringify({ schema_version: 1, status: 'four_sources_completed_once_no_retry_and_composited_provider_free', source_commit: sourceCommit, batch_sha256: batchSha, look_id: lookId, voice_id: voiceId, jobs_submitted: 4, retries: 0, account_balance_after_batch: 768, cash_purchase_usd: 0, exact_known_credit_cost: 114, credit_cost_disclosure: 'L09 exact debit was exposed. L10-L12 per-job debit values were not exposed by the provider connector and are intentionally not inferred.', lessons: batchLessons }, null, 2)}\n`)
console.log(`L09-L12 complete: ${batchLessons.length} sources, zero retries, provider-free composites`)
