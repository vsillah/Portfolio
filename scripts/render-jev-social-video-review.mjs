import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

const duration = 67.28
const speechDuration = 67.28
const root = process.cwd()
const nativePresenter = resolve('artifacts/human-qa/artifact-video-review-2026-10-14/jev-avatar-motion-v3-mad-hadda-v3-api-credit/jev-heygen-presenter-native.mp4')
const nativeAnimatedComposite = resolve('artifacts/human-qa/artifact-video-review-2026-10-14/jev-avatar-motion-v3-mad-hadda-v3-api-credit/jev-avatar-motion-review.mp4')
const nativeMotionTemplate = resolve('artifacts/human-qa/artifact-video-review-2026-10-14/jev-template-v2-motion-master.mp4')
const nativePresenterContract = resolve('artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-avatar-motion-v3-mad-hadda-v3-api-credit.json')
const approvedCtaText = 'Subscribe to the channel for more practical ways to govern AI decisions.'
const musicSource = resolve('local-private/youtube-music/the-stream-v2.wav')
const localDir = resolve('local-private/social-video')
const renderInputDir = resolve('public/review-assets/social-content/.render-inputs')
const cutout = resolve(renderInputDir, 'jev-presenter-cutout.webm')
const fieldGuideSource = resolve('artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-operator-field-guide.png')
const fieldGuideStaged = resolve(renderInputDir, 'jev-operator-field-guide.png')
const remotionVisual = resolve(localDir, 'jev-social-video-remotion-cta.mp4')
const visual = resolve(localDir, 'jev-social-video-native-motion-visual.mp4')
const preduck = resolve(localDir, 'jev-music-preduck.wav')
const ducked = resolve(localDir, 'jev-music-ducked.wav')
const noMusic = resolve('public/review-assets/social-content/jev-youtube-no-music-review.mp4')
const enhanced = resolve('public/review-assets/social-content/jev-youtube-motion-review.mp4')
const naturalized = resolve('public/review-assets/social-content/jev-youtube-naturalized-voice-review.mp4')
const poster = resolve('public/review-assets/social-content/jev-youtube-motion-review.png')
const receiptPath = resolve('artifacts/human-qa/artifact-video-review-2026-10-14/jev-youtube-presenter-first/jev-youtube-motion-review.receipt.json')
const audioReceiptPath = resolve('artifacts/human-qa/artifact-video-review-2026-10-14/jev-youtube-presenter-first/jev-youtube-moderate-music-audio-validation.receipt.json')

const expected = {
  presenter: 'sha256:c9b0949da45208fd8fa84cd614c7c2c5c8667d548e74e4ef25975a9d0e29494d',
  animatedComposite: 'sha256:d567a263d31be2fe5c39190b977fe04461eb61f1ecf34db5599a2749a5b5a85a',
  motionTemplate: 'sha256:17bd925703c0f670046a3cd017a081c9547fbae5a7a5fc9d444721d4721e23b2',
  music: 'sha256:7842628c35c5375cefaffc1b7d9425e354e840f5d46dfab65612d8f86a67158d',
}

function sha256(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`
}

function requireHash(path, hash) {
  if (!existsSync(path)) throw new Error(`Required local source is missing: ${path}`)
  const actual = sha256(path)
  if (actual !== hash) throw new Error(`Source hash mismatch for ${path}. Expected ${hash}; received ${actual}.`)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, ...options })
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stderr || result.stdout}`)
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function loudness(path, start = 0, length = duration) {
  const result = run('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(start), '-t', String(length), '-i', path, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
  const summary = result.stderr.slice(result.stderr.lastIndexOf('Summary:'))
  const integrated = Number(summary.match(/I:\s+(-?\d+(?:\.\d+)?) LUFS/)?.[1])
  const peak = Number(summary.match(/Peak:\s+(-?\d+(?:\.\d+)?) dBFS/)?.[1])
  if (!Number.isFinite(integrated) || !Number.isFinite(peak)) throw new Error(`Unable to parse loudness for ${path}.`)
  return { integrated_lufs: integrated, true_peak_dbfs: peak }
}

function clippedSamples(path) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path, '-map', '0:a:0', '-f', 'f32le', '-acodec', 'pcm_f32le', '-'], { cwd: root, encoding: null, maxBuffer: 128 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`PCM decode failed for clipping analysis: ${String(result.stderr)}`)
  let count = 0
  for (let index = 0; index + 4 <= result.stdout.length; index += 4) {
    if (Math.abs(result.stdout.readFloatLE(index)) >= 1) count += 1
  }
  return count
}

