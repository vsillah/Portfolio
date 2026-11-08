#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const W = 1920, H = 1080, fps = 25
const lessons = [
  {
    id: 'L02', duration: 510, split: 16.709, sourceEnd: 19.946, closingStart: 504,
    cues: [
      [0, 2.393, 'Morgan opens the Session Option Brief.'],
      [2.654, 4.945, 'It says the free session is a good idea.'],
      [5.549, 6.635, 'The wording sounds settled.'],
      [7.232, 9.476, 'Yet the brief has only prepared a comparison.'],
      [10.032, 16.421, "Somebody still has to decide whether the proposal belongs on next month's program agenda."],
      [16.998, 19.946, 'In the next lesson, we will make the evidence path readable to that owner.']
    ]
  },
  {
    id: 'L03', duration: 600, split: 14.572, sourceEnd: 19.015, closingStart: 592,
    cues: [
      [0.233, 3.174, 'Morgan sees a line in the Harbor Session Option Brief: “The room can hold twenty people.”'],
      [4.282, 5.986, 'Morgan asks where the number came from.'],
      [6.507, 14.106, 'A raw machine log might answer eventually, after someone searches through hundreds of entries.'],
      [15.039, 19.015, 'Next we will decide what a human correction is allowed to teach the system.']
    ]
  },
  {
    id: 'L04', duration: 600, split: 18.086, sourceEnd: 21.535, closingStart: 597,
    cues: [
      [0, 6.246, 'Morgan reviews the Harbor brief and writes a correction: “The facilitator note says available for review.”'],
      [6.74, 8.793, 'It does not say confirmed to teach.'],
      [9.842, 10.998, 'The draft is fixed.'],
      [11.513, 13.829, 'A week later, another request comes in.'],
      [14.338, 16.509, 'Should the agent remember that correction?'],
      [16.952, 17.841, 'Yes, perhaps.'],
      [18.331, 21.535, 'The next lesson will place these pieces on one operating map.']
    ]
  }
]

