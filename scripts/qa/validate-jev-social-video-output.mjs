import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const packagePath = 'artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-social-video-review-package-v1.json'
const audioReceiptPath = 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-youtube-presenter-first/jev-youtube-moderate-music-audio-validation.receipt.json'
const completenessContractPath = 'artifacts/human-qa/social-video-production-controls-2026-10-15-revision/jev-completeness-contract.json'
const reviewPackage = JSON.parse(readFileSync(packagePath, 'utf8'))
const audioReceipt = JSON.parse(readFileSync(audioReceiptPath, 'utf8'))
const completeness = JSON.parse(readFileSync(completenessContractPath, 'utf8'))
const nativePresenterContract = JSON.parse(readFileSync('artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-avatar-motion-v3-mad-hadda-v3-api-credit.json', 'utf8'))
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
if (Number(probe.format.duration) !== 67.28 || Number(video.nb_frames) !== 1682 || video.width !== 1080 || video.height !== 1920 || video.avg_frame_rate !== '25/1') throw new Error(`Output probe mismatch: ${JSON.stringify(probe)}`)
if (sha256(output) !== reviewPackage.outputs.enhanced_sha256) throw new Error('Enhanced output hash does not match its package binding.')
if (!audioReceipt.mix_validation.speech_intelligibility_passed || audioReceipt.mix_validation.clipping_sample_count !== 0 || audioReceipt.mix_validation.observed_duck_reduction_db < 4 || audioReceipt.mix_validation.observed_duck_reduction_db > 8) throw new Error('Audio validation receipt does not pass the moderate narration gate.')

const requiredScenes = ['score-dial', 'read-the-signal-bars', 'apply-policy-bands', 'ownership-handoff', 'uncertainty-summary', 'exception-routing']
const sceneIds = completeness.native_scene_bindings.map((scene) => scene.scene_id)
if (sceneIds.length !== requiredScenes.length || new Set(sceneIds).size !== requiredScenes.length || requiredScenes.some((id) => !sceneIds.includes(id))) throw new Error('Completeness contract is missing or repeats a required native scene.')
if (completeness.native_scene_bindings.some((scene) => scene.appearance_count !== 1 || scene.loop !== false || scene.extension !== 'final_frame_hold')) throw new Error('Every native scene must appear exactly once, without a loop, and may only hold its final frame.')
for (const scene of completeness.native_scene_bindings) {
  if (scene.source_exclusive_end_seconds !== undefined && scene.source_start_seconds + scene.source_duration_seconds > scene.source_exclusive_end_seconds) throw new Error(`${scene.scene_id} crosses its exclusive native-scene ownership boundary.`)
}
let observedMaxConcurrentTeachingAssets = 0
let overlapFrame = null
for (let frame = 0; frame < completeness.canvas.frame_count; frame += 1) {
  const second = frame / completeness.canvas.fps
  const active = completeness.native_scene_bindings.filter((scene) => second >= scene.timeline_start_seconds && second < scene.timeline_end_seconds).length
  observedMaxConcurrentTeachingAssets = Math.max(observedMaxConcurrentTeachingAssets, active)
  if (active > completeness.visual_ownership.max_concurrent_teaching_assets) overlapFrame ??= frame
}
if (overlapFrame !== null || observedMaxConcurrentTeachingAssets !== 1 || !completeness.visual_ownership.frame_by_frame_validation) throw new Error(`Teaching-asset concurrency failed at frame ${overlapFrame}; observed max ${observedMaxConcurrentTeachingAssets}.`)
if (completeness.layout.regions_overlap || completeness.layout.split_presenter_width_px < 520 || completeness.layout.presenter_forward_width_px < 1000 || !completeness.layout.safe_area_passed) throw new Error('Presenter prominence, split geometry, overlap, or safe-area contract failed.')
if (!completeness.story.conclusion_present || completeness.story.subscribe_cta_window[0] !== 61.434 || completeness.story.subscribe_cta_window[1] !== 67.28 || !completeness.story.cta_requires_spoken_track || completeness.story.internal_operator_copy_present) throw new Error('Conclusion, spoken CTA, or customer-facing copy contract failed.')
if (!completeness.audio.audible_music_passed || completeness.audio.loop || completeness.audio.observed_duck_reduction_db < 4 || completeness.audio.observed_duck_reduction_db > 8) throw new Error('Audible bounded music contract failed.')
const approvedCtaText = completeness.story.approved_cta_text
const semanticCtaPresent = nativePresenterContract.script?.text?.includes(approvedCtaText) === true
const acceptedCtaException = completeness.accepted_exceptions?.some((entry) => entry.artifact_id === completeness.artifact_id && entry.input_version === completeness.input_version && entry.rule_id === 'script.semantic_spoken_cta' && entry.accepted_by_user === true && entry.visual_cta_present === true && entry.weakens_future_default === false)
const ctaSemanticPassed = completeness.story.cta_requires_semantic_transcript_match && completeness.story.cta_semantic_transcript_present && semanticCtaPresent && audioReceipt.mix_validation.cta_semantic_transcript_present && audioReceipt.mix_validation.cta_spoken_track_passed
if (!ctaSemanticPassed && !acceptedCtaException) throw new Error(`CTA transcript does not contain the exact approved line: ${approvedCtaText}`)
if (Object.values(completeness.packaging_receipts).some((value) => !value)) throw new Error('A required packaging or provenance receipt is missing.')
if (completeness.source_bindings.presenter_sha256 !== reviewPackage.vocal_treatment.source_presenter_sha256 || completeness.source_bindings.music_sha256 !== reviewPackage.music_bed.track.sha256) throw new Error('Completeness contract source binding mismatch.')
const remotionSource = readFileSync('remotion/social-video/JevSocialVideoMotion.tsx', 'utf8')
for (const forbidden of ['Mock-qualified review', 'live provider use remains on hold', 'SemanticMotion']) {
  if (remotionSource.includes(forbidden)) throw new Error(`Customer-facing composition contains forbidden internal or reconstructed content: ${forbidden}`)
}

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
  completeness_contract: completenessContractPath,
  native_scenes_exactly_once: sceneIds,
  max_concurrent_teaching_assets: observedMaxConcurrentTeachingAssets,
  frame_by_frame_asset_ownership_frames_checked: completeness.canvas.frame_count,
  cta_spoken_track: {
    window_seconds: audioReceipt.mix_validation.cta_window_seconds,
    integrated_lufs: audioReceipt.mix_validation.cta_voice_integrated_lufs,
    semantic_passed: ctaSemanticPassed,
    accepted_artifact_exception: acceptedCtaException,
  },
}, null, 2))
