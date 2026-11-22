#!/usr/bin/env node
// Rebuild only the two L08 native presenter panels. Learner bindings remain unchanged.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..')
const prior = path.join(root, 'public/agentified/lessons/l08/illustrated-5ea78c36/agentified-l08-illustrated-composite.mp4')
const priorNative = path.join(root, 'agentified/workshop/l05-l08-native-source/L08/agentified-l08-heygen-native-source.mp4')
const clean = path.join(here, 'Agentified_L08_297bf76b-caption-free-source.mp4')
const backdrop = path.join(here, 'studio-backdrop.png')
const timingPath = path.join(root, 'agentified/workshop/l05-l08-continuous-narration/l08-validation-receipt.json')
const vtt = path.join(root, 'public/agentified/lessons/l08/continuous-3c5b399f/agentified-l08-continuous-narration-captions.vtt')
const output = path.join(here, 'L08-caption-free-presenter-candidate.mp4')
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')

assert.equal(sha(prior), '5ea78c3647a901be84eddc1647185fcbea7178d79a5588befb467f92d20c93bd', 'illustrated candidate drift')
assert.equal(sha(priorNative), 'efc86671550629e2c3f8ebcd1d4f1faebddde80ec27157eab0e00ee0a023d2c8', 'original presenter drift')
assert.equal(sha(clean), '72dce8821a60578d5d683b1815b24423a919a7cff96c8d9813a72dd6dae8bb76', 'retained caption-free source drift')
assert.equal(sha(backdrop), '850c7f829f6c81788d6a88a36038e998ca1fab505651b51ff942b23ea04bc010', 'studio background drift')
const timing = JSON.parse(readFileSync(timingPath, 'utf8'))
assert.equal(timing.lesson_id, 'L08')
assert.equal(timing.presenter_source.source_split_seconds, 13.525)
assert.equal(timing.presenter_source.placements.length, 2)
const [opening, closing] = timing.presenter_source.placements
assert.deepEqual([opening.source_start, opening.source_end, opening.sequence_start, opening.sequence_end], [0, 13.525, 0, 13.525])
assert(Math.abs(closing.source_start - 13.525) < 0.000001)
assert(Math.abs(closing.source_end - 20.904) < 0.000001)
assert(Math.abs(closing.sequence_start - 247.291719) < 0.000001)
assert(Math.abs(closing.sequence_end - 254.670719) < 0.000001)

const probe = file => {
  const run = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,nb_frames,sample_rate,channels', '-of', 'json', file], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(run.stdout)
}
const priorInfo = probe(prior)
const cleanInfo = probe(clean)
assert.deepEqual(priorInfo.streams.map(s => s.codec_type), ['video', 'audio', 'subtitle'])
assert.deepEqual([priorInfo.streams[0].width, priorInfo.streams[0].height, priorInfo.streams[0].r_frame_rate, Number(priorInfo.streams[0].nb_frames)], [1920, 1080, '25/1', 6442])
assert.deepEqual([cleanInfo.streams[0].width, cleanInfo.streams[0].height, cleanInfo.streams[0].r_frame_rate, Number(cleanInfo.streams[0].nb_frames)], [1920, 1080, '25/1', 522])
assert.equal(Number(cleanInfo.format.duration), 20.908)

// Match the approved compositor exactly: same 748x412 native panel, recorded
// presenter pixels, studio backdrop, thin outline, chroma treatment and fades.
const inset = 'colorkey=0x00e868:0.28:0.08,despill=type=green:mix=0.05:expand=0.02,scale=748:412:force_original_aspect_ratio=decrease,pad=748:412:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba'
const closeDuration = closing.source_end - closing.source_start
const graph = [
  `color=c=#092433:s=768x432:r=25:d=${opening.source_end},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame1]`,
  `[2:v]trim=duration=${opening.source_end},setpts=PTS-STARTPTS,scale=748:412[bg1]`,
  '[frame1][bg1]overlay=10:10:eof_action=pass:repeatlast=1[studio1]',
  `[1:v]trim=0:${opening.source_end},setpts=PTS-STARTPTS,${inset}[presenter1]`,
  `[studio1][presenter1]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=${opening.source_end - 0.5}:d=0.5:alpha=1[panel1]`,
  `color=c=#092433:s=768x432:r=25:d=${closeDuration},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame2]`,
  `[2:v]trim=duration=${closeDuration},setpts=PTS-STARTPTS,scale=748:412[bg2]`,
  '[frame2][bg2]overlay=10:10:eof_action=pass:repeatlast=1[studio2]',
  `[1:v]trim=${closing.source_start}:${closing.source_end},setpts=PTS-STARTPTS,${inset}[presenter2]`,
  `[studio2][presenter2]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=${closeDuration - 0.3}:d=0.3:alpha=1,setpts=PTS+${closing.sequence_start}/TB[panel2]`,
  "[0:v][panel1]overlay=1048:326:enable='lt(t,13.525)':eof_action=pass:repeatlast=0[first]",
  `[first][panel2]overlay=1048:326:enable='gte(t,${closing.sequence_start})*lt(t,${closing.sequence_end})':eof_action=pass:repeatlast=0,format=yuv420p[v]`,
].join(';')
const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', prior, '-i', clean,
  '-loop', '1', '-framerate', '25', '-i', backdrop,
  '-filter_complex', graph, '-map', '[v]', '-map', '0:a:0', '-map', '0:s:0',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', '25', '-c:a', 'copy', '-c:s', 'copy', '-movflags', '+faststart', output]
const run = spawnSync('ffmpeg', args, { stdio: 'inherit' })
assert.equal(run.status, 0, `ffmpeg failed: ${run.status}`)
const outputInfo = probe(output)
assert.deepEqual(outputInfo.streams.map(s => s.codec_type), ['video', 'audio', 'subtitle'])
assert.deepEqual([outputInfo.streams[0].width, outputInfo.streams[0].height, outputInfo.streams[0].r_frame_rate, Number(outputInfo.streams[0].nb_frames)], [1920, 1080, '25/1', 6442])
assert(Math.abs(Number(outputInfo.format.duration) - Number(priorInfo.format.duration)) < 0.05)
const receipt = {
  status: 'review_only_unbound',
  baseCommit: 'b11360d1dc0b63a1d9c7ea126aa50dea196fa649',
  stackHeads: { pr1292: '3ca22b88162de93182d07eee89fbc062feea129f', pr1293: '8948462d35c7b3b28d315341046b45bafae25805', pr1295: '7bb6267c9fb98172679e161aafa208dfc7a276c3' },
  prior: { path: path.relative(root, prior), sha256: sha(prior) },
  originalPresenter: { path: path.relative(root, priorNative), sha256: sha(priorNative) },
  retainedCaptionFreeSource: { path: path.relative(root, clean), sha256: sha(clean), jobId: '76d5248d34be0265512f59385e163415' },
  backdrop: { path: path.relative(root, backdrop), sha256: sha(backdrop) },
  timing: { path: path.relative(root, timingPath), sha256: sha(timingPath), opening, closing },
  vtt: { path: path.relative(root, vtt), sha256: sha(vtt) },
  candidate: { path: path.relative(root, output), sha256: sha(output), durationSeconds: Number(outputInfo.format.duration), frames: Number(outputInfo.streams[0].nb_frames) },
  panelRect: [1048, 326, 768, 432],
  mediaStreams: ['video', 'prior audio copy', 'prior subtitle copy'],
  binding: 'none',
}
writeFileSync(path.join(here, 'candidate-receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt, null, 2))