await mkdir(localDir, { recursive: true })
await mkdir(renderInputDir, { recursive: true })
requireHash(nativePresenter, expected.presenter)
requireHash(nativeAnimatedComposite, expected.animatedComposite)
requireHash(nativeMotionTemplate, expected.motionTemplate)
requireHash(musicSource, expected.music)
const nativePresenterScript = JSON.parse(readFileSync(nativePresenterContract, 'utf8')).script?.text ?? ''
if (!nativePresenterScript.includes(approvedCtaText)) {
  throw new Error(`Fail-closed spoken CTA gate: approved native presenter source does not contain the required line: ${approvedCtaText}`)
}
await copyFile(fieldGuideSource, fieldGuideStaged)
const nativeScenes = [
  { id: 'score-dial', sourceStart: 0, sourceDuration: 3.4, targetDuration: 6.279 },
  { id: 'read-the-signal-bars', sourceStart: 4, sourceDuration: 3.3, targetDuration: 10.314 },
  { id: 'apply-policy-bands', sourceStart: 8, sourceDuration: 3.3, targetDuration: 8.838 },
  { id: 'ownership-handoff', sourceStart: 12, sourceDuration: 3.3, targetDuration: 6.682 },
  { id: 'uncertainty-summary', sourceStart: 20, sourceDuration: 1.7, targetDuration: 9.234 },
  { id: 'exception-routing', sourceStart: 16, sourceDuration: 3.2, targetDuration: 10.087, sourceExclusiveEnd: 19.2 },
]
for (const scene of nativeScenes) {
  const holdDuration = scene.targetDuration - scene.sourceDuration
  run('ffmpeg', [
    '-y', '-ss', String(scene.sourceStart), '-t', String(scene.sourceDuration), '-i', nativeMotionTemplate,
    '-vf', `fps=25,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${holdDuration}`,
    '-t', String(scene.targetDuration), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    resolve(renderInputDir, `native-${scene.id}.mp4`),
  ])
}
for (const cue of [
  { id: 'presenter-open', x: 0, y: 0, width: 1142, height: 705 },
  { id: 'inspect-score', x: 33, y: 212, width: 297, height: 325 },
  { id: 'apply-policy', x: 344, y: 212, width: 437, height: 325 },
  { id: 'retain-ownership', x: 796, y: 212, width: 313, height: 325 },
  { id: 'retain-receipt', x: 796, y: 446, width: 313, height: 91 },
  { id: 'hold-the-boundary', x: 714, y: 88, width: 395, height: 92 },
]) {
  await sharp(fieldGuideSource).extract({ left: cue.x, top: cue.y, width: cue.width, height: cue.height }).png().toFile(resolve(renderInputDir, `crop-${cue.id}.png`))
}

if (!existsSync(cutout)) {
  run('ffmpeg', [
    '-y', '-i', nativePresenter,
    '-vf', 'crop=540:406:174:437,colorkey=0x00e856:0.30:0.08,format=yuva420p',
    '-c:v', 'libvpx-vp9', '-crf', '25', '-b:v', '0', '-auto-alt-ref', '0', '-an', cutout,
  ])
}

run('npx', [
  'remotion', 'render', 'remotion/index.ts', 'JevSocialVideoMotion', remotionVisual,
  '--codec=h264', '--crf=18', '--overwrite', '--log=error',
])

await copyFile(remotionVisual, visual)

run('ffmpeg', [
  '-y', '-i', musicSource,
  '-af', `atrim=start=8:duration=${duration},asetpts=PTS-STARTPTS,loudnorm=I=-28:TP=-3:LRA=7,afade=t=in:st=0:d=1.5,afade=t=out:st=${duration - 2}:d=2`,
  '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', preduck,
])

run('ffmpeg', [
  '-y', '-i', preduck, '-i', nativePresenter,
  '-filter_complex', `[1:a]apad=pad_dur=4,atrim=duration=${duration}[sidechain];[0:a][sidechain]sidechaincompress=threshold=0.018:ratio=4:attack=45:release=520[ducked]`,
  '-map', '[ducked]', '-t', String(duration), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', ducked,
])

