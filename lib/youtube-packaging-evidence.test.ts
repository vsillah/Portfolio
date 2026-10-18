import { describe, expect, it } from 'vitest'
import { completeArtifactEvidenceManifest } from '@/lib/__tests__/artifact-evidence-fixture'
import { validateYouTubePackagingEvidence } from '@/lib/artifact-evidence-manifest'
import { channelNativeVideoQaFixture } from '@/lib/social-channel-video-qa-fixture'

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

  it('accepts only the verified 9:16 Jev candidate with complete first-party element bindings', () => {
    const fixture = channelNativeVideoQaFixture('f966123f-05eb-48ec-a7c2-970afce642ef')
    const result = validateYouTubePackagingEvidence(fixture.rag_context.artifact_evidence_manifest, fixture.updated_at, 'youtube_shorts', '2026-10-18T20:00:00.000Z')
    const research = result.thumbnail?.research_cohort

    expect(result.ready).toBe(true)
    expect(research?.candidate).toMatchObject({ width: 1080, height: 1920, aspect_ratio: '9:16', link_status: 'verified_openable' })
    expect(research?.element_bindings.map((binding) => binding.element).sort()).toEqual(['aspect_ratio', 'brand_treatment', 'hook', 'product_proof', 'subject'])
    expect(research?.element_bindings.every((binding) => binding.support === 'supports' && binding.link_status === 'verified_openable')).toBe(true)
    expect(research?.samples.every((sample) => sample.youtube_url.startsWith('https://') && sample.source_thumbnail_url?.startsWith('https://'))).toBe(true)
    expect(research?.candidate_copy_pair).toMatchObject({ relationship: 'near_duplicate', exact_strings_are_distinct: true })
    expect(research?.candidate_copy_pair.title).toBe(result.title?.input_excerpt)
    expect(research?.candidate_copy_pair.thumbnail_hook).toBe(result.thumbnail?.input_excerpt)
    expect(research?.candidate_copy_pair.title).not.toBe(research?.candidate_copy_pair.thumbnail_hook)
    expect(research?.copy_pair_analysis).toMatchObject({ status: 'unscored', conclusion: 'unscored_insufficient_group_samples' })
    expect(research?.copy_pair_analysis.distinct_group).toMatchObject({ sample_size: 2, minimum_sample_size: 3 })
    expect(research?.samples.filter((sample) => sample.decision === 'included').every((sample) => sample.transcription_provenance && sample.hook_type && sample.channel_baseline_size)).toBe(true)
  })

  it('fails closed for landscape candidates, broken evidence links, missing bindings, or unsupported public-outlier claims', () => {
    const fixture = channelNativeVideoQaFixture('f966123f-05eb-48ec-a7c2-970afce642ef')
    const manifest = structuredClone(fixture.rag_context.artifact_evidence_manifest)
    const thumbnail = manifest.elements.find((element) => element.category === 'thumbnail')!
    const research = thumbnail.research_cohort!
    research.candidate = { ...research.candidate!, width: 1280, height: 720, aspect_ratio: '16:9' }
    research.element_bindings = research.element_bindings.filter((binding) => binding.element !== 'product_proof')
    research.first_party_neighbors[0].link_status = 'blocked'
    research.samples.find((sample) => sample.outlier_qualified)!.supports_candidate_composition = true

    const result = validateYouTubePackagingEvidence(manifest, fixture.updated_at, 'youtube_shorts', '2026-10-18T20:00:00.000Z')

    expect(result.ready).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'YouTube Short thumbnail evidence must bind an exact 1080×1920 9:16 candidate.',
      'Thumbnail evidence is missing verified supporting bindings for: product_proof.',
      expect.stringContaining('blocked or missing source links'),
      'A qualified public outlier is incorrectly marked as supporting the candidate composition.',
    ]))
  })

  it('fails closed for identical copy bindings, missing transcription provenance, and unsupported distinct-pair conclusions', () => {
    const fixture = channelNativeVideoQaFixture('f966123f-05eb-48ec-a7c2-970afce642ef')
    const manifest = structuredClone(fixture.rag_context.artifact_evidence_manifest)
    const thumbnail = manifest.elements.find((element) => element.category === 'thumbnail')!
    const research = thumbnail.research_cohort!
    research.candidate_copy_pair.thumbnail_hook = research.candidate_copy_pair.title
    research.candidate_copy_pair.exact_strings_are_distinct = false
    research.candidate_copy_pair.relationship = 'complementary_teaser'
    research.copy_pair_analysis.status = 'scored'
    research.copy_pair_analysis.conclusion = 'supports_distinct_pair'
    const firstIncluded = research.samples.find((sample) => sample.decision === 'included')!
    firstIncluded.transcription_provenance = null
    firstIncluded.title_thumbnail_relationship = undefined as never

    const result = validateYouTubePackagingEvidence(manifest, fixture.updated_at, 'youtube_shorts', '2026-10-18T20:00:00.000Z')

    expect(result.ready).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('missing required copy-pair evidence'),
      'Copy-pair performance group sample sizes do not match the classified live sources.',
      'The copy-pair heuristic claims a scored conclusion without sufficient samples in both comparison groups.',
      'The candidate title and thumbnail hook must be bound as two non-identical exact strings.',
      'The candidate copy-pair binding does not match the current title and thumbnail hook.',
    ]))
  })

  it('fails closed rather than inferring text from an unreadable thumbnail', () => {
    const fixture = channelNativeVideoQaFixture('f966123f-05eb-48ec-a7c2-970afce642ef')
    const manifest = structuredClone(fixture.rag_context.artifact_evidence_manifest)
    const sample = manifest.elements.find((element) => element.category === 'thumbnail')!.research_cohort!.samples.find((entry) => entry.thumbnail_text_transcription_status === 'unreadable')!
    sample.thumbnail_text = ['guessed copy']

    const result = validateYouTubePackagingEvidence(manifest, fixture.updated_at, 'youtube_shorts', '2026-10-18T20:00:00.000Z')

    expect(result.ready).toBe(false)
    expect(result.blockers).toContain(`Unreadable thumbnail copy was inferred for: ${sample.video_id}.`)
  })
})
