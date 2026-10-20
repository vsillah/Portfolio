import { describe, expect, it } from 'vitest'
import heroReceipt from '@/artifacts/research/jev-hero-thumbnail-candidates-2026-10-19/receipt.json'
import { validateYouTubeThumbnailHeroEvidence } from '@/lib/youtube-thumbnail-hero-evidence'

const CONTENT_VERSION = 'sha256:392b3e2a92c5ab65e4cc93706571df761bac7ea38631bf06002fd6b89f3302a2'
const AS_OF = '2026-10-20T12:00:00.000Z'
const receipt = () => structuredClone(heroReceipt) as any

describe('YouTube thumbnail hero evidence', () => {
  it('accepts the two authorized campaign-specific integrated generations', () => {
    const result = validateYouTubeThumbnailHeroEvidence(receipt(), CONTENT_VERSION, AS_OF)
    expect(result).toEqual({ ready: true, fixture_ready: true, blockers: [], recovery_actions: [] })
  })

  it('fails closed when a candidate-specific generated hero is missing', () => {
    const value = receipt(); value.hero_assets.splice(0, 1)
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.fixture_ready).toBe(false)
    expect(result.blockers).toContain('Every candidate needs its own newly generated campaign-specific hero asset.')
  })

  it('rejects exact-photo output reuse', () => {
    const value = receipt(); value.hero_assets[0].output_sha256 = value.generation_request.identity_reference.sha256; value.candidates[0].hero_binding.hero_output_sha256 = value.hero_assets[0].output_sha256
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).blockers).toContain(`${value.hero_assets[0].asset_id} reuses the exact identity-reference photo as output.`)
  })

  it('fails closed when live outlier evidence or generated heroes are stale', () => {
    const value = receipt(); value.outlier_evidence.fresh_until = '2026-10-19T11:59:59.000Z'; value.hero_assets[0].fresh_until = '2026-10-19T11:59:59.000Z'
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining(['The topic-specific YouTube outlier evidence is missing or stale.', `${value.hero_assets[0].asset_id} is stale or missing generation freshness.`]))
  })

  it('rejects cross-campaign inheritance and missing generator provenance', () => {
    const value = receipt(); value.hero_assets[0].campaign_identity = 'other'; value.hero_assets[0].generator_id = ''
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.fixture_ready).toBe(false)
    expect(result.blockers.join(' ')).toMatch(/version-bound|generator/)
  })

  it('rejects perceptually repeated heroes and full compositions', () => {
    const value = receipt(); value.hero_assets[1].perceptual_hash = value.hero_assets[0].perceptual_hash; value.candidates[1].perceptual_hash = value.candidates[0].perceptual_hash
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining(['The candidate set reuses the same hero output or perceptual likeness.', 'The candidate set does not contain materially distinct integrated scene directions.', 'The candidate compositions are perceptually too similar.']))
  })

  it('rejects generic side-by-side and hard split layouts', () => {
    const value = receipt(); value.candidates[0].layout_family = 'portrait-plus-screenshot-side-by-side'; value.candidates[0].integration.hard_split_panel = true
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining([expect.stringContaining('prohibited generic, split-panel, or side-by-side'), expect.stringContaining('integrated hero-and-product scene')]))
  })

  it('rejects floating assets, mismatched visual treatment, blur reuse, removable story parts, and harmful overlap', () => {
    const value = receipt(); Object.assign(value.candidates[0].integration, { lighting_consistent: false, perspective_consistent: false, color_grade_consistent: false, asset_floats_independently: true, blur_masks_reuse: true, hero_removal_breaks_story: false, asset_removal_breaks_story: false, face_overlap_harm: true })
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).blockers).toContain(`${value.candidates[0].candidate_id} does not prove an integrated hero-and-product scene.`)
  })

  it('rejects missing generation request or candidate provenance', () => {
    const value = receipt(); delete value.generation_request; delete value.hero_assets[0].likeness_receipt_id
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining(['The campaign-specific generation request is missing or not version-bound.', `${value.hero_assets[0].asset_id} lacks provenance, likeness, rights, or privacy evidence.`]))
  })

  it.each(['REVIEW ONLY', 'draft', 'fixture', 'sample data', 'operator', 'internal', 'prompt', 'QA'])('rejects internal marker %s from exported pixels', (marker) => {
    const value = receipt(); value.candidates[0].customer_facing_copy.push(marker)
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).blockers).toContain(`${value.candidates[0].candidate_id} contains internal workflow language in customer-facing pixels.`)
  })
})
