import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { buildFinalQualityReceipt, sha256, validateGenerationBrief } from './youtube-thumbnail-quality-contract.mjs'

const temporary: string[] = []
afterEach(() => temporary.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })))

function baseEvidence() {
  const decision = {
    receipt_id: 'decision:test:v3', input_version: 'sha256:decision', output_version: 'decision:test:v3',
    candidate_identity: { product_proof_receipt_id: 'sha256:proof' },
    live_evidence: { cohort_id: 'cohort:test', fresh_until: '2999-01-01T00:00:00.000Z', outlier_threshold: 1.5, comparisons: [{ decision: 'included', outlier_qualified: true, normalized_performance_score: 2 }] },
    user_preference_signals: [{ performance_weight: 0, evidence_role: 'taste_calibration_only', performance_status: 'unscored', item_identities: ['a'] }],
  }
  const tasteReceipt = { receipt_id: 'taste:test', input_version: 'sha256:taste', status: 'ready', references: [{ metrics: { brightness: 0.5, saturation: 0.3, local_contrast: 0.25, edge_density: 0.1, vibrancy: 0.2 } }] }
  const brief = {
    brief_id: 'brief:test:v4', campaign_id: 'test', content_version: 'v4', title: 'A Different Long Title', teaser_copy: 'LOOK HERE',
    lighting: { direction: 'front', brightness_target: 0.6 }, palette: ['#fff', '#00f', '#fc0'], expression: { label: 'wide-eyed surprise', campaign_relevance: 'Shows the decision tension clearly.' },
    face_prominence: { target_area_ratio: 0.2 }, dominant_focal_point: 'expressive person', title_copy_contrast: { title: 'A Different Long Title', thumbnail: 'LOOK HERE', relationship: 'adds tension' },
    product_proof: { receipt_id: 'sha256:proof' }, one_second_read: { status: 'pass' }, feed_size_plan: { width: 320, height: 180, minimum_font_px_at_1280: 60 },
    evidence_bindings: { decision_receipt_id: 'decision:test:v3', decision_input_version: 'sha256:decision', decision_output_version: 'decision:test:v3', live_cohort_id: 'cohort:test', playlist_receipt_id: 'taste:test', playlist_input_version: 'sha256:taste' },
    provider: { name: 'heygen_pro', model: 'heygen-image-1', mode: 'identity_remix', identity_url: 'https://example.com/id', reference_url: 'https://example.com/ref' },
  }
  return { decision, tasteReceipt, brief }
}

async function finalReceipt(overrides: Record<string, unknown> = {}, dark = false) {
  const directory = mkdtempSync(path.join(tmpdir(), 'thumbnail-quality-')); temporary.push(directory)
  const outputPath = path.join(directory, 'output.png'); const feedPreviewPath = path.join(directory, 'feed.png'); const sourceImagePath = path.join(directory, 'source.png')
  const background = dark ? '#050505' : '#00AEEF'
  await sharp({ create: { width: 1280, height: 720, channels: 3, background } }).composite([{ input: Buffer.from('<svg width="1280" height="720"><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" stroke="#fff" stroke-width="2"/></pattern><rect width="1280" height="720" fill="url(#p)"/></svg>') }]).png().toFile(outputPath)
  await sharp(outputPath).resize(320, 180).png().toFile(feedPreviewPath); await sharp(outputPath).resize(960, 720).png().toFile(sourceImagePath)
  const { decision, tasteReceipt, brief } = baseEvidence()
  const inspection = {
    version: 'youtube-thumbnail-post-generation-inspection/v1', receipt_id: 'inspection:test:v4', status: 'passed', inspection_source: 'independent_post_render_visual_inspection', campaign_id: 'test', content_version: 'v4',
    source_image_sha256: sha256(readFileSync(sourceImagePath)), final_output_sha256: sha256(readFileSync(outputPath)), feed_preview_sha256: sha256(readFileSync(feedPreviewPath)),
    face_assessment: { method: 'post_render_visual_inspection/v1', area_ratio: 0.2, visible_eye_count: 2, eyes_unobstructed: true, expression_label: 'wide-eyed expressive surprise', campaign_relevance: 'The reaction explains the decision tension.' },
    feed_copy_inspection: { method: 'rendered_320x180_visual_transcription', legible: true, transcribed_text: 'LOOK HERE' },
    face_bounding_box: { x: 800, y: 60, width: 260, height: 280 }, face_clearance_padding_px: 24,
    overlay_bounding_boxes: [{ role: 'teaser', x: 40, y: 40, width: 500, height: 180 }],
    ...overrides,
  }
  const preflightReceipt = { receipt_id: 'preflight:test', status: 'passed', brief_input_version: sha256(Buffer.from(JSON.stringify(brief))) }
  return buildFinalQualityReceipt({ brief, decision, tasteReceipt, outputPath, feedPreviewPath, sourceImagePath, inspectionReceipt: inspection, preflightReceipt })
}

describe('YouTube thumbnail v4 fail-closed quality contract', () => {
  it('blocks a missing or renderer-authored assessment', async () => expect((await finalReceipt({ inspection_source: 'renderer_hard_coded' })).status).toBe('blocked'))
  it.each(['source_image_sha256', 'final_output_sha256', 'feed_preview_sha256'])('blocks stale %s', async (field) => expect((await finalReceipt({ [field]: 'sha256:stale' })).status).toBe('blocked'))
  it('blocks the wrong feed-size teaser transcription', async () => expect((await finalReceipt({ feed_copy_inspection: { method: 'rendered_320x180_visual_transcription', legible: true, transcribed_text: 'WRONG COPY' } })).failures).toContain('feed-size teaser transcription does not match the exact teaser'))
  it('blocks a neutral expression', async () => expect((await finalReceipt({ face_assessment: { area_ratio: 0.2, visible_eye_count: 2, eyes_unobstructed: true, expression_label: 'neutral', campaign_relevance: 'This is intentionally neutral.' } })).status).toBe('blocked'))
  it('blocks a dark raster', async () => expect((await finalReceipt({}, true)).failures).toContain('final raster is too dark'))
  it('blocks an overlay that intersects the padded face box', async () => expect((await finalReceipt({ overlay_bounding_boxes: [{ role: 'teaser', x: 780, y: 80, width: 180, height: 120 }] })).failures).toContain('an overlay intersects the padded face-clearance box'))
  it('blocks stale live topic evidence before generation', () => {
    const { decision, tasteReceipt, brief } = baseEvidence(); decision.live_evidence.fresh_until = '2020-01-01T00:00:00.000Z'
    expect(validateGenerationBrief({ brief, decision, tasteReceipt }).failures).toContain('live topic outlier evidence is missing or stale')
  })
})