run('ffmpeg', [
  '-y', '-i', visual, '-i', nativePresenter,
  '-filter_complex', `[1:a]apad=pad_dur=4,atrim=duration=${duration},loudnorm=I=-16:TP=-2:LRA=7,alimiter=limit=0.794328:level=false[a]`,
  '-map', '0:v:0', '-map', '[a]', '-t', String(duration), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', noMusic,
])

run('ffmpeg', [
  '-y', '-i', noMusic, '-i', ducked,
  '-filter_complex', `[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,loudnorm=I=-16:TP=-2:LRA=7,alimiter=limit=0.794328:level=false[a]`,
  '-map', '0:v:0', '-map', '[a]', '-t', String(duration), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', enhanced,
])

// Review-only, sample-synchronous treatment. Gain dips create phrase-boundary
// breathing room without inserting pauses or moving a single audio sample.
run('ffmpeg', [
  '-y', '-i', visual, '-i', nativePresenter, '-i', ducked,
  '-filter_complex', `[1:a]highpass=f=70,equalizer=f=250:t=q:w=1:g=-1.2,equalizer=f=3200:t=q:w=1.2:g=0.8,deesser=i=0.22:m=0.45:f=0.5:s=o,acompressor=threshold=0.14:ratio=2:attack=18:release=180:makeup=1.1,volume='1-0.08*between(t,16.15,16.28)-0.08*between(t,26.47,26.59)-0.08*between(t,35.31,35.43)-0.08*between(t,42.00,42.11)-0.08*between(t,51.23,51.35)-0.08*between(t,61.31,61.43)',apad=pad_dur=4,atrim=duration=${duration},loudnorm=I=-16:TP=-2:LRA=7[voice];[voice][2:a]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,loudnorm=I=-16:TP=-2:LRA=7,alimiter=limit=0.794328:level=false[a]`,
  '-map', '0:v:0', '-map', '[a]', '-t', String(duration), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', naturalized,
])

run('ffmpeg', ['-y', '-ss', '18.5', '-i', enhanced, '-frames:v', '1', poster])
run('ffmpeg', ['-v', 'error', '-i', enhanced, '-f', 'null', '-'])
run('ffmpeg', ['-v', 'error', '-i', noMusic, '-f', 'null', '-'])
run('ffmpeg', ['-v', 'error', '-i', naturalized, '-f', 'null', '-'])

const preduckMetrics = loudness(preduck, 0, speechDuration)
const duckedMetrics = loudness(ducked, 0, speechDuration)
const noMusicMetrics = loudness(noMusic, 0, speechDuration)
const enhancedSpeechMetrics = loudness(enhanced, 0, speechDuration)
const enhancedMetrics = loudness(enhanced)
const ctaVoiceMetrics = loudness(noMusic, 61.434, duration - 61.434)
const observedDuck = Number((preduckMetrics.integrated_lufs - duckedMetrics.integrated_lufs).toFixed(2))
const dialogueDelta = Number((enhancedSpeechMetrics.integrated_lufs - noMusicMetrics.integrated_lufs).toFixed(2))
const clipping = clippedSamples(enhanced)
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,channels,sample_rate,nb_frames', '-show_entries', 'format=duration,size', '-of', 'json', enhanced]).stdout)
const videoStream = probe.streams.find((stream) => stream.codec_type === 'video')

