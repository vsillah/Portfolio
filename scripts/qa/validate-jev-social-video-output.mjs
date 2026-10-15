import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const packagePath = 'artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-social-video-review-package-v1.json'
const audioReceiptPath = 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-youtube-presenter-first/jev-youtube-moderate-music-audio-validation.receipt.json'
const reviewPackage = JSON.parse(readFileSync(packagePath, 'utf8'))
const audioReceipt = JSON.parse(readFileSync(audioReceiptPath, 'utf8'))
const output = reviewPackage.outputs.enhanced_path

function run(command, args, encoding = 'utf8') {
  const result = spawnSync(command, args, { encoding, maxBuffer: 128 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
  return result.stdout
}

function sha256(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

const visual = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', output, '-vf', 'fps=1,scale=270:480', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], null)
let suspiciousGreenPixels = 0
const totalPixels = visual.length / 3
for (let index = 0; index + 3 <= visual.length; index += 3) {
  const red = visual[index]
  const green = visual[index + 1]
  const blue = visual[index + 2]
  if (green > 175 && green > red * 1.8 && green > blue * 1.25) suspiciousGreenPixels += 1
}
const greenBleedRatio = suspiciousGreenPixels / totalPixels
if (greenBleedRatio > 0.005) throw new Error(`Green-screen bleed ratio ${greenBleedRatio} exceeds the 0.5% fail-closed limit.`)

for (const cue of reviewPackage.motion_recipe.cues) {
  if (cue.text_box && cue.evidence_region && overlaps(cue.text_box, cue.evidence_region)) throw new Error(`${cue.cue_id} text overlaps its evidence region.`)
  if (cue.text_box && (cue.text_box.x < cue.safe_area.left || cue.text_box.y < cue.safe_area.top || cue.text_box.x + cue.text_box.width > 1080 - cue.safe_area.right || cue.text_box.y + cue.text_box.height > 1920 - cue.safe_area.bottom)) throw new Error(`${cue.cue_id} text leaves the title-safe area.`)
  if (cue.source_crop) {
    const asset = reviewPackage.source_assets.find((candidate) => candidate.asset_id === cue.asset_id)
    if (!asset || cue.source_crop.x < 0 || cue.source_crop.y < 0 || cue.source_crop.x + cue.source_crop.width > asset.width || cue.source_crop.y + cue.source_crop.height > asset.height) throw new Error(`${cue.cue_id} has an unsafe source crop.`)
  }
}

const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,channels,sample_rate,nb_frames', '-show_entries', 'format=duration', '-of', 'json', output]))
const video = probe.streams.find((stream) => stream.codec_type === 'video')
if (Number(probe.format.duration) !== 71.28 || Number(video.nb_frames) !== 1782 || video.width !== 1080 || video.height !== 1920 || video.avg_frame_rate !== '25/1') throw new Error(`Output probe mismatch: ${JSON.stringify(probe)}`)
if (sha256(output) !== reviewPackage.outputs.enhanced_sha256) throw new Error('Enhanced output hash does not match its package binding.')
if (!audioReceipt.mix_validation.speech_intelligibility_passed || audioReceipt.mix_validation.clipping_sample_count !== 0 || audioReceipt.mix_validation.observed_duck_reduction_db < 4 || audioReceipt.mix_validation.observed_duck_reduction_db > 8) throw new Error('Audio validation receipt does not pass the moderate narration gate.')

console.log(JSON.stringify({
  status: 'passed',
  output,
  sha256: sha256(output),
  probe,
  green_screen_bleed_ratio: Number(greenBleedRatio.toFixed(6)),
  overlap_checks: reviewPackage.motion_recipe.cues.length,
  crop_checks: reviewPackage.motion_recipe.cues.filter((cue) => cue.source_crop).length,
  safe_area_checks: reviewPackage.motion_recipe.cues.filter((cue) => cue.text_box).length,
  transition_policy: reviewPackage.motion_recipe.transition_policy,
  audio: audioReceipt.mix_validation,
}, null, 2))
