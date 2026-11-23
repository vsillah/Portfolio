#!/usr/bin/env node
// Rebuild only the existing L16 presenter panels; leave learner bindings intact.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..')
const prior = path.join(root, 'public/agentified/lessons/l16/illustrated-4283c8d8/agentified-l16-illustrated-composite.mp4')
const priorNative = path.join(root, 'agentified/workshop/l13-l16-native-source/L16/agentified-l16-heygen-presenter-source.mp4')
const clean = path.join(here, 'Agentified_L16-caption-free-source.mp4')
const backdrop = path.join(here, 'studio-backdrop.png')
const timelinePath = path.join(root, 'agentified/workshop/l13-l16-native-composite/l16-composite-timeline.json')
const vtt = path.join(root, 'public/agentified/lessons/l16/approved-e890f6a9/agentified-l16-native-captions.vtt')
const output = path.join(here, 'L16-caption-free-presenter-candidate.mp4')
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')

assert.equal(sha(prior), '4283c8d8fb7eca85b9b0493aa07ac22901f0155d0742ebc61c0a0744698846fc', 'bound illustrated video drift')
assert.equal(sha(priorNative), 'f850021820caf661b2a1397edc3db387f356d566c9f3a497a729cd300f5e0e51', 'original presenter drift')
assert.equal(sha(clean), '350c259baa900d6eef9fc35a4f96ef5cb25ea0001c23d69f00fff9f82f356f87', 'caption-free export drift')
assert.equal(sha(backdrop), '850c7f829f6c81788d6a88a36038e998ca1fab505651b51ff942b23ea04bc010', 'studio backdrop drift')
assert.equal(sha(vtt), '18dd5bebac74af34048e62b8f6171daefea89ddfc86618a82cc2b74472936060', 'learner caption drift')
const timeline = JSON.parse(readFileSync(timelinePath, 'utf8'))
assert.equal(timeline.lesson_id, 'L16')
assert.deepEqual(timeline.presenter_windows.map(w => [w.source_in, w.source_out, w.sequence_start, w.sequence_end]), [
  [0, 16.26, 0, 16.26],
  [16.32, 25.367, 258.262, 267.309],
])
assert.deepEqual(timeline.presenter_transform, {
  x: 1048, y: 326, width: 768, height: 432,
  fit: 'contain', border: 'solid_gold', background: 'provider_free_textured_studio',
})

const probe = file => {
  const run = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,nb_frames,sample_rate,channels', '-of', 'json', file], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(run.stdout)
}
const priorInfo = probe(prior)
const cleanInfo = probe(clean)
assert.deepEqual(priorInfo.streams.map(s => s.codec_type), ['video', 'audio', 'subtitle'])
assert.deepEqual([priorInfo.streams[0].width, priorInfo.streams[0].height, priorInfo.streams[0].r_frame_rate, Number(priorInfo.streams[0].nb_frames)], [1920, 1080, '25/1', 6667])
assert.equal(Number(priorInfo.format.duration), 267.309)
assert.deepEqual(cleanInfo.streams.map(s => s.codec_type), ['video', 'audio'])
assert.deepEqual([cleanInfo.streams[0].width, cleanInfo.streams[0].height, cleanInfo.streams[0].r_frame_rate, Number(cleanInfo.streams[0].nb_frames)], [1920, 1080, '25/1', 634])
assert.equal(Number(cleanInfo.format.duration), 25.367)

// Exact panel geometry and chroma treatment from the approved compositor.
const inset = 'colorkey=0x00e868:0.28:0.08,despill=type=green:mix=0.05:expand=0.02,scale=748:412:force_original_aspect_ratio=decrease,pad=748:412:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba'
const [opening, closing] = timeline.presenter_windows
const closeDuration = closing.source_out - closing.source_in
const graph = [
  `color=c=#092433:s=768x432:r=25:d=${opening.source_out},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame1]`,
  `[2:v]trim=duration=${opening.source_out},setpts=PTS-STARTPTS,scale=748:412[bg1]`,
  '[frame1][bg1]overlay=10:10:eof_action=pass:repeatlast=1[studio1]',
  `[1:v]trim=${opening.source_in}:${opening.source_out},setpts=PTS-STARTPTS,${inset}[presenter1]`,
  `[studio1][presenter1]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.34:alpha=1,fade=t=out:st=${opening.source_out - 0.4}:d=0.4:alpha=1[panel1]`,
  `color=c=#092433:s=768x432:r=25:d=${closeDuration},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=#d8ad43:t=5[frame2]`,
  `[2:v]trim=duration=${closeDuration},setpts=PTS-STARTPTS,scale=748:412[bg2]`,
  '[frame2][bg2]overlay=10:10:eof_action=pass:repeatlast=1[studio2]',
  `[1:v]trim=${closing.source_in}:${closing.source_out},setpts=PTS-STARTPTS,${inset}[presenter2]`,
  `[studio2][presenter2]overlay=10:10:eof_action=pass:repeatlast=0,fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=${closeDuration - 0.35}:d=0.35:alpha=1,setpts=PTS+${closing.sequence_start}/TB[panel2]`,
  `[0:v][panel1]overlay=1048:326:enable='lt(t,${opening.sequence_end})':eof_action=pass:repeatlast=0[first]`,
  `[first][panel2]overlay=1048:326:enable='gte(t,${closing.sequence_start})*lt(t,${closing.sequence_end})':eof_action=pass:repeatlast=0,format=yuv420p[v]`,
].join(';')
const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', prior, '-i', clean,
  '-loop', '1', '-framerate', '25', '-i', backdrop,
  '-filter_complex', graph, '-map', '[v]', '-map', '0:a:0', '-map', '0:s:0',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', '25',
  '-c:a', 'copy', '-c:s', 'copy', '-movflags', '+faststart', output]
const run = spawnSync('ffmpeg', args, { stdio: 'inherit' })
assert.equal(run.status, 0, `ffmpeg failed: ${run.status}`)
const outputInfo = probe(output)
assert.deepEqual(outputInfo.streams.map(s => s.codec_type), ['video', 'audio', 'subtitle'])
assert.deepEqual([outputInfo.streams[0].width, outputInfo.streams[0].height, outputInfo.streams[0].r_frame_rate, Number(outputInfo.streams[0].nb_frames)], [1920, 1080, '25/1', 6667])
assert.equal(Number(outputInfo.format.duration), Number(priorInfo.format.duration))
const receipt = {
  status: 'review_only_unbound',
  baseCommit: '02e06ec04eb70cb3c94816b018f41e5a1e951f03',
  prior: { path: path.relative(root, prior), sha256: sha(prior) },
  originalPresenter: { path: path.relative(root, priorNative), sha256: sha(priorNative) },
  retainedCaptionFreeSource: { path: path.relative(root, clean), sha256: sha(clean), jobId: '25b6988235318f42abadd8b3b76c1a9c', downloadOption: 'Video, 1080p, burned-in captions off' },
  backdrop: { path: path.relative(root, backdrop), sha256: sha(backdrop) },
  timeline: { path: path.relative(root, timelinePath), sha256: sha(timelinePath), presenterWindows: timeline.presenter_windows },
  vtt: { path: path.relative(root, vtt), sha256: sha(vtt) },
  candidate: { path: path.relative(root, output), sha256: sha(output), durationSeconds: Number(outputInfo.format.duration), frames: Number(outputInfo.streams[0].nb_frames) },
  panelRect: [1048, 326, 768, 432],
  mediaStreams: ['video', 'prior audio copy', 'prior subtitle copy'],
  binding: 'none',
}
writeFileSync(path.join(here, 'candidate-receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt, null, 2))
