import { describe, expect, it } from 'vitest'
import { completeArtifactEvidenceManifest } from '@/lib/__tests__/artifact-evidence-fixture'
import { validateYouTubePackagingEvidence } from '@/lib/artifact-evidence-manifest'

const VERSION = '2026-10-15T12:00:00.000Z'
const AS_OF = '2026-10-16T12:00:00.000Z'

function packagingManifest() {
  const manifest = completeArtifactEvidenceManifest(VERSION)
  const title = manifest.elements.find((element) => element.category === 'title')!
  const thumbnail = manifest.elements.find((element) => element.category === 'thumbnail')!
  title.input_excerpt = 'AI Gave You a Score. Who Owns the Decision?'
  thumbnail.input_excerpt = 'WHO OWNS THE DECISION?'
  thumbnail.artifact_url = '/review-assets/social-content/jev-youtube-thumbnail.png'
  return manifest
}

describe('YouTube packaging evidence validation', () => {
  it.each(['youtube', 'youtube_shorts'] as const)('requires one scored, version-bound title and actual thumbnail for %s', (target) => {
    const result = validateYouTubePackagingEvidence(packagingManifest(), VERSION, target, AS_OF)

    expect(result).toMatchObject({ ready: true, pairBound: true, target })
    expect(result.title?.input_excerpt).toBe('AI Gave You a Score. Who Owns the Decision?')
    expect(result.thumbnail).toMatchObject({
      input_excerpt: 'WHO OWNS THE DECISION?',
      artifact_url: '/review-assets/social-content/jev-youtube-thumbnail.png',
    })
  })

  it('fails closed with a specific recovery action when the actual thumbnail is absent', () => {
    const manifest = packagingManifest()
    const thumbnail = manifest.elements.find((element) => element.category === 'thumbnail')!
    thumbnail.artifact_url = null

    const result = validateYouTubePackagingEvidence(manifest, VERSION, 'youtube_shorts', AS_OF)

    expect(result.ready).toBe(false)
    expect(result.pairBound).toBe(false)
    expect(result.blockers).toContain('Thumbnail evidence is missing its actual bound review asset.')
    expect(result.recoveryActions).toContain('Restore the versioned thumbnail file and receipt binding, then rebuild the asset-package review. A brief or poster alone is not sufficient.')
  })

  it('fails stale, ambiguous, unbound, and unscored title or thumbnail evidence', () => {
    const manifest = packagingManifest()
    const title = manifest.elements.find((element) => element.category === 'title')!
    const thumbnail = manifest.elements.find((element) => element.category === 'thumbnail')!
    title.content_version = '2026-10-14T12:00:00.000Z'
    title.authoritative_href = null
    thumbnail.evaluation_receipt!.dimensions.outlier_pattern_fit.status = 'unscored'
    thumbnail.evaluation_receipt!.dimensions.outlier_pattern_fit.score = null
    thumbnail.evaluation_receipt!.dimensions.outlier_pattern_fit.basis = 'unavailable'
    thumbnail.evaluation_receipt!.overall.score = null
    thumbnail.evaluation_receipt!.overall.recommendation = 'hold'
    thumbnail.evaluation_receipt!.overall.confidence_score = null
    thumbnail.evaluation_receipt!.overall.confidence_label = 'unscored'
    manifest.elements.push({ ...title, id: 'second-current-title' })

    const result = validateYouTubePackagingEvidence(manifest, VERSION, 'youtube', AS_OF)

    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('Customer-facing title evidence is ambiguous because more than one title is marked current.')
    expect(result.blockers).toContain('Thumbnail evidence: The evaluation contains Unscored dimensions and cannot advance until approved evidence is attached.')
    expect(result.recoveryActions).toEqual(expect.arrayContaining([
      expect.stringContaining('exactly one current customer-facing title'),
      expect.stringContaining('thumbnail scorecard blockers'),
    ]))
  })
})
