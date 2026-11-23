#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..')
const evidence = path.join(here, 'route-evidence')
const prior = path.join(root, 'public/agentified/lessons/l16/illustrated-4283c8d8/agentified-l16-illustrated-composite.mp4')
const original = path.join(root, 'agentified/workshop/l13-l16-native-source/L16/agentified-l16-heygen-presenter-source.mp4')
const clean = path.join(here, 'Agentified_L16-caption-free-source.mp4')
const candidate = path.join(here, 'L16-caption-free-presenter-candidate.mp4')
const binding = JSON.parse(readFileSync(path.join(here, 'candidate-receipt.json'), 'utf8'))
const route = JSON.parse(readFileSync(path.join(evidence, 'route-capture.json'), 'utf8'))
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const run = (bin, args) => {
  const result = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  assert.equal(result.status, 0, `${bin} ${args.join(' ')}: ${result.stderr}`)
  return `${result.stdout}${result.stderr}`
}
const probe = file => JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,nb_frames', '-of', 'json', file]))
const hashStream = (file, spec) => run('ffmpeg', ['-v', 'error', '-i', file, '-map', spec, '-c', 'copy', '-f', 'md5', '-']).trim()

assert.equal(binding.status, 'review_only_unbound')
assert.equal(binding.binding, 'none')
assert.equal(sha(clean), binding.retainedCaptionFreeSource.sha256)
assert.equal(sha(candidate), binding.candidate.sha256)
assert.equal(sha(prior), binding.prior.sha256)
assert.equal(sha(original), binding.originalPresenter.sha256)
const cleanInfo = probe(clean)
const candidateInfo = probe(candidate)
assert.deepEqual(cleanInfo.streams.map(s => s.codec_type), ['video', 'audio'])
assert.deepEqual(candidateInfo.streams.map(s => s.codec_type), ['video', 'audio', 'subtitle'])
assert.equal(Number(cleanInfo.streams[0].nb_frames), 634)
assert.equal(Number(candidateInfo.streams[0].nb_frames), 6667)
assert.equal(Number(cleanInfo.format.duration), 25.367)
assert.equal(Number(candidateInfo.format.duration), 267.309)
for (const file of [clean, candidate]) run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'])
const audio = [hashStream(prior, '0:a:0'), hashStream(candidate, '0:a:0')]
const subtitle = [hashStream(prior, '0:s:0'), hashStream(candidate, '0:s:0')]
assert.equal(audio[0], audio[1], 'audio bitstream changed')
assert.equal(subtitle[0], subtitle[1], 'embedded subtitle bitstream changed')

const topSsim = run('ffmpeg', ['-nostats', '-v', 'info', '-i', original, '-i', clean, '-filter_complex', '[0:v]crop=1920:750:0:0[a];[1:v]crop=1920:750:0:0[b];[a][b]ssim', '-an', '-f', 'null', '-']).match(/SSIM Y:.*All:([0-9.]+)/)?.[1]
const outsideSsim = run('ffmpeg', ['-nostats', '-v', 'info', '-i', prior, '-i', candidate, '-filter_complex', '[0:v]crop=1000:1080:0:0[a];[1:v]crop=1000:1080:0:0[b];[a][b]ssim', '-an', '-f', 'null', '-']).match(/SSIM Y:.*All:([0-9.]+)/)?.[1]
assert(Number(topSsim) > 0.995, `source upper-frame mismatch: ${topSsim}`)
assert(Number(outsideSsim) > 0.998, `outside-panel mismatch: ${outsideSsim}`)
const audioComparison = run('ffmpeg', ['-nostats', '-v', 'info', '-i', original, '-i', clean, '-filter_complex', '[0:a]aresample=48000[a];[1:a]aresample=48000[b];[a][b]apsnr', '-vn', '-f', 'null', '-'])
const audioPsnr = [...audioComparison.matchAll(/PSNR ch([01]): ([0-9.]+) dB/g)].map(match => Number(match[2]))
assert.equal(audioPsnr.length, 2)
assert(audioPsnr.every(value => value > 100), `clean export audio mismatch: ${audioPsnr}`)

assert.equal(route.hash, sha(candidate))
assert.deepEqual(route.results.map(item => item.viewport), ['1280x844', '390x844'])
for (const item of route.results) {
  assert.equal(item.errors.length, 0)
  assert(item.source.includes(`/review-${route.hash.slice(0, 8)}/`))
  assert.equal(item.checks.filter(check => check.check === 'paused seek').length, 13)
  assert.equal(item.checks.filter(check => check.check === 'captions off').length, 2)
  assert.equal(item.checks.filter(check => check.check === 'caption size').length, 6)
  assert(item.checks.some(check => check.check === 'completion only after video ended' && check.ended && check.endVisible))
  assert(item.checks.some(check => check.check === 'replay' && check.time < 5 && !check.endVisible))
  assert(item.checks.every(check => check.overflowX !== true))
}

const artifacts = readdirSync(evidence).filter(name => name.endsWith('.mp4') || name.endsWith('.png') || name === 'route-capture.json').sort().map(name => {
  const file = path.join(evidence, name)
  if (name.endsWith('.mp4')) run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'])
  return { path: `route-evidence/${name}`, sha256: sha(file), bytes: statSync(file).size }
})
const receipt = {
  status: 'validated_review_only_unbound',
  sourceJobId: binding.retainedCaptionFreeSource.jobId,
  sourceSha256: sha(clean), candidateSha256: sha(candidate), priorSha256: sha(prior),
  download: 'Existing completed HeyGen job, 1080p, burned-in captions off; no fee presented, no generation invoked',
  cleanSource: { durationSeconds: 25.367, videoFrames: 634, dimensions: [1920, 1080], fps: 25, fullDecode: 'pass', visualCaptionCheck: 'no burned captions at opening and closing sample frames', upperFrameSsim: Number(topSsim), audioPsnrDb: audioPsnr },
  candidate: { durationSeconds: 267.309, videoFrames: 6667, dimensions: [1920, 1080], fps: 25, fullDecode: 'pass', audioBitstreamMd5: audio[0], subtitleBitstreamMd5: subtitle[0], audioAndEmbeddedSubtitleIdenticalToPrior: true, outsidePanelSsim: Number(outsideSsim) },
  presenterIntervals: binding.timeline.presenterWindows,
  route: { temporaryWorktree: '/Users/vambahsillah/.codex/worktrees/l08-clean-presenter-route/Portfolio', playerHead: '7bb6267c9fb98172679e161aafa208dfc7a276c3', url: 'http://127.0.0.1:3152/agentified/learningplan?lesson=L16&rev=7bb6267c9-2fcae49d', temporaryBindingOnly: true, includesL16EndedBehaviorFromDraftPr1294: true, results: route.results.map(item => ({ viewport: item.viewport, checks: item.checks.length, pageErrors: item.errors.length })) },
  visualInspection: 'Opening and closing candidate frames plus desktop/mobile caption and settled completion stills inspected; no observed duplicate caption, crop, overlap, or layout drift',
  artifacts,
  limitations: ['Browser route MP4s are visual-only; separate opening and closing clips include copied audio.', 'No physical-device or authenticated-user session was exercised.', 'Integrated in-app browser was absent; exact route was loaded and retained in Chrome.'],
  binding: 'none',
}
writeFileSync(path.join(here, 'validation-receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify({ status: receipt.status, candidateSha256: receipt.candidateSha256, route: receipt.route.results, artifacts: artifacts.length, upperFrameSsim: receipt.cleanSource.upperFrameSsim, outsidePanelSsim: receipt.candidate.outsidePanelSsim }, null, 2))
