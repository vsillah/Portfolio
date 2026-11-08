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
const lookId = '7275ba9035f94b31ad589dda6532d002'
const voiceId = '4f53988b1c314610b514db98432fd0ef'
const sourceCommit = '558cd4669e1d48c74a715a99d23eb9d43f74af8d'
const batchSha = '392593a8132208a7da39d5a5254f0887e72e6c509bf2d640f3a07fa8be291dee'

const lessons = [
  { id: 'L05', request: '54bcd458518d54755c6bc76ae5fbed365440790548eeb02d299e45e589034099', job: '309a2d6c5041a38ae482e0754ffdda6e', split: 11.91, closingStart: 595, creditsBefore: 1293, creditsAfter: 1282 },
  { id: 'L06', request: 'cc6a0cc1320375eb4d8ee3bc22c32bcb3814822c02fefd8e5af901341c52acbc', job: '51d206b2e3785e8dce2fb320fb4c6aec', split: 13.64, closingStart: 591, creditsBefore: 1282, creditsAfter: 1271 },
  { id: 'L07', request: 'f35b6f521276b7b7ee03806f3c58de0acb4236ea90c005859c293ee065a47bcd', job: 'c3cc7090dde04b9483d9f4d4de6b852b', split: 9.37, closingStart: 596, creditsBefore: 1271, creditsAfter: 1262 },
  { id: 'L08', request: '297bf76b3b3a4179c5ee07fc81039d58351ad10dce12aa01ebddcc3038fcf025', job: '76d5248d34be0265512f59385e163415', split: 13.525, closingStart: 598, creditsBefore: 1262, creditsAfter: 1250 },
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

async function makeFrame(packet, scene, dir) {
  const visual = scene.approved_visuals[0]?.path ? path.join(root, scene.approved_visuals[0].path) : null
  const heading = textBlock([scene.audience_copy[0] || packet.title], 105, 210, 56, 31, '#f5eddb', 700)
  const support = textBlock(scene.audience_copy.slice(1), 108, 380, 34, 31, '#b9c8cf')
  let body = ''
  if (visual) body = '<rect x="100" y="325" width="1720" height="620" rx="18" fill="#061726" stroke="#d8ad43" stroke-width="5"/>'
  else if (![`${packet.id}-01`, `${packet.id}-08`].includes(scene.id)) body = '<rect x="110" y="430" width="1700" height="390" rx="28" fill="#0a2231" stroke="#526e7b" stroke-width="2"/><text x="160" y="510" fill="#d8ad43" font-family="Arial" font-size="24" font-weight="700">OPERATING FILE</text><text x="160" y="600" fill="#f5eddb" font-family="Arial" font-size="48" font-weight="700">Evidence travels with the work.</text><text x="160" y="675" fill="#b9c8cf" font-family="Arial" font-size="36">Human review remains the gate.</text>'
  const progress = Math.round(1720 * scene.end_seconds / packet.timing_seconds)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="1920" height="1080" fill="#071b2a"/><rect x="48" y="42" width="1824" height="996" rx="24" fill="#0d2a3a" stroke="#54707d" stroke-width="2"/><line x1="88" y1="104" x2="1832" y2="104" stroke="#d8ad43" stroke-width="3"/><text x="92" y="80" fill="#f5eddb" font-family="Arial" font-size="24" font-weight="700">AMADUTOWN / AGENTIFIED</text><text x="1585" y="80" fill="#d8ad43" font-family="Arial" font-size="21" font-weight="700">${packet.id} • ${scene.id}</text>${heading}${support}${body}<rect x="100" y="1000" width="1720" height="16" rx="8" fill="#29424e"/><rect x="100" y="1000" width="${progress}" height="16" rx="8" fill="#d8ad43"/></svg>`
  let image = sharp(Buffer.from(svg)).png()
  if (visual) {
    const plate = await sharp(visual).resize({ width: 1690, height: 590, fit: 'contain', background: '#061726' }).png().toBuffer()
    image = image.composite([{ input: plate, left: 115, top: 340 }])
  }
  await image.toFile(path.join(dir, `${scene.id}.png`))
}

mkdirSync(here, { recursive: true })
const studioBackdrop = `<svg xmlns="http://www.w3.org/2000/svg" width="748" height="412"><defs><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#153946"/><stop offset="0.55" stop-color="#0d2d3b"/><stop offset="1" stop-color="#071d28"/></linearGradient><radialGradient id="light" cx="72%" cy="22%" r="70%"><stop offset="0" stop-color="#66828a" stop-opacity="0.25"/><stop offset="1" stop-color="#071d28" stop-opacity="0"/></radialGradient><filter id="texture"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="17"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.035"/></feComponentTransfer></filter></defs><rect width="748" height="412" fill="url(#base)"/><rect width="748" height="412" fill="url(#light)"/><rect width="748" height="412" filter="url(#texture)" opacity="0.45"/><path d="M0 335 C180 300 300 355 465 325 C590 300 665 315 748 292 V412 H0Z" fill="#071d28" opacity="0.38"/><path d="M0 336 C180 301 300 356 465 326 C590 301 665 316 748 293" fill="none" stroke="#4c6a74" stroke-opacity="0.23"/></svg>`
const studioBackdropPath = path.join(here, 'studio-backdrop.png')
await sharp(Buffer.from(studioBackdrop)).png().toFile(studioBackdropPath)

const batchLessons = []
for (const lesson of lessons) {
  const packet = JSON.parse(readFileSync(path.join(root, `agentified/workshop/scene-production/packets/${lesson.id}.json`), 'utf8'))
  const candidatePath = path.join(root, `agentified/workshop/l05-l08-guided-video-preflight/${lesson.id.toLowerCase()}-request-candidate.json`)
  const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'))
  if (candidate.request_sha256 !== lesson.request) throw new Error(`${lesson.id} request drift`)
  const sourceDir = path.join(root, `agentified/workshop/l05-l08-native-source/${lesson.id}`)
  const source = path.join(sourceDir, `agentified-${lesson.id.toLowerCase()}-heygen-native-source.mp4`)
  const providerSrt = path.join(sourceDir, 'provider-captions.srt')
  const sourceDuration = probe(source)
  if (lesson.split <= 0 || lesson.split >= sourceDuration) throw new Error(`${lesson.id} invalid split`)
  const secondDuration = sourceDuration - lesson.split
  const secondStart = lesson.closingStart - secondDuration
  const mappedCues = parseSrt(providerSrt).map((cue) => cue.start >= lesson.split
    ? { ...cue, start: secondStart + cue.start - lesson.split, end: secondStart + cue.end - lesson.split }
    : cue)
  const transcript = mappedCues.map((cue) => cue.text).join(' ')
  for (const window of candidate.presenter_windows) {
    if (!transcript.includes(window.narration_exact.replaceAll('‘', "'").replaceAll('’', "'").replaceAll('“', '"').replaceAll('”', '"'))) {
      const normalized = (value) => value.toLowerCase().replaceAll(/[‘’]/g, "'").replaceAll(/[“”]/g, '"').replaceAll(/\s+/g, ' ').trim()
      if (!normalized(transcript).includes(normalized(window.narration_exact))) throw new Error(`${lesson.id} incomplete authorized passage`)
    }
  }

  const frames = path.join(here, `frames-${lesson.id}`)
  mkdirSync(frames, { recursive: true })
  for (const scene of packet.scenes) await makeFrame(packet, scene, frames)
  const inputs = []
  const baseFilters = []
  packet.scenes.forEach((scene, index) => {
    inputs.push('-loop', '1', '-t', String(scene.end_seconds - scene.start_seconds), '-i', path.join(frames, `${scene.id}.png`))
    baseFilters.push(`[${index}:v]fps=${fps},format=yuv420p[v${index}]`)
  })
  baseFilters.push(`${packet.scenes.map((_, index) => `[v${index}]`).join('')}concat=n=${packet.scenes.length}:v=1:a=0[base]`)
  const base = path.join(here, `${lesson.id}-base.mp4`)
  run([...inputs, '-filter_complex', baseFilters.join(';'), '-map', '[base]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(fps), base])

  const firstDuration = lesson.split
  const inset = 'colorkey=0x00e868:0.28:0.08,despill=type=green:mix=0.05:expand=0.02,scale=748:412:force_original_aspect_ratio=decrease,pad=748:412:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba'
  const graph = [
    `color=c=#092433:s=768x432:r=${fps}:d=${firstDuration},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame1]`,
    `[2:v]trim=duration=${firstDuration},setpts=PTS-STARTPTS,scale=748:412[bg1]`,
    '[frame1][bg1]overlay=10:10:eof_action=pass:repeatlast=1[studio1]',
    `[1:v]trim=0:${lesson.split},setpts=PTS-STARTPTS,${inset}[p1]`,
    `[studio1][p1]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=${Math.max(0, firstDuration - 0.5)}:d=0.5:alpha=1[panel1]`,
    `color=c=black@0.0:s=768x432:r=${fps}:d=600,format=rgba[p2blank]`,
    `color=c=#092433:s=768x432:r=${fps}:d=${secondDuration},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame2]`,
    `[2:v]trim=duration=${secondDuration},setpts=PTS-STARTPTS,scale=748:412[bg2]`,
    '[frame2][bg2]overlay=10:10:eof_action=pass:repeatlast=1[studio2]',
    `[1:v]trim=${lesson.split}:${sourceDuration},setpts=PTS-STARTPTS,${inset}[p2]`,
    `[studio2][p2]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=${Math.max(0, secondDuration - 0.3)}:d=0.3:alpha=1,setpts=PTS+${secondStart}/TB[p2shift]`,
    '[p2blank][p2shift]overlay=0:0:eof_action=pass:repeatlast=0:format=auto[p2track]',
    '[0:v][panel1]overlay=1048:326:eof_action=pass:repeatlast=0[v1]',
    '[v1][p2track]overlay=1048:326:eof_action=pass:repeatlast=0:format=auto[vout]',
    `[1:a]atrim=0:${lesson.split},asetpts=PTS-STARTPTS[a1]`,
    `[1:a]atrim=${lesson.split}:${sourceDuration},asetpts=PTS-STARTPTS,adelay=${Math.round(secondStart * 1000)}|${Math.round(secondStart * 1000)}[a2]`,
    'anullsrc=r=48000:cl=stereo:d=600[silence]',
    '[silence][a1][a2]amix=inputs=3:duration=longest:normalize=0:dropout_transition=0,alimiter=limit=0.95[aout]',
  ].join(';')
  const raw = path.join(here, `${lesson.id}-raw.mp4`)
  const output = path.join(here, `agentified-${lesson.id.toLowerCase()}-native-composite.mp4`)
  run(['-i', base, '-i', source, '-loop', '1', '-i', studioBackdropPath, '-filter_complex', graph, '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '600', raw])

  const srt = mappedCues.map((cue, index) => `${index + 1}\n${clock(cue.start)} --> ${clock(cue.end)}\n${cue.text}\n`).join('\n')
  const vtt = `WEBVTT\n\n${mappedCues.map((cue) => `${clock(cue.start, '.')} --> ${clock(cue.end, '.')}\n${cue.text}\n`).join('\n')}`
  const srtPath = path.join(here, `agentified-${lesson.id.toLowerCase()}-native-captions.srt`)
  const vttPath = path.join(here, `agentified-${lesson.id.toLowerCase()}-native-captions.vtt`)
  writeFileSync(srtPath, srt)
  writeFileSync(vttPath, vtt)
  run(['-i', raw, '-i', srtPath, '-map', '0:v:0', '-map', '0:a:0', '-map', '1:0', '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default', '-movflags', '+faststart', output])

  const timeline = {
    schema_version: 1,
    lesson_id: lesson.id,
    lesson_duration_seconds: 600,
    request_sha256: lesson.request,
    native_source_sha256: sha(source),
    native_source_duration_seconds: Number(sourceDuration.toFixed(3)),
    native_speed: 1,
    source_split_seconds: lesson.split,
    placements: [
      { scene_id: `${lesson.id}-01`, source_in: 0, source_out: lesson.split, sequence_start: 0, sequence_end: lesson.split },
      { scene_id: `${lesson.id}-08`, source_in: lesson.split, source_out: Number(sourceDuration.toFixed(3)), sequence_start: Number(secondStart.toFixed(3)), sequence_end: lesson.closingStart },
    ],
    provider_free_closing_card: { start: lesson.closingStart, end: 600 },
    presenter_transform: { x: 1048, y: 326, width: 768, height: 432, fit: 'contain', border: 'solid_gold', background: 'provider_free_textured_studio' },
  }
  const receipt = {
    schema_version: 1,
    status: 'completed_once_no_retry',
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
    provider_usage: {
      credits_before: lesson.creditsBefore,
      credits_after: lesson.creditsAfter,
      credit_cost: lesson.creditsBefore - lesson.creditsAfter,
      cash_purchase_usd: 0,
      wallet_debit_usd: null,
      note: 'The account exposed subscription-credit consumption, not a separate cash debit for this job.',
    },
    native_source: { path: path.relative(root, source), sha256: sha(source), duration_seconds: Number(sourceDuration.toFixed(3)) },
    provider_captions: { path: path.relative(root, providerSrt), sha256: sha(providerSrt) },
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
  writeFileSync(path.join(here, `${lesson.id.toLowerCase()}-provider-receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`)
  writeFileSync(path.join(here, `${lesson.id.toLowerCase()}-composite-timeline.json`), `${JSON.stringify(timeline, null, 2)}\n`)
  batchLessons.push({ lesson_id: lesson.id, job_id: lesson.job, request_sha256: lesson.request, credit_cost: receipt.provider_usage.credit_cost, native_source_sha256: receipt.native_source.sha256, composite_sha256: receipt.composite.sha256, native_duration_seconds: receipt.native_source.duration_seconds })
  rmSync(base, { force: true })
  rmSync(raw, { force: true })
  rmSync(frames, { recursive: true, force: true })
  console.log(`${lesson.id}: ${receipt.composite.sha256}`)
}

const batchReceipt = {
  schema_version: 1,
  status: 'four_sources_completed_once_no_retry_and_composited_provider_free',
  source_commit: sourceCommit,
  batch_sha256: batchSha,
  look_id: lookId,
  voice_id: voiceId,
  jobs_submitted: 4,
  retries: 0,
  credits_before: 1293,
  credits_after: 1250,
  aggregate_credit_cost: 43,
  cash_purchase_usd: 0,
  lessons: batchLessons,
}
writeFileSync(path.join(here, 'batch-provider-receipt.json'), `${JSON.stringify(batchReceipt, null, 2)}\n`)
rmSync(studioBackdropPath, { force: true })
console.log(`L05-L08 complete: ${batchLessons.length} sources, ${batchReceipt.aggregate_credit_cost} credits, no retries`)
