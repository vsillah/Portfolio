import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(path.join(root, 'lib/agentified-qualified-bindings.json'), 'utf8'))
const receipt = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/phase-4-integration/media-build-receipt.json'), 'utf8'))
const eligible = ['L01', ...Array.from({ length: 12 }, (_, index) => `L${String(index + 5).padStart(2, '0')}`)]
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const audioHash = (file) => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-c', 'copy', '-f', 'streamhash', '-hash', 'sha256', '-'], { encoding: 'utf8' }).trim().split('=').at(-1)

assert.equal(manifest.schemaVersion, 2)
assert.equal(manifest.qualifiedTree, '9f70b89002603b3100c42d062b064b9386c2f399')
assert.equal(manifest.captionFreeSourceHead, '92bcc37c1eeb19f275b97fea8e647e9ae7376145')
assert.deepEqual(Object.keys(manifest.bindings), eligible)
for (const excluded of ['L02', 'L03', 'L04']) assert.equal(manifest.bindings[excluded], undefined)

for (const lessonId of eligible) {
  const binding = manifest.bindings[lessonId]
  const built = receipt.lessons[lessonId]
  assert.ok(binding && built, `${lessonId}: missing binding or receipt`)
  const sourceAudioHash = audioHash(path.join(root, built.desktop.sourcePath))
  for (const [variant, videoPath, expected] of [
    ['desktop', binding.video, binding.compositeSha256],
    ['mobile', binding.portraitVideo, binding.portraitSha256],
  ]) {
    const absolute = path.join(root, 'public', videoPath)
    assert.equal(sha(absolute), expected, `${lessonId} ${variant}: video hash drift`)
    assert.equal(built[variant].sha256, expected, `${lessonId} ${variant}: receipt drift`)
    const video = built[variant].probe.streams.find((stream) => stream.codec_type === 'video')
    const audio = built[variant].probe.streams.find((stream) => stream.codec_type === 'audio')
    assert.equal(video?.codec_name, 'h264', `${lessonId} ${variant}: expected H.264`)
    assert.ok(audio, `${lessonId} ${variant}: missing audio`)
    assert.equal(audioHash(absolute), sourceAudioHash, `${lessonId} ${variant}: audio identity drift`)
    assert.ok(Math.abs(Number(built[variant].probe.format.duration) - binding.durationSeconds) < 0.06, `${lessonId} ${variant}: duration drift`)
  }
  assert.equal(sha(path.join(root, 'public', binding.captions)), binding.captionsSha256, `${lessonId}: caption hash drift`)
}

assert.equal(manifest.bindings.L07.sourceVideo, '/agentified/lessons/l07/continuous-869a0ff4/agentified-l07-continuous-narration-composite.mp4')
assert.equal(receipt.lessons.L07.desktop.sourceSha256, 'b9016102fc8272f1c51f1fcee9b5f0aafe5c8928988beaf970645e337446a5b4')
assert.equal(receipt.lessons.L08.desktop.sourceSha256, 'f709e881f3cf4816c05ac287a3181d50621c1e16df14212c5357890f08baedb0')
assert.equal(receipt.lessons.L13.desktop.sourceSha256, '878d262919c6e7f93997c1289aa9f22ff7dee9c8893b329b4920e8ef6d10ec02')
assert.equal(receipt.lessons.L16.desktop.sourceSha256, '2fcae49deaf43251b8d4f05001401e8f13be1566ff31fbf9a3e069e58108dfc5')
assert.equal(manifest.bindings.L09.captionsSha256, 'd4cf4744cf5daa3f2ba78654516ec2f2765841c02d4d4b1d13e4c6aa5456d8ce')
assert.equal(sha(path.join(root, 'agentified/workshop/phase-3b-review/text-panel-padding/l07-08-caption-free-presenter/Agentified_L07_f35b6f52-caption-free-source.mp4')), '795252b7c7a13a6905f5b828b458d39a55bdfc02e27e69d7a72a50bb847f9c8b')
assert.equal(sha(path.join(root, 'agentified/workshop/phase-3b-review/text-panel-padding/l08-caption-free-presenter/Agentified_L08_297bf76b-caption-free-source.mp4')), '72dce8821a60578d5d683b1815b24423a919a7cff96c8d9813a72dd6dae8bb76')
assert.equal(sha(path.join(root, 'agentified/workshop/phase-3b-review/text-panel-padding/l16-caption-free-presenter/Agentified_L16-caption-free-source.mp4')), '350c259baa900d6eef9fc35a4f96ef5cb25ea0001c23d69f00fff9f82f356f87')

console.log(`PASS: ${eligible.length} qualified Agentified lesson bindings, desktop/mobile hashes, audio, durations, captions, and fail-closed L02-L04 scope`)
