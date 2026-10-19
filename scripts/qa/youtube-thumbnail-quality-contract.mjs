import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

export const QUALITY_CONTRACT_VERSION = 'youtube-thumbnail-pre-human-qa/v2'
export const QUALITY_THRESHOLDS = Object.freeze({
  brightness_min: 0.36,
  saturation_min: 0.16,
  local_contrast_min: 0.12,
  vibrancy_min: 0.075,
  playlist_similarity_min: 0.52,
  face_area_ratio_min: 0.12,
  face_area_ratio_max: 0.46,
  visible_eye_count: 2,
  teaser_word_count_max: 5,
  feed_preview_width: 320,
  feed_preview_height: 180,
  foreground_background_distance_min: 0.18,
  text_panel_contrast_ratio_min: 4.5,
  subject_background_distance_min: 0.16,
  product_background_distance_min: 0.14,
  accent_saturation_min: 0.42,
  dominant_field_saturation_min: 0.34,
  controlled_palette_min: 3,
  controlled_palette_max: 18,
  background_edge_density_max: 0.035,
  spatial_playlist_similarity_min: 0.56,
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

function regionPixels(data, info, box) {
  const left = Math.max(0, Math.floor(box.x))
  const top = Math.max(0, Math.floor(box.y))
  const right = Math.min(info.width, Math.ceil(box.x + box.width))
  const bottom = Math.min(info.height, Math.ceil(box.y + box.height))
  const pixels = []
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = ((y * info.width) + x) * info.channels
      pixels.push([data[offset] / 255, data[offset + 1] / 255, data[offset + 2] / 255])
    }
  }
  return { pixels, width: right - left, height: bottom - top }
}

function summarizePixels(sample) {
  const { pixels, width, height } = sample
  if (!pixels.length) return { mean_rgb: [0, 0, 0], luminance: 0, saturation: 0, edge_density: 0 }
  const totals = [0, 0, 0]
  let luminanceTotal = 0
  let saturationTotal = 0
  const luminance = new Float32Array(pixels.length)
  for (let index = 0; index < pixels.length; index += 1) {
    const [r, g, b] = pixels[index]
    totals[0] += r; totals[1] += g; totals[2] += b
    const linear = [r, g, b].map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    const l = (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2])
    luminance[index] = l
    luminanceTotal += l
    const maximum = Math.max(r, g, b)
    saturationTotal += maximum === 0 ? 0 : (maximum - Math.min(r, g, b)) / maximum
  }
  let edgeTotal = 0
  for (let y = 1; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const index = (y * width) + x
      edgeTotal += Math.abs(luminance[index] - luminance[index - 1]) + Math.abs(luminance[index] - luminance[index - width])
    }
  }
  return {
    mean_rgb: totals.map((value) => Number((value / pixels.length).toFixed(4))),
    luminance: Number((luminanceTotal / pixels.length).toFixed(4)),
    saturation: Number((saturationTotal / pixels.length).toFixed(4)),
    edge_density: Number((edgeTotal / Math.max(1, (width - 1) * (height - 1) * 2)).toFixed(4)),
  }
}

function colorDistance(a, b) {
  return Number((Math.sqrt(a.reduce((total, value, index) => total + ((value - b[index]) ** 2), 0)) / Math.sqrt(3)).toFixed(4))
}

function contrastRatio(a, b) {
  const high = Math.max(a, b)
  const low = Math.min(a, b)
  return Number(((high + 0.05) / (low + 0.05)).toFixed(2))
}

