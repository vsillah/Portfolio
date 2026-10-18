import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { analyzeSpatialLayout, analyzeThumbnailRaster, buildFinalQualityReceipt, sha256, validateGenerationBrief } from './youtube-thumbnail-quality-contract.mjs'

const temporary: string[] = []
afterEach(() => temporary.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })))

function baseEvidence() {
  const decision = {
    receipt_id: 'decision:test:v4', input_version: 'sha256:decision', output_version: 'decision:test:v4',
    candidate_identity: { product_proof_receipt_id: 'sha256:proof' },
    live_evidence: { cohort_id: 'cohort:test', fresh_until: '2999-01-01T00:00:00.000Z', outlier_threshold: 1.5, comparisons: [{ decision: 'included', outlier_qualified: true, normalized_performance_score: 2 }] },
    user_preference_signals: [{ performance_weight: 0, evidence_role: 'taste_calibration_only', performance_status: 'unscored', item_identities: ['a'] }],
  }
  const brief = {
    brief_id: 'brief:test:v5', campaign_id: 'test', content_version: 'v5', title: 'A Different Long Title', teaser_copy: 'LOOK HERE',
    lighting: { direction: 'front', brightness_target: 0.6 }, palette: ['#061426', '#00b8d9', '#f5c518'], expression: { label: 'wide-eyed surprise', campaign_relevance: 'Shows the decision tension clearly.' },
    face_prominence: { target_area_ratio: 0.2 }, dominant_focal_point: 'expressive person', title_copy_contrast: { title: 'A Different Long Title', thumbnail: 'LOOK HERE', relationship: 'adds tension' },
    product_proof: { receipt_id: 'sha256:proof' }, one_second_read: { status: 'pass' }, feed_size_plan: { width: 320, height: 180, minimum_font_px_at_1280: 60 },
    color_polish_plan: { dominant_field: 'cyan', accent_family: 'gold', contrast_field: 'ink', subject_separation: 'peach against cyan', product_separation: 'cream against ink', background_complexity: 'solid field' },
    evidence_bindings: { decision_receipt_id: 'decision:test:v4', decision_input_version: 'sha256:decision', decision_output_version: 'decision:test:v4', live_cohort_id: 'cohort:test', playlist_receipt_id: 'taste:test', playlist_input_version: 'sha256:taste' },
    provider: { name: 'heygen_pro', model: 'heygen-image-1', mode: 'identity_remix', identity_url: 'https://example.com/id', reference_url: 'https://example.com/ref', new_call_authorized: false },
  }
  return { decision, brief }
}

type Variant = 'clean' | 'pastel' | 'weak-text' | 'low-subject' | 'busy'

