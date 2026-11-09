#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const out = path.join(here, 'frames/boundaries')
mkdirSync(out, { recursive: true })
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const norm = value => value.toLowerCase().replace(/[`’']/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const clock = value => value.split(':').reduce((sum, part) => sum * 60 + Number(part), 0)
const stamp = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${(value % 60).toFixed(2).padStart(5, '0')}`
const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function videoFor(id) {
  const n = Number(id.slice(1))
  const lib = n === 1 ? 'lib/agentified-l01-media.ts' : n <= 4 ? 'lib/agentified-l02-l04-media.ts' : n <= 8 ? 'lib/agentified-l05-l08-media.ts' : n <= 12 ? 'lib/agentified-l09-l12-media.ts' : 'lib/agentified-l13-l16-media.ts'
  const source = readFileSync(path.join(root, lib), 'utf8')
  const videos = [...source.matchAll(/video:\s*'([^']+)'/g)].map(match => match[1])
  const index = n === 1 ? 0 : n <= 4 ? n - 2 : n <= 8 ? n - 5 : n <= 12 ? n - 9 : n - 13
  const video = path.join(root, 'public', videos[index].replace(/^\//, ''))
  return { video, lib }
}

function vttCues(file) {
  return readFileSync(file, 'utf8').split(/\n\s*\n/).slice(1).flatMap(block => {
    const lines = block.split('\n')
    const timing = lines.find(line => line.includes(' --> '))
    if (!timing) return []
    return [{ start: clock(timing.split(' --> ')[0]), text: lines.slice(lines.indexOf(timing) + 1).join(' ') }]
  })
}

function boundariesFor(id, packet) {
  const n = Number(id.slice(1))
  if (n <= 4) return packet.scenes.map(scene => scene.start_seconds)
  if (n <= 8) {
    const receipt = JSON.parse(readFileSync(path.join(root, `agentified/workshop/l05-l08-continuous-narration/${id.toLowerCase()}-validation-receipt.json`), 'utf8'))
    return receipt.segment_placements.map((placement, index) => index === 0 ? 0 : placement.sequence_start)
  }
  const group = n <= 12 ? 'l09-l12' : 'l13-l16'
  const cues = vttCues(path.join(root, `agentified/workshop/${group}-native-composite/agentified-${id.toLowerCase()}-native-captions.vtt`))
  let previous = -1
  return packet.scenes.map((scene, sceneIndex) => {
    if (sceneIndex === 0) return 0
    const words = norm(scene.narration_exact).split(' ')
    let index = -1
    for (let count = Math.min(6, words.length); count >= 1 && index < 0; count -= 1) {
      const prefix = words.slice(0, count).join(' ')
      index = cues.findIndex((cue, candidate) => candidate > previous && norm(cue.text).startsWith(prefix))
    }
    if (index < 0) throw new Error(`${scene.id}: caption boundary not found`)
    previous = index
    return cues[index].start
  })
}

const rows = []
for (let n = 1; n <= 16; n += 1) {
  const id = `L${String(n).padStart(2, '0')}`
  const packet = JSON.parse(readFileSync(path.join(root, `agentified/workshop/scene-production/packets/${id}.json`), 'utf8'))
  const { video, lib } = videoFor(id)
  const videoHash = sha(video)
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', video], { encoding: 'utf8' }).trim())
  const starts = boundariesFor(id, packet)
  if (starts.length !== 8 || starts.some((start, i) => i && start <= starts[i - 1])) throw new Error(`${id}: invalid scene boundaries`)
  const tiles = []
  for (let i = 0; i < 8; i += 1) {
    const scene = packet.scenes[i]
    const end = i === 7 ? duration : starts[i + 1]
    const samples = { boundary: Math.min(end - 0.2, starts[i] + 1.5), midpoint: (starts[i] + end) / 2 }
    const paths = {}
    for (const [kind, time] of Object.entries(samples)) {
      const file = path.join(out, `${scene.id}-${kind}.jpg`)
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', time.toFixed(3), '-i', video, '-frames:v', '1', '-vf', 'scale=640:360', '-q:v', '4', '-y', file])
      paths[kind] = path.relative(here, file)
    }
    const frame = await sharp(path.join(here, paths.midpoint)).png().toBuffer()
    const label = Buffer.from(`<svg width="640" height="38" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="38" fill="#071b2a"/><text x="12" y="27" fill="#f5eddb" font-family="Arial" font-size="21">${xml(scene.id)}  ${stamp(samples.midpoint)}</text></svg>`)
    tiles.push({ input: frame, left: (i % 4) * 640, top: Math.floor(i / 4) * 398 + 38 }, { input: label, left: (i % 4) * 640, top: Math.floor(i / 4) * 398 })
    rows.push({ scene_id: scene.id, start_seconds: Number(starts[i].toFixed(3)), end_seconds: Number(end.toFixed(3)), boundary_sample_seconds: Number(samples.boundary.toFixed(3)), midpoint_sample_seconds: Number(samples.midpoint.toFixed(3)), video_path: path.relative(root, video), video_sha256: videoHash, source_lib: lib, approved_visuals: scene.approved_visuals.map(v => ({ path: v.path, sha256: v.sha256 })), audience_copy: scene.audience_copy, frames: paths })
  }
  await sharp({ create: { width: 2560, height: 796, channels: 3, background: '#071b2a' } }).composite(tiles).png().toFile(path.join(out, `${id}-contact.png`))
  console.log(`${id}: ${starts.map(stamp).join('  ')}`)
}
writeFileSync(path.join(here, 'audit-boundaries.json'), JSON.stringify({ schema_version: 1, source_commit: 'f0931f3860e042507ee5aba83f220eb57cfd3eb5', rows }, null, 2) + '\n')
console.log(`Captured ${rows.length} scene boundaries and midpoints`)