export async function analyzeSpatialLayout(input) {
  const { data, info } = await sharp(input).resize(320, 180, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const boxes = [
    { x: 0, y: 0, width: 160, height: 90 }, { x: 160, y: 0, width: 160, height: 90 },
    { x: 0, y: 90, width: 160, height: 90 }, { x: 160, y: 90, width: 160, height: 90 },
  ]
  const quadrants = boxes.map((box) => summarizePixels(regionPixels(data, info, box)))
  const separations = [[0, 1], [0, 2], [1, 3], [2, 3]].map(([a, b]) => colorDistance(quadrants[a].mean_rgb, quadrants[b].mean_rgb))
  return {
    quadrants,
    mean_adjacent_color_separation: Number((separations.reduce((sum, value) => sum + value, 0) / separations.length).toFixed(4)),
    luminance_range: Number((Math.max(...quadrants.map((item) => item.luminance)) - Math.min(...quadrants.map((item) => item.luminance))).toFixed(4)),
  }
}

export async function analyzeColorPolish(input, regions) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const summaries = Object.fromEntries(Object.entries(regions ?? {}).map(([name, box]) => [name, summarizePixels(regionPixels(data, info, box))]))
  const quantized = new Map()
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const key = `${data[offset] >> 5}-${data[offset + 1] >> 5}-${data[offset + 2] >> 5}`
    quantized.set(key, (quantized.get(key) ?? 0) + 1)
  }
  const minimumCount = (data.length / info.channels) * 0.015
  const controlledPaletteCount = [...quantized.values()].filter((count) => count >= minimumCount).length
  return {
    region_summaries: summaries,
    foreground_background_distance: colorDistance(summaries.foreground?.mean_rgb ?? [0, 0, 0], summaries.background?.mean_rgb ?? [0, 0, 0]),
    text_panel_contrast_ratio: contrastRatio(summaries.text_foreground?.luminance ?? 0, summaries.text_panel_background?.luminance ?? 0),
    subject_background_distance: colorDistance(summaries.subject?.mean_rgb ?? [0, 0, 0], summaries.subject_background?.mean_rgb ?? [0, 0, 0]),
    product_background_distance: colorDistance(summaries.product_proof?.mean_rgb ?? [0, 0, 0], summaries.product_background?.mean_rgb ?? [0, 0, 0]),
    dominant_field_saturation: summaries.dominant_field?.saturation ?? 0,
    accent_saturation: summaries.accent?.saturation ?? 0,
    background_edge_density: summaries.background?.edge_density ?? 1,
    controlled_palette_count: controlledPaletteCount,
  }
}

