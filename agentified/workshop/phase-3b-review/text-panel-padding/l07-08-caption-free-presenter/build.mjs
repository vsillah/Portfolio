#!/usr/bin/env node
// Replace only the L07-08 closing presenter panel. Learner bindings stay untouched.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..')
const prior = path.join(here, '../l07-08-clipboard-progression/L07-clipboard-progression-candidate.mp4')
const clean = path.join(here, 'Agentified_L07_f35b6f52-caption-free-source.mp4')
const field = path.join(here, '../l07-08-clipboard-progression/studio-field-checked.png')
const backdrop = path.join(here, 'studio-backdrop.png')
const output = path.join(here, 'L07-caption-free-closing-candidate.mp4')
const expectedPrior = 'eb0e2d5662b2fac5a9e1150b4c2ad14187f58a8ac4a21e5db23e3fc25dcbc46d'
const expectedClean = '795252b7c7a13a6905f5b828b458d39a55bdfc02e27e69d7a72a50bb847f9c8b'
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
assert.equal(sha(prior), expectedPrior, 'clipboard candidate drift')
assert.equal(sha(clean), expectedClean, 'caption-free source drift')

const timeline = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/l05-l08-continuous-narration/l07-validation-receipt.json'), 'utf8'))
const source = timeline.presenter_source
const closing = source.placements[1]
assert.equal(source.source_split_seconds, 9.37)
assert(Math.abs(closing.source_end - 15.48) < 0.001)
assert(Math.abs(closing.sequence_start - 242.222438) < 0.000001)
assert(Math.abs(closing.sequence_end - 248.332438) < 0.000001)
const duration = closing.source_end - closing.source_start

const probe = file => {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,nb_frames', '-of', 'json', file], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}
const priorInfo = probe(prior)
const cleanInfo = probe(clean)
assert.deepEqual(priorInfo.streams.map(s => s.codec_type), ['video', 'audio', 'subtitle'])
assert.deepEqual([priorInfo.streams[0].width, priorInfo.streams[0].height, priorInfo.streams[0].r_frame_rate, Number(priorInfo.streams[0].nb_frames)], [1920, 1080, '25/1', 6283])
assert.deepEqual([cleanInfo.streams[0].width, cleanInfo.streams[0].height, cleanInfo.streams[0].r_frame_rate, Number(cleanInfo.streams[0].nb_frames)], [1920, 1080, '25/1', 387])
assert.equal(Number(cleanInfo.format.duration), 15.48)
assert.deepEqual([probe(field).streams[0].width, probe(field).streams[0].height], [1920, 1080])
assert.deepEqual([probe(backdrop).streams[0].width, probe(backdrop).streams[0].height], [748, 412])

// This is the exact L07 native-panel chroma treatment from the continuous
// composite. The checked field is the approved source plate already beneath
// the previous presenter; the new source replaces only that timed panel.
const inset = 'colorkey=0x00e868:0.28:0.08,despill=type=green:mix=0.05:expand=0.02,scale=748:412:force_original_aspect_ratio=decrease,pad=748:412:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba'
const graph = [
  `color=c=#092433:s=768x432:r=25:d=${duration},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame]`,
  `[2:v]trim=duration=${duration},setpts=PTS-STARTPTS,scale=748:412[bg]`,
  '[frame][bg]overlay=10:10:eof_action=pass:repeatlast=1[studio]',
  `[1:v]trim=${closing.source_start}:${closing.source_end},setpts=PTS-STARTPTS,${inset}[presenter]`,
  `[studio][presenter]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=${duration - 0.3}:d=0.3:alpha=1,setpts=PTS+${closing.sequence_start}/TB[panel]`,
  `[0:v][3:v]overlay=0:0:enable='gte(t,${closing.sequence_start})*lt(t,${closing.sequence_end})':shortest=1[checked-field]`,
  '[checked-field][panel]overlay=1048:326:eof_action=pass:repeatlast=0:format=auto,format=yuv420p[v]',
].join(';')
const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', prior, '-i', clean, '-loop', '1', '-framerate', '25', '-i', backdrop, '-loop', '1', '-framerate', '25', '-i', field,
  '-filter_complex', graph, '-map', '[v]', '-map', '0:a:0', '-map', '0:s:0',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', '25', '-c:a', 'copy', '-c:s', 'copy', '-movflags', '+faststart', output]
const run = spawnSync('ffmpeg', args, { stdio: 'inherit' })
assert.equal(run.status, 0, `ffmpeg failed: ${run.status}`)
const result = probe(output)
assert.deepEqual(result.streams.map(s => s.codec_type), ['video', 'audio', 'subtitle'])
assert.equal(result.streams[0].nb_frames, priorInfo.streams[0].nb_frames)
assert(Math.abs(Number(result.format.duration) - Number(priorInfo.format.duration)) < 0.05)

const receipt = {
  status: 'review_only_unbound',
  authorizedBaseHead: '981ffe94dd83e92a4a1c1b7a773a270c06e1f53c',
  prior: { path: path.relative(root, prior), sha256: expectedPrior },
  cleanSource: { path: path.relative(root, clean), sha256: expectedClean, retainedProjectId: 'c3cc7090dde04b9483d9f4d4de6b852b' },
  field: { path: path.relative(root, field), sha256: sha(field) },
  backdrop: { path: path.relative(root, backdrop), sha256: sha(backdrop) },
  candidate: { path: path.relative(root, output), sha256: sha(output), durationSeconds: Number(result.format.duration), videoFrames: Number(result.streams[0].nb_frames) },
  protectedWindow: { sourceStart: closing.source_start, sourceEnd: closing.source_end, sequenceStart: closing.sequence_start, sequenceEnd: closing.sequence_end, panelRect: [1048, 326, 768, 432] },
  mediaStreams: ['video', 'prior audio copy', 'prior subtitle copy'],
  clipboardProgression: 'Prior candidate is retained unchanged outside the closing presenter window.',
  binding: 'none',
}
writeFileSync(path.join(here, 'candidate-receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt, null, 2))
