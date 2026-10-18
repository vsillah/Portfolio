import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

export const QUALITY_CONTRACT_VERSION = 'youtube-thumbnail-pre-human-qa/v1'
export const QUALITY_THRESHOLDS = Object.freeze({
  brightness_min: 0.36,
  saturation_min: 0.16,
  local_contrast_min: 0.12,
  vibrancy_min: 0.075,
  edge_density_min: 0.045,
  playlist_similarity_min: 0.52,
  face_area_ratio_min: 0.12,
  face_area_ratio_max: 0.46,
  visible_eye_count: 2,
  teaser_word_count_max: 5,
  feed_preview_width: 320,
  feed_preview_height: 180,
})

export function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export async function analyzeThumbnailRaster(input) {
  const { data, info } = await sharp(input)
    .resize({ width: 320, height: 180, fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let luminanceTotal = 0
  let saturationTotal = 0
  let luminanceSquaredTotal = 0
  let edgeTotal = 0
  const luminance = new Float32Array(info.width * info.height)
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * info.channels
    const r = data[offset] / 255
    const g = data[offset + 1] / 255
    const b = data[offset + 2] / 255
    const l = (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
    const s = Math.max(r, g, b) - Math.min(r, g, b)
    luminance[index] = l
    luminanceTotal += l
    luminanceSquaredTotal += l * l
    saturationTotal += s
  }
  for (let y = 1; y < info.height; y += 1) {
    for (let x = 1; x < info.width; x += 1) {
      const index = (y * info.width) + x
      edgeTotal += Math.abs(luminance[index] - luminance[index - 1]) + Math.abs(luminance[index] - luminance[index - info.width])
    }
  }
  const count = luminance.length
  const brightness = luminanceTotal / count
  const saturation = saturationTotal / count
  const variance = Math.max(0, (luminanceSquaredTotal / count) - (brightness * brightness))
  const localContrast = Math.sqrt(variance)
  const edgeDensity = edgeTotal / ((info.width - 1) * (info.height - 1) * 2)
  const vibrancy = saturation * (0.6 + localContrast)
  return {
    sample_width: info.width,
    sample_height: info.height,
    brightness: Number(brightness.toFixed(4)),
    saturation: Number(saturation.toFixed(4)),
    local_contrast: Number(localContrast.toFixed(4)),
    edge_density: Number(edgeDensity.toFixed(4)),
    vibrancy: Number(vibrancy.toFixed(4)),
  }
}

export function playlistStyleSimilarity(metrics, references) {
  const keys = ['brightness', 'saturation', 'local_contrast', 'edge_density', 'vibrancy']
  const scales = { brightness: 0.5, saturation: 0.45, local_contrast: 0.3, edge_density: 0.25, vibrancy: 0.35 }
  const scores = references.map((reference) => {
    const meanDistance = keys.reduce((total, key) => total + clamp(Math.abs(metrics[key] - reference.metrics[key]) / scales[key]), 0) / keys.length
    return Number(clamp(1 - meanDistance).toFixed(4))
  })
  const sorted = [...scores].sort((a, b) => a - b)
  const median = sorted.length % 2 === 0
    ? (sorted[(sorted.length / 2) - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]
  return { score: Number(median.toFixed(4)), sample_count: scores.length, individual_scores: scores }
}

export function validateGenerationBrief({ brief, decision, tasteReceipt, now = Date.now() }) {
  const failures = []
  const requiredText = [
    ['lighting', brief.lighting?.direction],
    ['palette', brief.palette?.join?.('|')],
    ['expression', brief.expression?.label],
    ['face prominence', brief.face_prominence?.target_area_ratio],
    ['focal point', brief.dominant_focal_point],
    ['teaser copy', brief.teaser_copy],
    ['title-copy contrast', brief.title_copy_contrast?.relationship],
    ['product proof', brief.product_proof?.receipt_id],
  ]
  for (const [label, value] of requiredText) if (!value) failures.push(`missing ${label}`)
  const words = String(brief.teaser_copy ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length > QUALITY_THRESHOLDS.teaser_word_count_max) failures.push('teaser copy exceeds five words')
  if (brief.title_copy_contrast?.title !== brief.title || brief.title_copy_contrast?.thumbnail !== brief.teaser_copy || brief.title === brief.teaser_copy) failures.push('title and thumbnail copy are not distinctly bound')
  if (brief.one_second_read?.status !== 'pass' || brief.feed_size_plan?.width !== 320 || brief.feed_size_plan?.height !== 180 || brief.feed_size_plan?.minimum_font_px_at_1280 < 54) failures.push('one-second or feed-size legibility plan is missing')
  if (brief.face_prominence?.target_area_ratio < QUALITY_THRESHOLDS.face_area_ratio_min || brief.face_prominence?.target_area_ratio > QUALITY_THRESHOLDS.face_area_ratio_max) failures.push('face prominence target is outside the accepted range')
  if (!brief.expression?.label || /neutral|calm|reserved/i.test(brief.expression.label) || brief.expression?.campaign_relevance?.length < 12) failures.push('expression is neutral or lacks campaign relevance')
  if (brief.lighting?.brightness_target < QUALITY_THRESHOLDS.brightness_min || brief.palette?.length < 3) failures.push('lighting or palette target is insufficient')
  if (brief.product_proof?.receipt_id !== decision.candidate_identity?.product_proof_receipt_id) failures.push('product proof binding is stale')
  const binding = brief.evidence_bindings ?? {}
  if (binding.decision_receipt_id !== decision.receipt_id || binding.decision_input_version !== decision.input_version || binding.decision_output_version !== decision.output_version || binding.live_cohort_id !== decision.live_evidence?.cohort_id) failures.push('decision evidence binding is stale')
  if (!Date.parse(decision.live_evidence?.fresh_until) || Date.parse(decision.live_evidence.fresh_until) < now) failures.push('live topic outlier evidence is missing or stale')
  if (!(decision.live_evidence?.comparisons ?? []).some((item) => item.decision === 'included' && item.outlier_qualified && item.normalized_performance_score >= decision.live_evidence.outlier_threshold)) failures.push('live topic-specific outlier gate is not met')
  const preference = decision.user_preference_signals?.[0]
  if (!preference || preference.performance_weight !== 0 || preference.evidence_role !== 'taste_calibration_only' || preference.performance_status !== 'unscored') failures.push('playlist crossed the taste-calibration-only boundary')
  if (binding.playlist_receipt_id !== tasteReceipt.receipt_id || binding.playlist_input_version !== tasteReceipt.input_version || tasteReceipt.status !== 'ready' || tasteReceipt.references?.length !== preference?.item_identities?.length) failures.push('playlist visual reference receipt is missing or stale')
  if (brief.provider?.name !== 'heygen_pro' || brief.provider?.model !== 'heygen-image-1' || brief.provider?.mode !== 'identity_remix' || !brief.provider?.identity_url || !brief.provider?.reference_url) failures.push('HeyGen provider binding is incomplete')
  return { status: failures.length === 0 ? 'passed' : 'blocked', failures, teaser_word_count: words.length }
}

function normalizedCopy(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}

function boxesIntersectWithPadding(face, overlay, padding) {
  const expanded = { x: face.x - padding, y: face.y - padding, width: face.width + (padding * 2), height: face.height + (padding * 2) }
  return overlay.x < expanded.x + expanded.width && overlay.x + overlay.width > expanded.x && overlay.y < expanded.y + expanded.height && overlay.y + overlay.height > expanded.y
}

export async function buildFinalQualityReceipt({ brief, decision, tasteReceipt, outputPath, feedPreviewPath, sourceImagePath, inspectionReceipt, preflightReceipt }) {
  const bytes = await readFile(outputPath)
  const feedBytes = await readFile(feedPreviewPath)
  const sourceBytes = await readFile(sourceImagePath)
  const metrics = await analyzeThumbnailRaster(bytes)
  const similarity = playlistStyleSimilarity(metrics, tasteReceipt.references)
  const outputSha256 = sha256(bytes)
  const feedPreviewSha256 = sha256(feedBytes)
  const sourceImageSha256 = sha256(sourceBytes)
  const faceAssessment = inspectionReceipt?.face_assessment
  const failures = []
  if (metrics.brightness < QUALITY_THRESHOLDS.brightness_min) failures.push('final raster is too dark')
  if (metrics.saturation < QUALITY_THRESHOLDS.saturation_min) failures.push('final raster is too desaturated')
  if (metrics.local_contrast < QUALITY_THRESHOLDS.local_contrast_min) failures.push('final raster lacks local contrast')
  if (metrics.vibrancy < QUALITY_THRESHOLDS.vibrancy_min) failures.push('final raster lacks vibrancy')
  if (metrics.edge_density < QUALITY_THRESHOLDS.edge_density_min) failures.push('final raster lacks feed-size edge definition')
  if (similarity.score < QUALITY_THRESHOLDS.playlist_similarity_min) failures.push('playlist visual similarity is below threshold')
  if (faceAssessment?.area_ratio < QUALITY_THRESHOLDS.face_area_ratio_min || faceAssessment?.area_ratio > QUALITY_THRESHOLDS.face_area_ratio_max) failures.push('face prominence is outside the accepted range')
  if (faceAssessment?.visible_eye_count !== QUALITY_THRESHOLDS.visible_eye_count || faceAssessment?.eyes_unobstructed !== true) failures.push('both eyes are not clearly visible')
  if (!faceAssessment?.expression_label || /neutral|calm|reserved/i.test(faceAssessment.expression_label) || faceAssessment?.campaign_relevance?.length < 12) failures.push('facial expression is neutral or not campaign-relevant')
  if (inspectionReceipt?.version !== 'youtube-thumbnail-post-generation-inspection/v1' || inspectionReceipt?.status !== 'passed' || inspectionReceipt?.inspection_source !== 'independent_post_render_visual_inspection') failures.push('independent post-generation inspection receipt is missing, forged, or blocked')
  if (inspectionReceipt?.campaign_id !== brief.campaign_id || inspectionReceipt?.content_version !== brief.content_version) failures.push('post-generation inspection campaign binding is stale')
  if (inspectionReceipt?.source_image_sha256 !== sourceImageSha256) failures.push('post-generation inspection source image hash is stale')
  if (inspectionReceipt?.final_output_sha256 !== outputSha256) failures.push('post-generation inspection final output hash is stale')
  if (inspectionReceipt?.feed_preview_sha256 !== feedPreviewSha256) failures.push('post-generation inspection feed preview hash is stale')
  if (inspectionReceipt?.feed_copy_inspection?.method !== 'rendered_320x180_visual_transcription' || inspectionReceipt?.feed_copy_inspection?.legible !== true) failures.push('actual 320x180 rendered-copy inspection is missing or failed')
  if (normalizedCopy(inspectionReceipt?.feed_copy_inspection?.transcribed_text) !== normalizedCopy(brief.teaser_copy)) failures.push('feed-size teaser transcription does not match the exact teaser')
  const faceBox = inspectionReceipt?.face_bounding_box
  const overlays = inspectionReceipt?.overlay_bounding_boxes
  const padding = inspectionReceipt?.face_clearance_padding_px
  if (!faceBox || !Array.isArray(overlays) || overlays.length === 0 || !Number.isFinite(padding) || padding < 24) failures.push('face-clearance geometry is missing or below the minimum padding')
  else if (overlays.some((overlay) => boxesIntersectWithPadding(faceBox, overlay, padding))) failures.push('an overlay intersects the padded face-clearance box')
  if (preflightReceipt?.status !== 'passed' || preflightReceipt?.brief_input_version !== sha256(Buffer.from(JSON.stringify(brief)))) failures.push('pre-generation receipt is missing or stale')
  if (decision.receipt_id !== brief.evidence_bindings.decision_receipt_id || tasteReceipt.receipt_id !== brief.evidence_bindings.playlist_receipt_id) failures.push('post-render evidence binding is stale')
  const status = failures.length === 0 ? 'passed' : 'blocked'
  return {
    version: 'youtube-thumbnail-final-quality/v1',
    receipt_id: `quality:${brief.campaign_id}:youtube-thumbnail:${brief.content_version}:v1`,
    status,
    failures,
    content_version: brief.content_version,
    brief_id: brief.brief_id,
    brief_input_version: sha256(Buffer.from(JSON.stringify(brief))),
    preflight_receipt_id: preflightReceipt.receipt_id,
    decision_receipt_id: decision.receipt_id,
    decision_input_version: decision.input_version,
    decision_output_version: decision.output_version,
    playlist_receipt_id: tasteReceipt.receipt_id,
    playlist_performance_weight: 0,
    playlist_performance_status: 'unscored',
    output_sha256: outputSha256,
    source_image_sha256: sourceImageSha256,
    feed_preview_sha256: feedPreviewSha256,
    metrics,
    thresholds: QUALITY_THRESHOLDS,
    playlist_visual_similarity: similarity,
    face_assessment: faceAssessment,
    post_generation_inspection_receipt_id: inspectionReceipt?.receipt_id ?? null,
    feed_copy_inspection: inspectionReceipt?.feed_copy_inspection ?? null,
    face_clearance: { face_bounding_box: faceBox ?? null, overlay_bounding_boxes: overlays ?? null, padding_px: padding ?? null },
    human_qa_artifact_generation_allowed: status === 'passed',
  }
}
