#!/usr/bin/env node
// Review-only timed clipboard progression. No learner binding is changed here.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..')
const prior = path.join(here, '../l07-08-closing-source-composition/L07-opening-and-closing-candidate.mp4')
const priorSha256 = '8c3cbcddd420977f2664931e73878e2b1e939a6b7ee0c961ff2c1b42c6eb9446'
const output = path.join(here, 'L07-clipboard-progression-candidate.mp4')
const frames = [0, 1, 2, 3].map(i => path.join(here, `clipboard-state-${i}.png`))
frames.push(path.join(here, 'studio-field-checked.png'))
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
assert.equal(sha(prior), priorSha256, 'L07-08 source candidate drift')

const timeline = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/l05-l08-continuous-narration/l07-validation-receipt.json'), 'utf8'))
const words = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/l05-l08-continuous-narration/L07/timing-receipt.json'), 'utf8')).word_timestamps
const sceneStart = timeline.guided_work_window.end
const draftDone = timeline.sentence_placements.find(row => row.text === 'Save revision seven as a draft.').sequence_end
const narrationOffset = timeline.segment_placements.find(row => row.scene_id === 'L07-08').sequence_start - 179.028
const teammateDone = words.find(row => row.word === 'teammate' && row.start > 180).end + narrationOffset
const stopSpoken = words.find(row => row.word === 'stop.' && row.start > 180).start + narrationOffset
const closing = timeline.presenter_source.placements[1]
assert.equal(sceneStart, 233.515)
assert(Math.abs(draftDone - 235.931) < 0.001)
assert(Math.abs(teammateDone - 239.152) < 0.001)
assert(Math.abs(stopSpoken - 241.414) < 0.001)
assert(Math.abs(closing.sequence_start - 242.222438) < 0.000001)
assert(Math.abs(closing.sequence_end - 248.332438) < 0.000001)

const probe = file => {
  const run = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,nb_frames', '-of', 'json', file], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(run.stdout)
}
const priorInfo = probe(prior)
assert.deepEqual(priorInfo.streams.map(s => s.codec_type), ['video', 'audio', 'subtitle'])
assert.deepEqual([priorInfo.streams[0].width, priorInfo.streams[0].height, priorInfo.streams[0].r_frame_rate], [1920, 1080, '25/1'])
assert.equal(Number(priorInfo.format.duration), 251.332)
for (const file of frames) {
  const image = probe(file).streams[0]
  assert.deepEqual([image.width, image.height], [1920, 1080], `${file} geometry drift`)
}

const timing = [sceneStart, draftDone, teammateDone, stopSpoken, closing.sequence_start]
const filter = ['[0:v]split=2[base][presenter-source]', '[presenter-source]crop=788:452:1038:316[presenter]']
for (let i = 0; i < frames.length; i++) filter.push(`[${i + 1}:v]format=yuv420p[plate${i}]`)
let video = 'base'
for (let i = 0; i < 4; i++) {
  const next = `step${i}`
  filter.push(`[${video}][plate${i}]overlay=0:0:enable='gte(t,${timing[i]})*lt(t,${timing[i + 1]})':shortest=1[${next}]`)
  video = next
}
filter.push(`[${video}][plate4]overlay=0:0:enable='gte(t,${closing.sequence_start})':shortest=1[checked-field]`)
filter.push(`[checked-field][presenter]overlay=1038:316:enable='gte(t,${closing.sequence_start})*lt(t,${closing.sequence_end})':shortest=1,format=yuv420p[v]`)

const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', prior]
for (const file of frames) args.push('-loop', '1', '-framerate', '25', '-i', file)
args.push('-filter_complex', filter.join(';'), '-map', '[v]', '-map', '0:a:0', '-map', '0:s:0',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', '25', '-c:a', 'copy', '-c:s', 'copy',
  '-movflags', '+faststart', output)
const run = spawnSync('ffmpeg', args, { stdio: 'inherit' })
assert.equal(run.status, 0, `ffmpeg failed: ${run.status}`)
const result = probe(output)
assert.deepEqual(result.streams.map(s => s.codec_type), ['video', 'audio', 'subtitle'])
assert.equal(result.streams[0].nb_frames, priorInfo.streams[0].nb_frames)
assert(Math.abs(Number(result.format.duration) - Number(priorInfo.format.duration)) < 0.05)

const receipt = {
  status: 'review_only_unbound',
  prior: path.relative(root, prior), priorSha256,
  candidate: path.relative(root, output), candidateSha256: sha(output),
  sourcePlate: { path: path.relative(root, path.join(here, 'clipboard-teaching-plate-v4.png')), sha256: sha(path.join(here, 'clipboard-teaching-plate-v4.png')) },
  statePlates: frames.map(file => ({ path: path.relative(root, file), sha256: sha(file) })),
  durationSeconds: Number(result.format.duration), videoFrames: Number(result.streams[0].nb_frames),
  states: [
    { at: sceneStart, label: 'PRD / Pod / Failure route', checked: [] },
    { at: draftDone, label: 'PRD drafted', checked: [1] },
    { at: teammateDone, label: 'Pod assigned', checked: [1, 2] },
    { at: stopSpoken, label: 'Failure route named', checked: [1, 2, 3] },
    { at: closing.sequence_start, label: 'full Operating File field with all three rows checked', checked: [1, 2, 3] },
  ],
  protectedPresenter: { start: closing.sequence_start, end: closing.sequence_end, sourceRect: [1038, 316, 788, 452], outputRect: [1038, 316, 788, 452] },
  mediaStreams: ['video', 'source audio copy', 'source subtitle copy'],
  knownSeparateBlocker: 'The native presenter source contains burned-in captions. This clipboard candidate does not modify them.',
}
writeFileSync(path.join(here, 'candidate-receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt, null, 2))
