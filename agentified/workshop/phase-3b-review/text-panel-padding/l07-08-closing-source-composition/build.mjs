#!/usr/bin/env node
// Review-only L07-08 source composition. No learner binding is changed here.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..')
const prior = path.join(here, '../l07-01-mobile-source-composition/L07-unified-source-candidate.mp4')
const field = path.join(here, 'studio-field.png')
const output = path.join(here, 'L07-opening-and-closing-candidate.mp4')
const priorHash = 'c2acec2f12607d5a86b3ef764f8cde17bbba2e50d11de2e4cedb79e21e25f216'
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
assert.equal(sha(prior), priorHash, 'approved L07-01 candidate drift')

const timeline = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/l05-l08-continuous-narration/l07-validation-receipt.json'), 'utf8'))
const sceneStart = timeline.guided_work_window.end
const closing = timeline.presenter_source.placements[1]
assert.equal(sceneStart, 233.515)
assert(Math.abs(closing.sequence_start - 242.222438) < 0.000001)
assert(Math.abs(closing.sequence_end - 248.332438) < 0.000001)
const probe = file => {
  const run = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,nb_frames', '-of', 'json', file], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(run.stdout)
}
const inputInfo = probe(prior)
const fieldInfo = probe(field)
assert.equal(Number(inputInfo.format.duration), 251.332)
assert.deepEqual(inputInfo.streams.map(stream => stream.codec_type), ['video', 'audio', 'subtitle'])
assert.deepEqual([inputInfo.streams[0].width, inputInfo.streams[0].height, inputInfo.streams[0].r_frame_rate], [1920, 1080, '25/1'])
assert(Math.abs(fieldInfo.streams[0].width / fieldInfo.streams[0].height - 16 / 9) < 0.002)

// The source crop already contains the native presenter, recorded background,
// thin outline and exact frame timing. The new field changes only L07-08.
const presenter = [1038, 316, 788, 452]
const filter = '[0:v]split=2[base][presenter-source];' +
  '[presenter-source]crop=788:452:1038:316[presenter];' +
  '[1:v]scale=1920:1080:flags=lanczos,format=yuv420p[art];' +
  `[base][art]overlay=0:0:enable='gte(t,${sceneStart})':shortest=1[closing-field];` +
  `[closing-field][presenter]overlay=1038:316:enable='gte(t,${closing.sequence_start})*lt(t,${closing.sequence_end})':shortest=1,format=yuv420p[v]`
const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', prior,
  '-loop', '1', '-framerate', '25', '-i', field, '-filter_complex', filter,
  '-map', '[v]', '-map', '0:a:0', '-map', '0:s:0', '-c:v', 'libx264',
  '-preset', 'veryfast', '-crf', '18', '-r', '25', '-c:a', 'copy', '-c:s', 'copy',
  '-movflags', '+faststart', output]
const run = spawnSync('ffmpeg', args, { stdio: 'inherit' })
assert.equal(run.status, 0, `ffmpeg failed: ${run.status}`)
const resultInfo = probe(output)
assert.deepEqual(resultInfo.streams.map(stream => stream.codec_type), ['video', 'audio', 'subtitle'])
assert.equal(resultInfo.streams[0].nb_frames, inputInfo.streams[0].nb_frames)
assert(Math.abs(Number(resultInfo.format.duration) - Number(inputInfo.format.duration)) < 0.05)
const receipt = {
  status: 'review_only_unbound',
  prior: path.relative(root, prior), priorSha256: priorHash,
  field: path.relative(root, field), fieldSha256: sha(field),
  candidate: path.relative(root, output), candidateSha256: sha(output),
  durationSeconds: Number(resultInfo.format.duration),
  sceneStartSeconds: sceneStart,
  protectedPresenter: { start: closing.sequence_start, end: closing.sequence_end, sourceRect: presenter, outputRect: presenter },
  mediaStreams: ['video', 'source audio copy', 'source subtitle copy'],
  note: 'L07-01 opening remains in the prior input. Only the L07-08 surrounding field changes; the native closing presenter crop is restored in place. No repository learner binding changes.'
}
writeFileSync(path.join(here, 'candidate-receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt, null, 2))
