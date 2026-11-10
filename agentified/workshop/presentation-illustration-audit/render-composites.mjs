#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const audit = JSON.parse(readFileSync(path.join(here, 'audit-boundaries.json'), 'utf8'))
const out = path.join(here, 'composites')
mkdirSync(out, { recursive: true })
const receiptOnly = process.argv.includes('--receipts-only')
const only = process.argv.slice(2).filter(value => value !== '--receipts-only').map(value => value.toUpperCase())
const receipt = []
const presenterInset = { x: 1038, y: 316, width: 788, height: 452 }
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v','error','-show_entries','stream=codec_type,r_frame_rate:format=duration','-of','json',file], {encoding:'utf8'}))
const timelineFor = id => {
  const n = Number(id.slice(1))
  const folder = n === 1 ? 'l01-native-composite' : n <= 4 ? 'l02-l04-native-composite' : n <= 8 ? 'l05-l08-native-composite' : n <= 12 ? 'l09-l12-native-composite' : 'l13-l16-native-composite'
  const name = n === 1 ? 'composite-timeline.json' : `${id.toLowerCase()}-composite-timeline.json`
  return JSON.parse(readFileSync(path.join(root, 'agentified/workshop', folder, name), 'utf8'))
}
for (let n = 1; n <= 16; n++) {
  const id = `L${String(n).padStart(2,'0')}`
  if (only.length && !only.includes(id)) continue
  const rows = audit.rows.filter(row => row.scene_id.startsWith(`${id}-`))
  if (rows.length !== 8) throw new Error(`${id}: expected eight scene boundaries`)
  const source = path.join(root, rows[0].video_path)
  const info = probe(source)
  const duration = Number(info.format.duration)
  const fps = info.streams.find(stream => stream.codec_type === 'video').r_frame_rate
  const protectedWindows = []
  if (n === 1) {
    const narrationReceipt = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/l01-continuous-narration/validation-receipt.json'),'utf8'))
    for (const placement of narrationReceipt.presenter_source.placements.filter(placement => placement.sequence_end <= duration)) protectedWindows.push([placement.sequence_start,placement.sequence_end,'native presenter'])
    const continuityReceipt = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/l01-narration-continuity/validation-receipt.json'),'utf8'))
    const endScreen = continuityReceipt.continuity.end_screen
    protectedWindows.push([endScreen.start,endScreen.end,'approved branded end screen'])
  } else if (n >= 5 && n <= 8) {
    const finalReceipt = JSON.parse(readFileSync(path.join(root, `agentified/workshop/l05-l08-continuous-narration/${id.toLowerCase()}-validation-receipt.json`),'utf8'))
    for (const placement of finalReceipt.presenter_source.placements) protectedWindows.push([placement.sequence_start,placement.sequence_end,'native presenter'])
    const guide = finalReceipt.guided_work_window
    protectedWindows.push([guide.start,guide.end,'original countdown'])
  } else {
    const timeline = timelineFor(id)
    for (const placement of timeline.presenter_windows || timeline.placements || []) protectedWindows.push([placement.sequence_start,placement.sequence_end,'native presenter'])
    const countdown = timeline.guided_work_countdown
    if (countdown) protectedWindows.push([countdown.sequence_start,countdown.sequence_end,'original countdown'])
  }
  const concat = rows.map(row => {
    const frame = path.join(here, 'frames/illustrated', `${row.scene_id}.png`)
    return `file '${frame.replaceAll("'", "'\\''")}'\nduration ${(row.end_seconds-row.start_seconds).toFixed(6)}`
  }).join('\n') + `\nfile '${path.join(here,'frames/illustrated',`${id}-08.png`)}'\n`
  const list = path.join(out, `${id}-frames.txt`)
  writeFileSync(list, concat)
  const presenterVisible = protectedWindows.filter(([, , kind]) => kind === 'native presenter').map(([start,end]) => `between(t,${start},${end})`).join('+') || '0'
  const fullFrameVisible = protectedWindows.filter(([, , kind]) => kind !== 'native presenter').map(([start,end]) => `between(t,${start},${end})`).join('+') || '0'
  // Preserve the approved presenter pixels without restoring the legacy teaching
  // slide that surrounds the inset in the source composite.
  const filter = `[0:v]fps=${fps},format=yuv420p[art];[1:v]format=yuv420p,split=2[original][presenterSource];[presenterSource]crop=${presenterInset.width}:${presenterInset.height}:${presenterInset.x}:${presenterInset.y}[presenter];[art][original]overlay=enable='${fullFrameVisible}':shortest=1:format=auto[base];[base][presenter]overlay=${presenterInset.x}:${presenterInset.y}:enable='${presenterVisible}':shortest=1:format=auto,format=yuv420p[v]`
  const output = path.join(out, `${id}-illustrated-review.mp4`)
  const args = ['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,'-i',source,'-filter_complex',filter,'-map','[v]','-map','1:a?','-map','1:s?','-c:v','libx264','-preset','veryfast','-crf','20','-r',fps,'-c:a','copy','-c:s','copy','-t',String(duration),'-movflags','+faststart',output]
  if (receiptOnly) {
    if (!existsSync(output)) throw new Error(`${id}: missing composite for receipt refresh`)
    console.log(`${id}: refreshing receipt; protected ${protectedWindows.length} windows`)
  } else {
    console.log(`${id}: rendering ${duration}s at ${fps}; protected ${protectedWindows.length} windows`)
    const run = spawnSync('ffmpeg',args,{stdio:'inherit'})
    if (run.status !== 0) throw new Error(`${id}: ffmpeg exited ${run.status}`)
  }
  receipt.push({
    lesson_id: id,
    source_path: rows[0].video_path,
    source_sha256: sha(source),
    output_path: path.relative(root, output),
    output_sha256: sha(output),
    scene_count: rows.length,
    release_state: 'unbound review candidate',
    source_duration_seconds: duration,
    frame_rate: fps,
    protected_windows: protectedWindows,
    scene_boundaries: rows.map(({scene_id,start_seconds,end_seconds})=>({scene_id,start_seconds,end_seconds})),
  })
  writeFileSync(path.join(here,'composite-receipts.json'),JSON.stringify({schema_version:1,composites:receipt},null,2)+'\n')
}
