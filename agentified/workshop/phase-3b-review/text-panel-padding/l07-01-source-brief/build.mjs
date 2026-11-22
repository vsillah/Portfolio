#!/usr/bin/env node
// Provider-free L07-01 raster source composition. No learner binding changes.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..')
const prior = path.join(here, '../l07-08-caption-free-presenter/L07-caption-free-closing-candidate.mp4')
const clean = path.join(here, '../l07-08-caption-free-presenter/Agentified_L07_f35b6f52-caption-free-source.mp4')
const backdrop = path.join(here, '../l07-08-caption-free-presenter/studio-backdrop.png')
const captions = path.join(root, 'public/agentified/lessons/l07/continuous-869a0ff4/agentified-l07-continuous-narration-captions.vtt')
const script = path.join(root, 'agentified/workshop/scripts/L07-prd-and-pod.md')
const packet = path.join(root, 'agentified/workshop/scene-production/packets/L07.json')
const sourceMap = path.join(root, 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json')
const preview = process.argv.includes('--preview')
const receiptOnly = process.argv.includes('--receipt-only')
const output = path.join(here, preview ? 'L07-01-source-brief-preview.mp4' : 'L07-01-source-brief-candidate.mp4')
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
assert.equal(sha(prior), '0c07d394a842513b57a9d873dd618974d11effaa8e6696b5a534e179a63c68b4', 'prior candidate drift')
assert.equal(sha(clean), '795252b7c7a13a6905f5b828b458d39a55bdfc02e27e69d7a72a50bb847f9c8b', 'retained presenter drift')
assert.equal(sha(captions), '984fa64e556279730d30a602b3ce160620822ef0577a7ff6cf7de7028e3f8f21', 'VTT drift')
assert.equal(sha(script), '9c59a8a5108133077c75b0b9dfaa401080ea4513e58869e5e30b657b3c827952', 'script drift')
assert.equal(sha(packet), 'fefbdc1e3cf386b7220284ace5ac8c818030f2c8e8b8c94db9c3f7a83e8dcf87', 'scene packet drift')
assert.equal(sha(sourceMap), '6316aa15a232e99019f938ccbaae397e5314f5d4035a626346caad5f6b8aebad', 'source map drift')
const generate = spawnSync('python3', [path.join(here, 'build-plates.py')], { stdio: 'inherit' })
assert.equal(generate.status, 0, `raster plate generation failed: ${generate.status}`)

const states = [
  { start: 0, end: 2.8, file: 'brief-presenter-0.png', meaning: 'brief received' },
  { start: 2.8, end: 4.47, file: 'brief-presenter-1.png', meaning: 'three source notes compared' },
  { start: 4.47, end: 5.93, file: 'brief-presenter-2.png', meaning: 'incorrect confirmed claim shown' },
  { start: 5.93, end: 7.3, file: 'brief-presenter-3.png', meaning: 'incorrect claim marked wrong' },
  { start: 7.3, end: 9.37, file: 'brief-presenter-4.png', meaning: 'actual source wording shown' },
  { start: 9.37, end: 15.423, file: 'brief-expanded-4.png', meaning: 'brief remains populated after presenter exit' },
  { start: 15.423, end: 18.409, file: 'brief-expanded-5.png', meaning: 'wrong staffing claim summary' },
  { start: 18.409, end: 27.99, file: 'brief-expanded-6.png', meaning: 'source-defined requirement question' },
]
const probe = file => {
  const run = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,nb_frames', '-of', 'json', file], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(run.stdout)
}
const priorInfo = probe(prior)
const cleanInfo = probe(clean)
assert.deepEqual(priorInfo.streams.map(s => s.codec_type), ['video', 'audio', 'subtitle'])
assert.deepEqual([priorInfo.streams[0].width, priorInfo.streams[0].height, priorInfo.streams[0].r_frame_rate, Number(priorInfo.streams[0].nb_frames)], [1920, 1080, '25/1', 6283])
assert.deepEqual([cleanInfo.streams[0].width, cleanInfo.streams[0].height, cleanInfo.streams[0].r_frame_rate, Number(cleanInfo.streams[0].nb_frames)], [1920, 1080, '25/1', 387])
const inset = 'colorkey=0x00e868:0.28:0.08,despill=type=green:mix=0.05:expand=0.02,scale=748:412:force_original_aspect_ratio=decrease,pad=748:412:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba'
const graph = [
  "[0:v][3:v]overlay=0:0:enable='lt(t,27.99)':eof_action=pass:repeatlast=1[field]",
  ...states.map((state, i) => `[${i === 0 ? 'field' : `state${i}`}][${i + 4}:v]overlay=0:0:enable='gte(t,${state.start})*lt(t,${state.end})':eof_action=pass:repeatlast=1[${i === states.length - 1 ? 'states' : `state${i + 1}`}]`),
  'color=c=#092433:s=768x432:r=25:d=9.37,format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame]',
  '[2:v]trim=duration=9.37,setpts=PTS-STARTPTS,scale=748:412[bg]',
  '[frame][bg]overlay=10:10:eof_action=pass:repeatlast=1[studio]',
  `[1:v]trim=0:9.37,setpts=PTS-STARTPTS,${inset}[presenter]`,
  '[studio][presenter]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=8.87:d=0.5:alpha=1[panel]',
  "[states][panel]overlay=1048:326:enable='lt(t,9.37)':eof_action=pass:repeatlast=0,format=yuv420p[v]",
].join(';')
const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', prior, '-i', clean,
  '-loop', '1', '-framerate', '25', '-i', backdrop,
  '-loop', '1', '-framerate', '25', '-i', path.join(here, 'studio-field.png'),
  ...states.flatMap(state => ['-loop', '1', '-framerate', '25', '-i', path.join(here, state.file)]),
  '-filter_complex', graph, '-map', '[v]', '-map', '0:a:0', '-map', '0:s:0',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', '25', '-c:a', 'copy', '-c:s', 'copy', '-movflags', '+faststart',
  ...(preview ? ['-t', '30'] : []), output]
