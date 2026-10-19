import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { analyzeSpatialLayout, analyzeThumbnailRaster, sha256 } from '../qa/youtube-thumbnail-quality-contract.mjs'

const root = process.cwd()
const decisionPath = path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json')
const outputRoot = path.resolve(root, 'artifacts/research/youtube-thumbnail-taste-reference-2026-10-18')
const decision = JSON.parse(await readFile(decisionPath, 'utf8'))
const preference = decision.user_preference_signals?.[0]
if (!preference || preference.performance_weight !== 0 || preference.evidence_role !== 'taste_calibration_only' || preference.performance_status !== 'unscored') throw new Error('Curated playlist is not bounded to zero-weight taste calibration.')
await mkdir(outputRoot, { recursive: true })

const compositionCoding = {
  '1Rg9N6AC9Cs': ['shared_atmosphere', false, true, 'close', 'gesture_to_proof', true, 4, 'curved_color_sweep', 'heavy_display', 'BUSINESS', 'slab_shadow', 'cohesive'],
  '43MdhyYl2hY': ['shared_atmosphere', false, true, 'close', 'hand_holds_proof', true, 4, 'none', 'heavy_display', 'revenue_badges', 'shadow', 'cohesive'],
  'h9Pk5iNDXMk': ['shared_atmosphere', false, true, 'close', 'gaze_to_proof', true, 3, 'none', 'display_plus_italic', 'full guide', 'weight_contrast', 'cohesive'],
  'JSmGZ8vTEFQ': ['shared_atmosphere', false, true, 'close', 'gaze_to_text', false, 3, 'curved_money_motion', 'heavy_display', 'WRONG', 'shadow', 'cohesive'],
  'fIWUAodAgJw': ['shared_atmosphere', false, true, 'close', 'body_to_proof', true, 4, 'curved_process_path', 'heavy_display', 'DO THIS', 'shadow', 'cohesive'],
  'IGgg397XB90': ['shared_atmosphere', false, true, 'close', 'gaze_to_headline', true, 3, 'repeating_depth_icons', 'heavy_display', 'AI', 'shadow', 'cohesive'],
  'C2NZs1fCLfo': ['shared_atmosphere', false, true, 'close', 'gesture_to_proof', true, 4, 'dashed_process_path', 'display_plus_script', 'process_labels', 'slab_badges', 'cohesive'],
  'O8-UsCW3_1Y': ['shared_atmosphere', false, true, 'close', 'gaze_to_proof', true, 5, 'diagonal_card_stack', 'condensed_display', 'THESE', 'stroke_shadow', 'cohesive'],
  'GTWWNZyIsSc': ['shared_atmosphere', false, true, 'close', 'body_to_headline', true, 3, 'icon_rhythm', 'display_plus_italic', 'AI BUSINESS', 'weight_contrast', 'cohesive'],
  'iXkfIS0dJqQ': ['shared_atmosphere', false, true, 'close', 'connector_to_proof', true, 4, 'curved_red_arrow', 'heavy_display', 'DO THIS', 'shadow', 'cohesive'],
  'j7CaMx2c56M': ['shared_atmosphere', false, true, 'close', 'faces_frame_proof', true, 4, 'shared_red_glow', 'embedded_social_display', 'AI agent', 'card_shadow', 'cohesive'],
  '1L0ghc5ofLo': ['shared_atmosphere', false, true, 'close', 'gesture_holds_proof', true, 4, 'curved_red_arrow', 'heavy_display', 'Contract', 'weight_color_contrast', 'cohesive'],
  '-M_026Esvf0': ['shared_atmosphere', false, false, 'none', 'gaze_in_scene', false, 2, 'window_depth', 'none', 'none', 'none', 'cohesive_reference_without_display_type'],
  'lDHrmDAD9y4': ['shared_atmosphere', false, true, 'close', 'gesture_projects_proof', true, 5, 'light_spill_projection', 'numeric_display', '$48,000', 'glow_shadow', 'cohesive'],
}

function codedComposition(videoId) {
  const [background_model, hard_full_height_divider, subject_overlap_crossing, text_face_proximity, gaze_gesture_relationship, proof_object_integration, depth_layers, connector_treatment, display_font_treatment, highlighted_keyword_treatment, stroke_shadow_slab_treatment, overall_cohesion_decision] = compositionCoding[videoId]
  return { coding_source: 'independent_visual_review_of_captured_reference', background_model, hard_full_height_divider, subject_overlap_crossing, text_face_proximity, gaze_gesture_relationship, proof_object_integration, depth_layers, connector_treatment, display_font_treatment, highlighted_keyword_treatment, stroke_shadow_slab_treatment, overall_cohesion_decision }
}

const references = []
for (const item of preference.item_identities) {
  const artifactPath = path.join(outputRoot, `${item.video_id}.jpg`)
  const sourceUrl = `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`
  let imageBytes
  if (process.env.REUSE_CAPTURE === '1') imageBytes = await readFile(artifactPath)
  else {
    const response = await fetch(sourceUrl)
    if (!response.ok) throw new Error(`${item.video_id}: playlist thumbnail capture failed with ${response.status}`)
    const sourceBytes = Buffer.from(await response.arrayBuffer())
    imageBytes = await sharp(sourceBytes).resize(640, 360, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
    await writeFile(artifactPath, imageBytes)
  }
  references.push({
    video_id: item.video_id,
    source_url: item.source_url,
    thumbnail_source_url: sourceUrl,
    artifact_path: path.relative(root, artifactPath),
    sha256: sha256(imageBytes),
    metrics: await analyzeThumbnailRaster(imageBytes),
    spatial_layout: await analyzeSpatialLayout(imageBytes),
    composition_typography_coding: codedComposition(item.video_id),
  })
}

const observedAt = process.env.OBSERVED_AT ?? new Date().toISOString()
const freshUntil = new Date(Date.parse(observedAt) + (14 * 24 * 60 * 60 * 1000)).toISOString()
const payload = {
  version: 'youtube-thumbnail-taste-reference/v3',
  receipt_id: 'taste:youtube-thumbnail:curated-playlist:20261018:v3',
  source_url: preference.source_url,
  captured_at: observedAt,
  fresh_until: freshUntil,
  status: 'ready',
  evidence_role: 'taste_calibration_only',
  performance_weight: 0,
  performance_status: 'unscored',
  references,
}
payload.input_version = sha256(Buffer.from(JSON.stringify(payload)))
await writeFile(path.join(outputRoot, 'receipt.json'), `${JSON.stringify(payload, null, 2)}\n`)
console.log(JSON.stringify({ receipt_id: payload.receipt_id, input_version: payload.input_version, references: references.length }))