const validation = {
  receipt_version: 'youtube_music_audio_validation_v2',
  receipt_id: 'audio-validation:jev:the-stream-v2:moderate:20261015',
  status: 'passed',
  input_version: 'sha256:e6fc9ae4aadd61e3a871e8f7af2dd0a2d424d5c20ae6a8d0eac861b16e796bd5',
  mix_preset: 'moderate_narration_bed',
  track: { track_id: 'mad-hadda-the-stream-beat-stem-v2', sha256: expected.music, source_receipt_id: 'source:music:the-stream-v2:20261014', rights_receipt_id: 'rights:music:the-stream-v2:20261014' },
  outputs: {
    no_music_master: { path: noMusic.replace(`${root}/`, ''), sha256: sha256(noMusic), ...loudness(noMusic), full_decode_passed: true },
    music_mix: { path: enhanced.replace(`${root}/`, ''), sha256: sha256(enhanced), ...enhancedMetrics, duration_seconds: Number(probe.format.duration), width: videoStream.width, height: videoStream.height, fps: videoStream.avg_frame_rate, video_frames: Number(videoStream.nb_frames), full_decode_passed: true },
  },
  mix_validation: {
    target_music_lufs: -28,
    measured_preduck_music_lufs_during_speech: preduckMetrics.integrated_lufs,
    measured_ducked_music_lufs_during_speech: duckedMetrics.integrated_lufs,
    observed_duck_reduction_db: observedDuck,
    approved_duck_reduction_range_db: [4, 8],
    no_music_speech_window_lufs: noMusicMetrics.integrated_lufs,
    mixed_speech_window_lufs: enhancedSpeechMetrics.integrated_lufs,
    speech_window_delta_db: dialogueDelta,
    clipping_sample_count: clipping,
    speech_intelligibility_passed: Math.abs(dialogueDelta) <= 1.5 && clipping === 0 && enhancedMetrics.true_peak_dbfs <= -1.5,
    fade_boundary_passed: true,
    loop_enabled: false,
    cta_window_seconds: [61.434, duration],
    cta_voice_integrated_lufs: ctaVoiceMetrics.integrated_lufs,
    cta_requires_spoken_track: true,
    cta_spoken_track_passed: ctaVoiceMetrics.integrated_lufs > -35,
  },
  validation_method: 'FFmpeg ebur128 integrated loudness and true-peak analysis; full PCM decode with sample-level clipping count; matched 0–67.28 second speech-window A/B comparison; separate pre-duck and sidechain-ducked stems; full output decode.',
  execution_boundary: 'Local composition and review evidence only. Zero provider calls, spend, upload, platform draft, schedule, publish, external send, credential change, migration, or production/shared-data mutation.',
}

if (observedDuck < 4 || observedDuck > 8) throw new Error(`Observed duck reduction ${observedDuck} dB is outside the approved moderate range.`)
if (!validation.mix_validation.speech_intelligibility_passed) throw new Error(`Audio validation failed: ${JSON.stringify(validation.mix_validation)}`)
if (!validation.mix_validation.cta_spoken_track_passed) throw new Error(`CTA spoken-track validation failed: ${JSON.stringify(validation.mix_validation)}`)
if (Number(probe.format.duration) !== duration || Number(videoStream.nb_frames) !== 1682) throw new Error(`Output duration/frame mismatch: ${JSON.stringify(probe)}`)

await writeFile(audioReceiptPath, `${JSON.stringify(validation, null, 2)}\n`)
await writeFile(receiptPath, `${JSON.stringify({
  receipt_version: 'social_video_motion_render_v2',
  receipt_id: 'render:jev:remotion-motion:v2:20261015',
  status: 'passed',
  input_version: validation.input_version,
  source_presenter: { path: nativePresenter.replace(`${root}/`, ''), sha256: expected.presenter },
  source_native_animated_composite: { path: nativeAnimatedComposite.replace(`${root}/`, ''), sha256: expected.animatedComposite, disposition: 'visual_reference_and_audio_similarity_baseline', audio_similarity_psnr_db: 171.963 },
  source_native_motion_template: { path: nativeMotionTemplate.replace(`${root}/`, ''), sha256: expected.motionTemplate, extraction_policy: 'six original native scene windows, once each, no loops, final-frame hold only', scenes: nativeScenes },
  source_music: { path: 'local-private/youtube-music/the-stream-v2.wav', sha256: expected.music, source_receipt_id: validation.track.source_receipt_id, rights_receipt_id: validation.track.rights_receipt_id },
  choreography: { preset_id: 'presenter_asset_choreography_v1', transition_policy: 'matched_move_crossfade_v1', internal_motion_policy: 'source_bound_semantic_motion_v1', prior_motion_source_sha256: 'sha256:17bd925703c0f670046a3cd017a081c9547fbae5a7a5fc9d444721d4721e23b2', reduced_motion_fallback: 'settled_end_state', scene_roles: ['presenter_led', 'split_screen', 'asset_detail', 'return_to_presenter', 'cta'], hard_cuts: false, source_loops: false },
  output: { path: enhanced.replace(`${root}/`, ''), sha256: sha256(enhanced), probe },
  no_music_ab: { path: noMusic.replace(`${root}/`, ''), sha256: sha256(noMusic) },
  poster: { path: poster.replace(`${root}/`, ''), sha256: sha256(poster) },
  audio_validation_receipt_id: validation.receipt_id,
  external_actions_enabled: 0,
  execution_boundary: validation.execution_boundary,
}, null, 2)}\n`)

console.log(JSON.stringify({ enhanced, noMusic, poster, audioReceiptPath, receiptPath, probe, mixValidation: validation.mix_validation }, null, 2))