if (!receiptOnly) {
  const run = spawnSync('ffmpeg', args, { stdio: 'inherit' })
  assert.equal(run.status, 0, `ffmpeg failed: ${run.status}`)
}
const result = probe(output)
assert.deepEqual(result.streams.map(s => s.codec_type), ['video', 'audio', 'subtitle'])
assert.deepEqual([result.streams[0].width, result.streams[0].height, result.streams[0].r_frame_rate], [1920, 1080, '25/1'])
if (!preview) {
  assert.equal(Number(result.streams[0].nb_frames), 6283)
  assert(Math.abs(Number(result.format.duration) - Number(priorInfo.format.duration)) < 0.05)
}
const receipt = {
  status: 'review_only_unbound',
  baseCommit: 'a07b0a62a4226176a2276a613da4da8863ce5d8f',
  prior: { path: path.relative(root, prior), sha256: sha(prior) },
  cleanPresenter: { path: path.relative(root, clean), sha256: sha(clean), retainedProjectId: 'c3cc7090dde04b9483d9f4d4de6b852b' },
  vtt: { path: path.relative(root, captions), sha256: sha(captions) },
  script: { path: path.relative(root, script), sha256: sha(script) },
  packet: { path: path.relative(root, packet), sha256: sha(packet) },
  sourceMap: { path: path.relative(root, sourceMap), sha256: sha(sourceMap) },
  backdrop: { path: path.relative(root, backdrop), sha256: sha(backdrop) },
  rasterField: { path: path.relative(root, path.join(here, 'studio-field.png')), sha256: sha(path.join(here, 'studio-field.png')) },
  states: states.map(state => ({ ...state, sha256: sha(path.join(here, state.file)) })),
  candidate: { path: path.relative(root, output), sha256: sha(output), durationSeconds: Number(result.format.duration), frames: Number(result.streams[0].nb_frames) },
  protectedPresenter: { start: 0, end: 9.37, panelRect: [1048, 326, 768, 432], sourceCropRect: [1038, 316, 788, 452] },
  mediaStreams: ['video', 'prior audio copy', 'prior embedded subtitles copy'],
  binding: 'none',
}
writeFileSync(path.join(here, preview ? 'preview-receipt.json' : 'candidate-receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt, null, 2))
