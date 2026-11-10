#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const sourceDir = path.join(root, 'agentified/workshop/l01-continuous-narration')
const sourceComposite = path.join(sourceDir, 'agentified-l01-continuous-narration-composite.mp4')
const sourceIllustrated = path.join(root, 'public/agentified/lessons/l01/illustrated-7365b3dc/agentified-l01-illustrated-composite.mp4')
const sourceVtt = path.join(sourceDir, 'agentified-l01-continuous-narration-captions.vtt')
const outputComposite = path.join(here, 'agentified-l01-continuous-narration-composite.mp4')
const outputIllustrated = path.join(here, 'agentified-l01-illustrated-composite.mp4')
const outputSrt = path.join(here, 'agentified-l01-continuous-narration-captions.srt')
const outputVtt = path.join(here, 'agentified-l01-continuous-narration-captions.vtt')
const receiptPath = path.join(here, 'validation-receipt.json')
const auditReviewComposite = path.join(root, 'agentified/workshop/presentation-illustration-audit/composites/L01-illustrated-review.mp4')
const endScreenPath = path.join(here, 'agentified-l01-end-screen.png')
const nextLessonPoster = path.join(root, 'public/agentified/posters/l02-poster.webp')
const logoPath = path.join(root, 'public/amadutown-logo-upscaled.png')

const SOURCE_DURATION = 540
const ORDINARY_GAP_SECONDS = 0.8
const LONG_GAP_THRESHOLD_SECONDS = 2.5
const GUIDED_WORK_PREVIOUS = 'The point is to see the shape of the work before asking a tool to do it.'
const GUIDED_WORK_NEXT = 'Save those two boxes in your Agentified Operating File as a draft.'

function run(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
}

function probeDuration(file) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim())
}

function sha(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function seconds(value) {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/)
  if (!match) throw new Error(`Invalid VTT time: ${value}`)
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000
}