async function finalReceipt(overrides: Record<string, unknown> = {}, variant: Variant = 'clean') {
  const directory = mkdtempSync(path.join(tmpdir(), 'thumbnail-quality-')); temporary.push(directory)
  const outputPath = path.join(directory, 'output.png'); const feedPreviewPath = path.join(directory, 'feed.png'); const sourceImagePath = path.join(directory, 'source.png')
  const cyan = variant === 'pastel' ? '#b8ced3' : '#00b8d9'
  const subject = variant === 'low-subject' ? cyan : '#ef9d72'
  const text = variant === 'weak-text' ? '#314254' : '#f8fafc'
  const backgroundPattern = variant === 'busy' ? '<pattern id="busy" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="8" fill="#f8fafc"/><rect x="4" width="4" height="8" fill="#061426"/></pattern><rect x="200" y="300" width="220" height="100" fill="url(#busy)"/>' : ''
  const svg = `<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="720" fill="#061426"/><rect x="640" width="640" height="720" fill="${cyan}"/>${backgroundPattern}<rect x="60" y="40" width="120" height="16" fill="#f5c518"/><rect x="60" y="80" width="420" height="150" fill="${text}"/><rect x="800" y="100" width="300" height="320" fill="${subject}"/><rect x="60" y="500" width="480" height="130" fill="#f5c518"/><rect x="78" y="518" width="444" height="94" fill="#f8fafc"/></svg>`
  await sharp(Buffer.from(svg)).png().toFile(outputPath)
  await sharp(outputPath).resize(320, 180).png().toFile(feedPreviewPath)
  await sharp({ create: { width: 960, height: 720, channels: 3, background: '#ef9d72' } }).png().toFile(sourceImagePath)
  const { decision, brief } = baseEvidence()
  const metrics = await analyzeThumbnailRaster(outputPath)
  const spatial = await analyzeSpatialLayout(outputPath)
  const tasteReceipt = { receipt_id: 'taste:test', input_version: 'sha256:taste', status: 'ready', references: [{ metrics, spatial_layout: spatial }] }
  const inspection = {
    version: 'youtube-thumbnail-post-generation-inspection/v1', receipt_id: 'inspection:test:v5', status: 'passed', inspection_source: 'independent_post_render_visual_inspection', campaign_id: 'test', content_version: 'v5',
    source_image_sha256: sha256(readFileSync(sourceImagePath)), final_output_sha256: sha256(readFileSync(outputPath)), feed_preview_sha256: sha256(readFileSync(feedPreviewPath)),
    face_assessment: { method: 'post_render_visual_inspection/v1', area_ratio: 0.2, visible_eye_count: 2, eyes_unobstructed: true, expression_label: 'wide-eyed expressive surprise', campaign_relevance: 'The reaction explains the decision tension.' },
    feed_copy_inspection: { method: 'rendered_320x180_visual_transcription', legible: true, transcribed_text: 'LOOK HERE' },
    feed_focal_hierarchy: { status: 'passed', ordered_roles: ['hook', 'subject', 'proof'] },
    color_polish_regions: {
      foreground: { x: 820, y: 120, width: 100, height: 100 }, background: { x: 200, y: 300, width: 220, height: 100 },
      text_foreground: { x: 80, y: 100, width: 100, height: 100 }, text_panel_background: { x: 200, y: 250, width: 100, height: 40 },
      subject: { x: 820, y: 120, width: 100, height: 100 }, subject_background: { x: 680, y: 120, width: 80, height: 100 },
      product_proof: { x: 100, y: 530, width: 360, height: 60 }, product_background: { x: 200, y: 650, width: 200, height: 40 },
      dominant_field: { x: 680, y: 450, width: 400, height: 180 }, accent: { x: 70, y: 42, width: 100, height: 12 },
    },
    face_bounding_box: { x: 800, y: 100, width: 300, height: 320 }, face_clearance_padding_px: 24,
    overlay_bounding_boxes: [{ role: 'teaser', x: 60, y: 80, width: 420, height: 150 }],
    ...overrides,
  }
  const preflightReceipt = { receipt_id: 'preflight:test', status: 'passed', brief_input_version: sha256(Buffer.from(JSON.stringify(brief))) }
  return buildFinalQualityReceipt({ brief, decision, tasteReceipt, outputPath, feedPreviewPath, sourceImagePath, inspectionReceipt: inspection, preflightReceipt })
}

describe('YouTube thumbnail v5 fail-closed color-polish contract', () => {
  it('passes a controlled, high-contrast exact raster', async () => expect((await finalReceipt()).status).toBe('passed'))
  it('blocks a missing or renderer-authored assessment', async () => expect((await finalReceipt({ inspection_source: 'renderer_hard_coded' })).status).toBe('blocked'))
  it.each(['source_image_sha256', 'final_output_sha256', 'feed_preview_sha256'])('blocks stale %s', async (field) => expect((await finalReceipt({ [field]: 'sha256:stale' })).status).toBe('blocked'))
  it('blocks the wrong feed-size teaser transcription', async () => expect((await finalReceipt({ feed_copy_inspection: { method: 'rendered_320x180_visual_transcription', legible: true, transcribed_text: 'WRONG COPY' } })).failures).toContain('feed-size teaser transcription does not match the exact teaser'))
  it('blocks a neutral expression', async () => expect((await finalReceipt({ face_assessment: { area_ratio: 0.2, visible_eye_count: 2, eyes_unobstructed: true, expression_label: 'neutral', campaign_relevance: 'This is intentionally neutral.' } })).status).toBe('blocked'))
  it('blocks an overlay that intersects the padded face box', async () => expect((await finalReceipt({ overlay_bounding_boxes: [{ role: 'teaser', x: 780, y: 80, width: 180, height: 120 }] })).failures).toContain('an overlay intersects the padded face-clearance box'))
  it('rejects pastel washout even when global averages otherwise look acceptable', async () => expect((await finalReceipt({}, 'pastel')).failures).toContain('dominant or accent palette lacks strength'))
  it('rejects weak text contrast', async () => expect((await finalReceipt({}, 'weak-text')).failures).toContain('text-panel contrast is too weak'))
  it('rejects low subject separation', async () => expect((await finalReceipt({}, 'low-subject')).failures).toContain('subject/background separation is too weak'))
  it('rejects a busy background', async () => expect((await finalReceipt({}, 'busy')).failures).toContain('background is visually busy'))
  it('blocks stale live topic evidence before generation', () => {
    const { decision, brief } = baseEvidence(); decision.live_evidence.fresh_until = '2020-01-01T00:00:00.000Z'
    const tasteReceipt = { receipt_id: 'taste:test', input_version: 'sha256:taste', status: 'ready', references: [{}] }
    expect(validateGenerationBrief({ brief, decision, tasteReceipt }).failures).toContain('live topic outlier evidence is missing or stale')
  })
})