export function playlistStyleSimilarity(metrics, spatial, references) {
  const keys = ['brightness', 'saturation', 'local_contrast', 'edge_density', 'vibrancy']
  const scales = { brightness: 0.5, saturation: 0.45, local_contrast: 0.3, edge_density: 0.25, vibrancy: 0.35 }
  const scores = references.map((reference) => {
    const meanDistance = keys.reduce((total, key) => total + clamp(Math.abs(metrics[key] - reference.metrics[key]) / scales[key]), 0) / keys.length
    const referenceSpatial = reference.spatial_layout
    const spatialDistance = referenceSpatial
      ? (clamp(Math.abs(spatial.mean_adjacent_color_separation - referenceSpatial.mean_adjacent_color_separation) / 0.5) + clamp(Math.abs(spatial.luminance_range - referenceSpatial.luminance_range) / 0.7)) / 2
      : 1
    return Number(clamp((1 - meanDistance) * 0.4 + (1 - spatialDistance) * 0.6).toFixed(4))
  })
  const sorted = [...scores].sort((a, b) => b - a)
  const topQuartile = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 4)))
  const score = topQuartile.reduce((sum, value) => sum + value, 0) / topQuartile.length
  return { score: Number(score.toFixed(4)), method: 'top_quartile_spatial_palette_similarity/v2', sample_count: scores.length, individual_scores: scores }
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
    ['color polish plan', brief.color_polish_plan?.dominant_field],
    ['cohesive composition plan', brief.cohesive_composition_plan?.background_model],
    ['typography polish plan', brief.typography_polish_plan?.font_asset],
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
  if ((tasteReceipt.references ?? []).some((reference) => !reference.composition_typography_coding?.overall_cohesion_decision)) failures.push('playlist composition and typography coding is incomplete')
  if (brief.provider?.name !== 'heygen_pro' || brief.provider?.model !== 'heygen-image-1' || brief.provider?.mode !== 'identity_remix' || !brief.provider?.identity_url || !brief.provider?.reference_url) failures.push('HeyGen provider binding is incomplete')
  if (brief.provider?.new_call_authorized !== false) failures.push('provider-call gate is not explicitly closed')
  if (!brief.color_polish_plan?.accent_family || !brief.color_polish_plan?.contrast_field || !brief.color_polish_plan?.subject_separation || !brief.color_polish_plan?.product_separation || !brief.color_polish_plan?.background_complexity) failures.push('color-polish plan is incomplete')
  const cohesion = brief.cohesive_composition_plan
  if (cohesion?.background_model !== 'shared_atmosphere' || cohesion?.hard_full_height_divider !== false || cohesion?.isolated_card_pair !== false || cohesion?.mechanisms?.length < 2 || !cohesion?.spatial_relationship) failures.push('cohesive-composition plan is incomplete or rigid')
  const typography = brief.typography_polish_plan
  if (!typography?.font_asset || /Arial|Helvetica|system/i.test(typography?.font_asset) || !typography?.treatment || !typography?.emphasized_keyword || !typography?.emphasis_treatment || typography?.feed_contrast_target < 4.5) failures.push('typography-polish plan is incomplete or basic')
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
  const spatialLayout = await analyzeSpatialLayout(bytes)
  const colorPolish = await analyzeColorPolish(bytes, inspectionReceipt?.color_polish_regions)
  const similarity = playlistStyleSimilarity(metrics, spatialLayout, tasteReceipt.references)
  const outputSha256 = sha256(bytes)
  const feedPreviewSha256 = sha256(feedBytes)
  const sourceImageSha256 = sha256(sourceBytes)
  const faceAssessment = inspectionReceipt?.face_assessment
  const failures = []
  if (metrics.brightness < QUALITY_THRESHOLDS.brightness_min) failures.push('final raster is too dark')
  if (metrics.saturation < QUALITY_THRESHOLDS.saturation_min) failures.push('final raster is too desaturated')
  if (metrics.local_contrast < QUALITY_THRESHOLDS.local_contrast_min) failures.push('final raster lacks local contrast')
  if (metrics.vibrancy < QUALITY_THRESHOLDS.vibrancy_min) failures.push('final raster lacks vibrancy')
  if (similarity.score < QUALITY_THRESHOLDS.spatial_playlist_similarity_min) failures.push('spatial playlist visual similarity is below threshold')
  if (colorPolish.foreground_background_distance < QUALITY_THRESHOLDS.foreground_background_distance_min) failures.push('foreground and background color separation is too weak')
  if (colorPolish.text_panel_contrast_ratio < QUALITY_THRESHOLDS.text_panel_contrast_ratio_min) failures.push('text-panel contrast is too weak')
  if (colorPolish.subject_background_distance < QUALITY_THRESHOLDS.subject_background_distance_min) failures.push('subject/background separation is too weak')
  if (colorPolish.product_background_distance < QUALITY_THRESHOLDS.product_background_distance_min) failures.push('product-proof separation is too weak')
  if (colorPolish.accent_saturation < QUALITY_THRESHOLDS.accent_saturation_min || colorPolish.dominant_field_saturation < QUALITY_THRESHOLDS.dominant_field_saturation_min) failures.push('dominant or accent palette lacks strength')
  if (colorPolish.controlled_palette_count < QUALITY_THRESHOLDS.controlled_palette_min || colorPolish.controlled_palette_count > QUALITY_THRESHOLDS.controlled_palette_max) failures.push('palette is not sufficiently controlled')
  if (colorPolish.background_edge_density > QUALITY_THRESHOLDS.background_edge_density_max) failures.push('background is visually busy')
  if (inspectionReceipt?.feed_focal_hierarchy?.status !== 'passed' || inspectionReceipt?.feed_focal_hierarchy?.ordered_roles?.length < 3) failures.push('feed-size focal hierarchy inspection is missing or failed')
  const cohesion = inspectionReceipt?.cohesive_composition_assessment
  if (cohesion?.status !== 'passed' || cohesion?.background_model !== 'shared_atmosphere' || cohesion?.equal_split !== false || cohesion?.hard_full_height_divider !== false || cohesion?.isolated_card_pair !== false || cohesion?.mechanisms?.length < 2 || !cohesion?.spatial_relationship_mechanism) failures.push('cohesive-composition gate is missing, rigid, or unsupported')
  const typography = inspectionReceipt?.typography_polish_assessment
  if (typography?.status !== 'passed' || !typography?.font_asset_sha256 || /plain|default|basic/i.test(typography?.display_treatment ?? '') || !typography?.hierarchy?.length || !typography?.emphasized_keyword || !typography?.emphasis_treatment || typography?.feed_size_contrast_passed !== true) failures.push('typography-polish gate is missing or basic')
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
    spatial_layout: spatialLayout,
    color_polish: colorPolish,
    face_assessment: faceAssessment,
    post_generation_inspection_receipt_id: inspectionReceipt?.receipt_id ?? null,
    feed_copy_inspection: inspectionReceipt?.feed_copy_inspection ?? null,
    face_clearance: { face_bounding_box: faceBox ?? null, overlay_bounding_boxes: overlays ?? null, padding_px: padding ?? null },
    human_qa_artifact_generation_allowed: status === 'passed',
  }
}
