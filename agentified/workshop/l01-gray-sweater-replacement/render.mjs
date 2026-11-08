#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const packetPath = path.join(root, 'agentified/workshop/scene-production/packets/L01.json')
const source = path.join(here, 'agentified-l01-gray-sweater-source.mp4')
const frames = path.join(here, 'frames')
const output = path.join(here, 'agentified-l01-gray-sweater-composite.mp4')
const captions = path.join(here, 'agentified-l01-gray-sweater-captions.srt')
const captionsVtt = path.join(here, 'agentified-l01-gray-sweater-captions.vtt')
const timelinePath = path.join(here, 'composite-timeline.json')
const W = 1920, H = 1080, fps = 25
const split = 13.633
const sourceEnd = 16.386

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
async function renderFrame(scene) {
  const visual = scene.approved_visuals[0]?.path ? path.join(root, scene.approved_visuals[0].path) : null
  const headingWidth = ['L01-01', 'L01-08'].includes(scene.id) ? 31 : 52
  const heading = textBlock([scene.audience_copy[0] || 'Your turn'], 105, 210, 56, headingWidth, '#f5eddb', 700)
  const support = textBlock(scene.audience_copy.slice(1), 108, 380, 34, headingWidth, '#b9c8cf', 400)
  let body = ''
  if (visual) {
    body = `<rect x="100" y="325" width="1720" height="620" rx="18" fill="#061726" stroke="#d8ad43" stroke-width="5"/>`
  } else if (scene.id === 'L01-07') {
    body = `<rect x="310" y="390" width="1300" height="430" rx="28" fill="#0a2231" stroke="#58717d" stroke-width="3"/><text x="960" y="555" text-anchor="middle" fill="#f5eddb" font-family="Arial" font-size="150" font-weight="700">2:20</text><text x="960" y="680" text-anchor="middle" fill="#b9c8cf" font-family="Arial" font-size="38">Draft the job. Complete the receipt.</text>`
  } else if (!['L01-01', 'L01-08'].includes(scene.id)) {
    body = `<rect x="110" y="430" width="1700" height="390" rx="28" fill="#0a2231" stroke="#526e7b" stroke-width="2"/><text x="160" y="510" fill="#d8ad43" font-family="Arial" font-size="24" font-weight="700">OPERATING FILE</text><text x="160" y="600" fill="#f5eddb" font-family="Arial" font-size="48" font-weight="700">Evidence travels with the work.</text><text x="160" y="675" fill="#b9c8cf" font-family="Arial" font-size="36">Human review remains the gate.</text>`
  }
  const progress = Math.round(1720 * scene.end_seconds / 540)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="1920" height="1080" fill="#071b2a"/><rect x="48" y="42" width="1824" height="996" rx="24" fill="#0d2a3a" stroke="#54707d" stroke-width="2"/><line x1="88" y1="104" x2="1832" y2="104" stroke="#d8ad43" stroke-width="3"/><text x="92" y="80" fill="#f5eddb" font-family="Arial" font-size="24" font-weight="700">AMADUTOWN / AGENTIFIED</text><text x="1585" y="80" fill="#d8ad43" font-family="Arial" font-size="21" font-weight="700">LESSON 01 • ${scene.id}</text>${heading}${support}${body}<rect x="100" y="1000" width="1720" height="16" rx="8" fill="#29424e"/><rect x="100" y="1000" width="${progress}" height="16" rx="8" fill="#d8ad43"/></svg>`
  let rendered = sharp(Buffer.from(svg)).png()
  if (visual) {
    const plate = await sharp(visual).resize({ width: 1690, height: 590, fit: 'contain', background: '#061726' }).png().toBuffer()
    rendered = rendered.composite([{ input: plate, left: 115, top: 340 }])
  }
  await rendered.toFile(path.join(frames, `${scene.id}.png`))
}

const packet = JSON.parse(readFileSync(packetPath, 'utf8'))
mkdirSync(frames, { recursive: true })
for (const scene of packet.scenes) await renderFrame(scene)

const secondDuration = sourceEnd - split
const timeline = {
  schema_version: 1, lesson_id: 'L01', lesson_duration_seconds: 540,
  source_sha256: sha(source), native_speed: 1, source_split_seconds: split,
  placements: [
    { scene_id: 'L01-01', source_in: 0, source_out: split, sequence_start: 0, sequence_end: split },
    { scene_id: 'L01-08', source_in: split, source_out: sourceEnd, sequence_start: 518.84, sequence_end: Number((518.84 + secondDuration).toFixed(3)) }
  ],
  provider_free_evidence_cards: [{ start: split, end: 19.271 }, { start: Number((518.84 + secondDuration).toFixed(3)), end: 540 }],
  approved_closing_card: { start: 523, end: 540 },
  presenter_transform: { x: 1048, y: 326, width: 768, height: 432, fit: 'contain', border: 'solid_gold' },
  transitions: { treatment: 'provider_free_crossfade', opening_fade_seconds: .35, handoff_fade_seconds: .55, closing_fade_seconds: .3 },
  source_background: { treatment: 'provider_free_conservative_chroma_key', similarity: 0.065, blend: 0.08, reason: 'A conservative, version-bound key removes the provider green field while preserving native facial detail. The source remains unchanged.' }
}
writeFileSync(timelinePath, JSON.stringify(timeline, null, 2) + '\n')
writeFileSync(captions, `1\n00:00:00,200 --> 00:00:01,699\nFriday afternoon.\n\n2\n00:00:01,899 --> 00:00:04,458\nMorgan runs a small community learning program.\n\n3\n00:00:04,458 --> 00:00:10,075\nFor this course, we’ll follow Harbor Learning Circle, an illustrative case built from fictional records.\n\n4\n00:00:10,075 --> 00:00:13,633\nSomeone suggests adding a free digital-skills session next month.\n\n5\n00:08:38,840 --> 00:08:41,586\nNext we will name the decision Morgan actually owns.\n`)
writeFileSync(captionsVtt, `WEBVTT\n\n00:00:00.200 --> 00:00:01.699\nFriday afternoon.\n\n00:00:01.899 --> 00:00:04.458\nMorgan runs a small community learning program.\n\n00:00:04.458 --> 00:00:10.075\nFor this course, we’ll follow Harbor Learning Circle, an illustrative case built from fictional records.\n\n00:00:10.075 --> 00:00:13.633\nSomeone suggests adding a free digital-skills session next month.\n\n00:08:38.840 --> 00:08:41.586\nNext we will name the decision Morgan actually owns.\n`)

const inputs = [], filters = []
packet.scenes.forEach((scene, i) => {
  inputs.push('-loop', '1', '-t', String(scene.end_seconds - scene.start_seconds), '-i', path.join(frames, `${scene.id}.png`))
  filters.push(`[${i}:v]fps=${fps},format=yuv420p[v${i}]`)
})
filters.push(`${packet.scenes.map((_, i) => `[v${i}]`).join('')}concat=n=${packet.scenes.length}:v=1:a=0[base]`)
const base = path.join(here, 'base.mp4')
run([...inputs, '-filter_complex', filters.join(';'), '-map', '[base]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps), base])

const inset = 'chromakey=0x00e868:0.065:0.08,despill=type=green:mix=0.18:expand=0.04,scale=748:412:force_original_aspect_ratio=decrease,pad=748:412:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba'
const graph = `color=c=#092433:s=768x432:r=${fps}:d=${split},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[studio1];[1:v]trim=0:${split},setpts=PTS-STARTPTS,${inset},fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=${(split - .55).toFixed(3)}:d=0.55:alpha=1[p1];[studio1][p1]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=${(split - .55).toFixed(3)}:d=0.55:alpha=1[panel1];color=c=black@0.0:s=768x432:r=${fps}:d=540,format=rgba[p2blank];color=c=#092433:s=768x432:r=${fps}:d=${secondDuration},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[studio2];[1:v]trim=${split}:${sourceEnd},setpts=PTS-STARTPTS,${inset},fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=${(secondDuration - .3).toFixed(3)}:d=0.3:alpha=1[p2];[studio2][p2]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=${(secondDuration - .3).toFixed(3)}:d=0.3:alpha=1,setpts=PTS+518.84/TB[p2shift];[p2blank][p2shift]overlay=0:0:eof_action=pass:repeatlast=0:format=auto[p2track];[0:v][panel1]overlay=1048:326:eof_action=pass:repeatlast=0[v1];[v1][p2track]overlay=1048:326:eof_action=pass:repeatlast=0:format=auto[vout];[1:a]atrim=0:${split},asetpts=PTS-STARTPTS[a1];[1:a]atrim=${split}:${sourceEnd},asetpts=PTS-STARTPTS,adelay=518840|518840[a2];anullsrc=r=48000:cl=stereo:d=540[silence];[silence][a1][a2]amix=inputs=3:duration=longest:normalize=0[aout]`
const raw = path.join(here, 'composite-raw.mp4')
run(['-i', base, '-i', source, '-filter_complex', graph, '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '540', raw])
run(['-i', raw, '-i', captions, '-map', '0:v:0', '-map', '0:a:0', '-map', '1:0', '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default', '-movflags', '+faststart', output])
rmSync(base, { force: true }); rmSync(raw, { force: true }); rmSync(frames, { recursive: true, force: true })
console.log(`${output}\nsha256=${sha(output)}`)
