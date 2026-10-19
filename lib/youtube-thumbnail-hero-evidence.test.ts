import { describe, expect, it } from 'vitest'
import heroReceipt from '@/artifacts/research/jev-hero-thumbnail-candidates-2026-10-19/receipt.json'
import { validateYouTubeThumbnailHeroEvidence } from '@/lib/youtube-thumbnail-hero-evidence'

const CONTENT_VERSION = 'sha256:392b3e2a92c5ab65e4cc93706571df761bac7ea38631bf06002fd6b89f3302a2'
const AS_OF = '2026-10-20T12:00:00.000Z'

function receipt() {
  return structuredClone(heroReceipt)
}

describe('YouTube thumbnail hero evidence', () => {
  it('accepts the exact current Jev hero-led review batch', () => {
    const result = validateYouTubeThumbnailHeroEvidence(receipt(), CONTENT_VERSION, AS_OF)
    expect(result).toEqual({ ready: true, blockers: [], recovery_actions: [] })
  })

  it('fails closed when the campaign-specific hero asset is missing', () => {
    const value = receipt() as any
    delete value.hero_asset
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('A campaign-specific thumbnail hero asset is required.')
  })

  it('fails closed when live outlier evidence is stale', () => {
    const value = receipt() as any
    value.outlier_evidence.fresh_until = '2026-10-19T11:59:59.000Z'
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('The topic-specific YouTube outlier evidence is missing or stale.')
  })

  it('fails closed when no included comparison qualifies at the declared threshold', () => {
    const value = receipt() as any
    value.outlier_evidence.qualified_outlier_video_ids = []
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('The live YouTube cohort has no attributable outlier at the declared threshold.')
  })

  it('fails closed for generic hero or template signals', () => {
    const value = receipt() as any
    value.hero_asset.generic = true
    value.candidates[0].layout_family = 'generic-fallback-dashboard'
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.ready).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Generic or unclassified hero imagery cannot advance.',
      expect.stringContaining('prohibited generic composition identity'),
    ]))
  })

  it('fails closed when a candidate is not bound to the exact hero or output hash', () => {
    const value = receipt() as any
    value.candidates[0].hero_binding.hero_asset_id = 'hero:unbound'
    value.candidates[0].hero_binding.output_sha256 = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('thumbnail:jev:hero-question:20261019:v1 is not bound to the exact hero source and output hash.')
  })
})