function run(args) { execFileSync('ffmpeg', ['-y', ...args], { stdio: 'inherit' }) }
function sha(file) { return createHash('sha256').update(readFileSync(file)).digest('hex') }
function esc(value) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('“', '').replaceAll('”', '') }
function lines(text, max = 34) {
  const out = []; let line = ''
  for (const word of text.split(/\s+/)) {
    if (`${line} ${word}`.trim().length <= max) line = `${line} ${word}`.trim()
    else { if (line) out.push(line); line = word }
  }
  if (line) out.push(line)
  return out
}
function textBlock(values, x, y, size, max, color, weight = 400, gap = 1.18) {
  let cursor = y; let svg = ''
  for (const value of values) {
    for (const line of lines(value, max)) {
      svg += `<text x="${x}" y="${cursor}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}">${esc(line)}</text>`
      cursor += size * gap
    }
    cursor += size * .32
  }
  return svg
}
function clock(value, separator = ',') {
  const ms = Math.round(value * 1000); const h = Math.floor(ms / 3600000); const m = Math.floor(ms % 3600000 / 60000); const s = Math.floor(ms % 60000 / 1000); const rem = ms % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${separator}${String(rem).padStart(3, '0')}`
}
async function frame(packet, scene, dir) {
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

for (const lesson of lessons) {
  const packet = JSON.parse(readFileSync(path.join(root, `agentified/workshop/scene-production/packets/${lesson.id}.json`), 'utf8'))
  const source = path.join(root, `agentified/workshop/l02-l04-native-source/agentified-${lesson.id.toLowerCase()}-heygen-native-source.mp4`)
  const frames = path.join(here, `frames-${lesson.id}`); mkdirSync(frames, { recursive: true })
  for (const scene of packet.scenes) await frame(packet, scene, frames)
  const secondDuration = lesson.sourceEnd - lesson.split
  const secondStart = lesson.closingStart - secondDuration
  const timeline = {
    schema_version: 1, lesson_id: lesson.id, lesson_duration_seconds: lesson.duration,
    source_sha256: sha(source), native_speed: 1, source_split_seconds: lesson.split, source_end_seconds: lesson.sourceEnd,
    placements: [
      { scene_id: `${lesson.id}-01`, source_in: 0, source_out: lesson.split, sequence_start: 0, sequence_end: lesson.split },
      { scene_id: `${lesson.id}-08`, source_in: lesson.split, source_out: lesson.sourceEnd, sequence_start: Number(secondStart.toFixed(3)), sequence_end: lesson.closingStart }
    ],
    provider_free_closing_card: { start: lesson.closingStart, end: lesson.duration },
    presenter_transform: { x: 1048, y: 326, width: 768, height: 432, fit: 'contain', border: 'solid_gold' }
  }
  writeFileSync(path.join(here, `${lesson.id.toLowerCase()}-composite-timeline.json`), JSON.stringify(timeline, null, 2) + '\n')
  const mapped = lesson.cues.map(([start, end, text]) => start >= lesson.split ? [secondStart + start - lesson.split, secondStart + end - lesson.split, text] : [start, end, text])
  const srt = mapped.map(([start, end, text], i) => `${i + 1}\n${clock(start)} --> ${clock(end)}\n${text}\n`).join('\n')
  const vtt = `WEBVTT\n\n${mapped.map(([start, end, text]) => `${clock(start, '.')} --> ${clock(end, '.')}\n${text}\n`).join('\n')}`
  const srtPath = path.join(here, `agentified-${lesson.id.toLowerCase()}-native-captions.srt`)
  writeFileSync(srtPath, srt); writeFileSync(path.join(here, `agentified-${lesson.id.toLowerCase()}-native-captions.vtt`), vtt)
  const inputs = [], filters = []
  packet.scenes.forEach((scene, i) => { inputs.push('-loop', '1', '-t', String(scene.end_seconds - scene.start_seconds), '-i', path.join(frames, `${scene.id}.png`)); filters.push(`[${i}:v]fps=${fps},format=yuv420p[v${i}]`) })
  filters.push(`${packet.scenes.map((_, i) => `[v${i}]`).join('')}concat=n=${packet.scenes.length}:v=1:a=0[base]`)
  const base = path.join(here, `${lesson.id}-base.mp4`)
  run([...inputs, '-filter_complex', filters.join(';'), '-map', '[base]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(fps), base])
  const inset = 'chromakey=0x00d96c:0.18:0.04,despill=type=green:mix=0.4:expand=0.1,scale=768:432:force_original_aspect_ratio=decrease,pad=768:432:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba'
  const graph = `[1:v]trim=0:${lesson.split},setpts=PTS-STARTPTS,${inset}[p1];[1:v]trim=${lesson.split}:${lesson.sourceEnd},setpts=PTS-STARTPTS+${secondStart}/TB,${inset}[p2];[0:v][p1]overlay=1048:326:eof_action=pass[v1];[v1][p2]overlay=1048:326:eof_action=pass[v2];[v2]drawbox=x=1038:y=316:w=788:h=452:color=#d8ad43:t=5:enable='between(t,0,${lesson.split})+between(t,${secondStart},${lesson.closingStart})'[vout];[1:a]atrim=0:${lesson.split},asetpts=PTS-STARTPTS[a1];[1:a]atrim=${lesson.split}:${lesson.sourceEnd},asetpts=PTS-STARTPTS,adelay=${Math.round(secondStart * 1000)}|${Math.round(secondStart * 1000)}[a2];anullsrc=r=48000:cl=stereo:d=${lesson.duration}[silence];[silence][a1][a2]amix=inputs=3:duration=longest:normalize=0[aout]`
  const raw = path.join(here, `${lesson.id}-raw.mp4`)
  const output = path.join(here, `agentified-${lesson.id.toLowerCase()}-native-composite.mp4`)
  run(['-i', base, '-i', source, '-filter_complex', graph, '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(lesson.duration), raw])
  run(['-i', raw, '-i', srtPath, '-map', '0:v:0', '-map', '0:a:0', '-map', '1:0', '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default', '-movflags', '+faststart', output])
  rmSync(base, { force: true }); rmSync(raw, { force: true }); rmSync(frames, { recursive: true, force: true })
  console.log(`${lesson.id}: ${sha(output)}`)
}