function stamp(value, vtt = true) {
  const totalMs = Math.max(0, Math.round(value * 1000))
  const hours = Math.floor(totalMs / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  const secs = Math.floor((totalMs % 60_000) / 1000)
  const ms = totalMs % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${vtt ? '.' : ','}${String(ms).padStart(3, '0')}`
}

function parseVtt(text) {
  return [...text.matchAll(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\n([\s\S]*?)(?=\n\d{2}:\d{2}:\d{2}\.\d{3} -->|$)/g)].map(match => ({
    start: seconds(match[1]),
    end: seconds(match[2]),
    text: match[3].trim().replace(/\n/g, ' '),
  }))
}

const cues = parseVtt(readFileSync(sourceVtt, 'utf8'))
if (cues.length !== 55) throw new Error(`Expected 55 L01 cues, received ${cues.length}`)
for (const source of [sourceComposite, sourceIllustrated]) {
  const duration = probeDuration(source)
  if (Math.abs(duration - SOURCE_DURATION) > 0.05) throw new Error(`Immutable source duration drift: ${path.relative(root, source)} is ${duration}s`)
}

const removals = []
for (let index = 0; index < cues.length - 1; index += 1) {
  const current = cues[index]
  const next = cues[index + 1]
  const gap = next.start - current.end
  const guidedWork = current.text === GUIDED_WORK_PREVIOUS && next.text === GUIDED_WORK_NEXT
  if (!guidedWork && gap > LONG_GAP_THRESHOLD_SECONDS) {
    const excess = gap - ORDINARY_GAP_SECONDS
    removals.push({
      after_cue: index + 1,
      before_cue: index + 2,
      source_start: current.end + ORDINARY_GAP_SECONDS / 2,
      source_end: next.start - ORDINARY_GAP_SECONDS / 2,
      removed_seconds: excess,
      original_gap_seconds: gap,
      corrected_gap_seconds: ORDINARY_GAP_SECONDS,
    })
  }
}

if (removals.length !== 36) throw new Error(`Expected 36 artificial pause removals, received ${removals.length}`)

function removedBefore(time) {
  return removals.reduce((total, removal) => total + Math.max(0, Math.min(time, removal.source_end) - removal.source_start), 0)
}

function retime(time) {
  return time - removedBefore(time)
}

const correctedCues = cues.map(cue => ({ ...cue, start: retime(cue.start), end: retime(cue.end) }))
const totalRemoved = removals.reduce((sum, removal) => sum + removal.removed_seconds, 0)
const correctedDuration = SOURCE_DURATION - totalRemoved
const keepSegments = []
let cursor = 0
for (const removal of removals) {
  keepSegments.push([cursor, removal.source_start])
  cursor = removal.source_end
}
keepSegments.push([cursor, SOURCE_DURATION])

function retimeMedia(source, output) {
  const raw = `${output}.raw.mp4`
  const withEndScreen = `${output}.end-screen.mp4`
  const filters = []
  const concatInputs = []
  keepSegments.forEach(([start, end], index) => {
    filters.push(`[0:v]trim=start=${start.toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS[v${index}]`)
    filters.push(`[0:a]atrim=start=${start.toFixed(3)}:end=${end.toFixed(3)},asetpts=PTS-STARTPTS[a${index}]`)
    concatInputs.push(`[v${index}][a${index}]`)
  })
  filters.push(`${concatInputs.join('')}concat=n=${keepSegments.length}:v=1:a=1[vout][aout]`)
  run([
    '-i', source,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '25',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', raw,
  ])
  const endScreenDuration = correctedDuration - endScreenStart
  run([
    '-i', raw, '-loop', '1', '-t', endScreenDuration.toFixed(3), '-i', endScreenPath,
    '-filter_complex', `[1:v]format=rgba,fade=t=in:st=0:d=0.7:alpha=1,setpts=PTS+${endScreenStart.toFixed(3)}/TB[end];[0:v][end]overlay=0:0:eof_action=pass[vout]`,
    '-map', '[vout]', '-map', '0:a:0',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '25',
    '-c:a', 'copy', '-movflags', '+faststart', withEndScreen,
  ])
  run([
    '-i', withEndScreen, '-i', outputSrt,
    '-map', '0:v:0', '-map', '0:a:0', '-map', '1:0',
    '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text',
    '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default',
    '-movflags', '+faststart', output,
  ])
  rmSync(raw, { force: true })
  rmSync(withEndScreen, { force: true })
}

mkdirSync(here, { recursive: true })
const srt = correctedCues.map((cue, index) => `${index + 1}\n${stamp(cue.start, false)} --> ${stamp(cue.end, false)}\n${cue.text}\n`).join('\n')
const vtt = `WEBVTT\n\n${correctedCues.map(cue => `${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n')}`
writeFileSync(outputSrt, srt)
writeFileSync(outputVtt, vtt)
const endScreenStart = correctedCues.at(-1).end
const poster = await sharp(nextLessonPoster).resize(720, 405, { fit: 'cover' }).webp().toBuffer()
const logo = await sharp(logoPath).resize({ width: 74 }).png().toBuffer()
const endScreenSvg = Buffer.from(`<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#071b2a"/>
  <path d="M0 120H1920M0 960H1920" stroke="#ddb44d" stroke-width="2" opacity=".5"/>
  <path d="M102 182H874" stroke="#ddb44d" stroke-width="4"/>
  <circle cx="142" cy="300" r="34" fill="#ddb44d"/>
  <path d="M126 301l11 11 22-25" fill="none" stroke="#071b2a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="196" y="316" fill="#f5eddb" font-family="Arial, sans-serif" font-size="38" font-weight="700">LESSON 01 COMPLETE</text>
  <text x="102" y="430" fill="#f5eddb" font-family="Georgia, serif" font-size="70">Your first receipt is ready.</text>
  <text x="102" y="500" fill="#afc1cb" font-family="Arial, sans-serif" font-size="32">Keep building the operating file.</text>
  <rect x="102" y="600" width="760" height="98" rx="8" fill="#102f40" stroke="#ddb44d" stroke-width="2"/>
  <text x="142" y="642" fill="#ddb44d" font-family="Arial, sans-serif" font-size="21" font-weight="700">CONTINUE IN THE LEARNING PLAN</text>
  <text x="142" y="676" fill="#f5eddb" font-family="Arial, sans-serif" font-size="24">Your response and progress stay with the lesson.</text>
  <text x="102" y="875" fill="#afc1cb" font-family="Arial, sans-serif" font-size="24">COURSE PROGRESS</text>
  <text x="102" y="922" fill="#f5eddb" font-family="Arial, sans-serif" font-size="34" font-weight="700">1 OF 16</text>
  <rect x="250" y="895" width="612" height="16" rx="8" fill="#315263"/>
  <rect x="250" y="895" width="38" height="16" rx="8" fill="#ddb44d"/>
  <rect x="1048" y="238" width="780" height="487" rx="8" fill="#102f40" stroke="#ddb44d" stroke-width="4"/>
  <text x="1080" y="785" fill="#ddb44d" font-family="Arial, sans-serif" font-size="22" font-weight="700">UP NEXT · LESSON 02</text>
  <text x="1080" y="838" fill="#f5eddb" font-family="Georgia, serif" font-size="46">Start with the decision</text>
  <text x="1080" y="884" fill="#afc1cb" font-family="Arial, sans-serif" font-size="24">Name the human decision and the cost of a wrong answer.</text>
  <text x="192" y="1020" fill="#f5eddb" font-family="Arial, sans-serif" font-size="22" font-weight="700">AMADUTOWN / AGENTIFIED</text>
</svg>`)
await sharp(endScreenSvg).composite([
  { input: poster, left: 1078, top: 268 },
  { input: logo, left: 102, top: 974 },
]).png().toFile(endScreenPath)
retimeMedia(sourceComposite, outputComposite)
retimeMedia(sourceIllustrated, outputIllustrated)

const guidedWorkStart = correctedCues.find(cue => cue.text === GUIDED_WORK_PREVIOUS).end
const guidedWorkEnd = correctedCues.find(cue => cue.text === GUIDED_WORK_NEXT).start
const ordinaryGaps = correctedCues.slice(0, -1).map((cue, index) => ({
  after_cue: index + 1,
  seconds: correctedCues[index + 1].start - cue.end,
  guided_work: cue.text === GUIDED_WORK_PREVIOUS && correctedCues[index + 1].text === GUIDED_WORK_NEXT,
})).filter(gap => !gap.guided_work)
const maxOrdinaryGap = Math.max(...ordinaryGaps.map(gap => gap.seconds))
if (maxOrdinaryGap > LONG_GAP_THRESHOLD_SECONDS) throw new Error(`Corrected ordinary gap exceeds budget: ${maxOrdinaryGap}`)

const publicCompositeHash = sha(outputComposite)
const publicIllustratedHash = sha(outputIllustrated)
const publicDir = path.join(root, `public/agentified/lessons/l01/continuous-${publicCompositeHash.slice(0, 8)}`)
const publicIllustratedDir = path.join(root, `public/agentified/lessons/l01/illustrated-${publicIllustratedHash.slice(0, 8)}`)
mkdirSync(publicDir, { recursive: true })
mkdirSync(publicIllustratedDir, { recursive: true })
copyFileSync(outputComposite, path.join(publicDir, 'agentified-l01-continuous-narration-composite.mp4'))
copyFileSync(outputVtt, path.join(publicDir, 'agentified-l01-continuous-narration-captions.vtt'))
copyFileSync(outputIllustrated, path.join(publicIllustratedDir, 'agentified-l01-illustrated-composite.mp4'))
copyFileSync(outputIllustrated, auditReviewComposite)

writeFileSync(receiptPath, JSON.stringify({
  schema_version: 1,
  status: 'provider_free_narration_continuity_ready_for_human_qa',
  lesson_id: 'L01',
  source_commit: 'c350559dfda0a5f164323838ddd8a7390031c9b7',
  source_composite: { path: path.relative(root, sourceComposite), sha256: sha(sourceComposite), duration_seconds: SOURCE_DURATION },
  source_illustrated_composite: { path: path.relative(root, sourceIllustrated), sha256: sha(sourceIllustrated) },
  corrected_composite: { path: path.relative(root, outputComposite), sha256: publicCompositeHash, duration_seconds: correctedDuration },
  corrected_illustrated_composite: { path: path.relative(root, outputIllustrated), sha256: publicIllustratedHash, duration_seconds: correctedDuration },
  captions: { srt_path: path.relative(root, outputSrt), srt_sha256: sha(outputSrt), vtt_path: path.relative(root, outputVtt), vtt_sha256: sha(outputVtt), cue_count: correctedCues.length },
  continuity: {
    ordinary_gap_target_seconds: ORDINARY_GAP_SECONDS,
    ordinary_gap_limit_seconds: LONG_GAP_THRESHOLD_SECONDS,
    removed_pause_count: removals.length,
    removed_seconds: totalRemoved,
    maximum_corrected_ordinary_gap_seconds: maxOrdinaryGap,
    guided_work_window: { start: guidedWorkStart, end: guidedWorkEnd, duration_seconds: guidedWorkEnd - guidedWorkStart, preserved: true },
    end_screen: {
      start: endScreenStart,
      end: correctedDuration,
      duration_seconds: correctedDuration - endScreenStart,
      image_path: path.relative(root, endScreenPath),
      image_sha256: sha(endScreenPath),
      next_lesson_poster_path: path.relative(root, nextLessonPoster),
      next_lesson_poster_sha256: sha(nextLessonPoster),
      treatment: 'branded lesson-complete screen with course progress and exact next-lesson cover',
    },
    removals,
  },
  corrected_cues: correctedCues,
  boundaries: {
    provider_calls: 0,
    narration_rewritten: false,
    source_audio_replaced: false,
    presenter_footage_replaced: false,
    illustrations_replaced: false,
    closing_copy_rewritten: false,
    youtube_style_end_screen_added: true,
    production_binding_changed: false,
  },
}, null, 2) + '\n')

console.log(JSON.stringify({
  correctedDuration,
  totalRemoved,
  compositeSha256: publicCompositeHash,
  illustratedSha256: publicIllustratedHash,
  srtSha256: sha(outputSrt),
  vttSha256: sha(outputVtt),
  publicDir: path.relative(root, publicDir),
  publicIllustratedDir: path.relative(root, publicIllustratedDir),
}, null, 2))
