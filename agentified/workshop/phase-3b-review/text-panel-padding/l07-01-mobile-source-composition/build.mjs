#!/usr/bin/env node
// Review-only L07-01 source composition. No learner binding is changed here.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..')
const source = path.join(root, 'public/agentified/lessons/l07/illustrated-42782f17/agentified-l07-illustrated-composite.mp4')
const unified = process.argv.includes('--unified')
const art = path.join(here, unified ? 'unified-studio-field.png' : 'teaching-field.png')
const preview = process.argv.includes('--preview')
const output = path.join(here, preview
  ? (unified ? 'L07-unified-opening-preview.mp4' : 'L07-mobile-opening-preview.mp4')
  : (unified ? 'L07-unified-source-candidate.mp4' : 'L07-mobile-source-candidate.mp4'))
const sourceHash = '42782f17a49cc35e3e01be1f29f7de18d13ee5406004a84da7e9602aa06f2f55'
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
assert.equal(sha(source), sourceHash, 'mapped L07 source drift')
const probe = file => {
  const run = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', file], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(run.stdout)
}
const sourceInfo = probe(source)
const artInfo = probe(art)
assert.equal(Number(sourceInfo.format.duration), 251.332)
assert.deepEqual(sourceInfo.streams.map(stream => stream.codec_type), ['video', 'audio', 'subtitle'])
assert.equal(sourceInfo.streams[0].width, 1920)
assert.equal(sourceInfo.streams[0].height, 1080)
assert.equal(sourceInfo.streams[0].r_frame_rate, '25/1')
assert(Math.abs(artInfo.streams[0].width / artInfo.streams[0].height - 16 / 9) < 0.002)

// The 788x452 crop and 1038,316 placement are the source's protected contract.
// The surrounding art alone changes for the first 9.37 seconds. At frame zero
// the crop remains the native blank studio rectangle; later it is native footage.
const artFilter = unified
  ? '[1:v]scale=1920:1080:flags=lanczos,format=yuv420p[art];'
  : '[1:v]scale=1920:1080:flags=lanczos,drawbox=x=985:y=0:w=935:h=1080:color=0x0b2838:t=fill,format=yuv420p[art];'
const filter = '[0:v]split=2[base][presenter-source];' +
  '[presenter-source]crop=788:452:1038:316[presenter];' +
  artFilter +
  "[base][art]overlay=0:0:enable='lt(t,9.37)':shortest=1[teaching-field];" +
  "[teaching-field][presenter]overlay=1038:316:enable='lt(t,9.37)':shortest=1,format=yuv420p[v]"
const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', source,
  '-loop', '1', '-framerate', '25', '-i', art, '-filter_complex', filter,
  '-map', '[v]', '-map', '0:a:0', '-map', '0:s:0', '-c:v', 'libx264',
  '-preset', 'veryfast', '-crf', '18', '-r', '25', '-c:a', 'copy', '-c:s', 'copy',
  '-movflags', '+faststart', ...(preview ? ['-t', '11'] : []), output]
const run = spawnSync('ffmpeg', args, { stdio: 'inherit' })
assert.equal(run.status, 0, `ffmpeg failed: ${run.status}`)
const outputInfo = probe(output)
assert.deepEqual(outputInfo.streams.map(stream => stream.codec_type), ['video', 'audio', 'subtitle'])
assert.equal(outputInfo.streams[0].width, 1920)
assert.equal(outputInfo.streams[0].height, 1080)
assert.equal(outputInfo.streams[0].r_frame_rate, '25/1')
if (!preview) assert(Math.abs(Number(outputInfo.format.duration) - Number(sourceInfo.format.duration)) < 0.05)
const receipt = {
  status: 'review_only_unbound',
  source: path.relative(root, source), sourceSha256: sourceHash,
  art: path.relative(root, art), artSha256: sha(art),
  candidate: path.relative(root, output), candidateSha256: sha(output),
  durationSeconds: Number(outputInfo.format.duration),
  protectedPresenter: { start: 0, end: 9.37, sourceRect: [1038, 316, 788, 452], outputRect: [1038, 316, 788, 452] },
  studioField: unified
    ? { kind: 'continuous navy field', presenterSafeRect: [1038, 316, 788, 452] }
    : { rect: [985, 0, 935, 1080], rgb: [11, 40, 56], sourceFrame: 0 },
  mediaStreams: ['video', 'source audio copy', 'source subtitle copy'],
  note: unified
    ? 'One continuous desktop/mobile teaching field surrounds the protected presenter interval. The repository learner binding remains unchanged.'
    : 'Only the mobile teaching field beneath the protected presenter interval is recomposed. The repository learner binding remains unchanged.'
}
writeFileSync(path.join(here, preview
  ? (unified ? 'unified-preview-receipt.json' : 'preview-receipt.json')
  : (unified ? 'unified-candidate-receipt.json' : 'candidate-receipt.json')), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt, null, 2))
