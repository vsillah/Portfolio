import { describe, expect, it } from 'vitest'
import {
  ARTIFACT_EVIDENCE_CATEGORIES,
  validateArtifactEvidenceManifest,
  type ArtifactEvidenceManifest,
} from '@/lib/artifact-evidence-manifest'

const VERSION = '2026-10-15T12:00:00.000Z'

function manifest(): ArtifactEvidenceManifest {
  return {
    version: 'artifact-evidence-manifest/v1',
    manifest_id: 'artifact-manifest:test:v1',
    manifest_hash: `sha256:${'a'.repeat(64)}`,
    content_version: VERSION,
    artifact_label: 'Test artifact',
    preview_url: '/review-assets/social-content/test.png',
    preview_alt: 'Test artifact preview',
    final_output_hashes: [{ label: 'MP4', sha256: 'b'.repeat(64) }],
    elements: ARTIFACT_EVIDENCE_CATEGORIES.map((category, index) => ({
      id: `${category}-${index}`,
      category,
      label: category,
      input_excerpt: `Bounded ${category} input`,
      customer_facing: category !== 'source_research' && category !== 'transformation',
      review_only: category === 'source_research' || category === 'transformation',
      redacted: category === 'source_research',
      source_identity: `source:${category}`,
      source_record_type: category === 'source_research' ? 'open_brain_approved_memory' : 'portfolio_source_record',
      authoritative_href: `/admin/source-protocol?receipt=${category}`,
      evidence_receipt_ids: [`evidence:${category}`],
      version_hash: `sha256:${'c'.repeat(64)}`,
      content_version: VERSION,
      rights_privacy_status: 'passed',
      rights_privacy_receipt_ids: [`rights:${category}`],
      transformation_step: `Bind ${category} into the final artifact.`,
      ...(index < 3 ? { region: { x: 20 + index * 20, y: 30 } } : {}),
    })),
  }
}

describe('artifact evidence manifest', () => {
  it('accepts a complete version-bound manifest spanning every required artifact input', () => {
    const result = validateArtifactEvidenceManifest(manifest(), VERSION)
    expect(result.ready).toBe(true)
    expect(result.blockers).toEqual([])
  })

  it('fails closed when a customer-facing field loses its source, evidence, or rights binding', () => {
    const candidate = manifest()
    candidate.elements[0].authoritative_href = null
    candidate.elements[0].evidence_receipt_ids = []
    candidate.elements[0].rights_privacy_status = 'missing'
    candidate.elements[0].rights_privacy_receipt_ids = []
    const result = validateArtifactEvidenceManifest(candidate, VERSION)
    expect(result.ready).toBe(false)
    expect(result.blockers.join(' ')).toMatch(/safe authoritative source link/i)
    expect(result.blockers.join(' ')).toMatch(/no evidence receipt/i)
    expect(result.blockers.join(' ')).toMatch(/rights\/privacy receipt/i)
  })

  it('fails closed when the artifact or one manifested element is stale', () => {
    const candidate = manifest()
    candidate.elements[1].content_version = '2026-10-15T11:59:00.000Z'
    const result = validateArtifactEvidenceManifest(candidate, '2026-10-15T12:01:00.000Z')
    expect(result.stale).toBe(true)
    expect(result.blockers.join(' ')).toMatch(/stale/i)
  })

  it('allows private research only as a redacted review-only approved summary', () => {
    const candidate = manifest()
    const privateResearch = candidate.elements.find((element) => element.category === 'source_research')!
    expect(privateResearch.redacted).toBe(true)
    expect(privateResearch.customer_facing).toBe(false)
    expect(validateArtifactEvidenceManifest(candidate, VERSION).ready).toBe(true)

    privateResearch.customer_facing = true
    expect(validateArtifactEvidenceManifest(candidate, VERSION).blockers.join(' ')).toMatch(/cannot be both customer-facing and redacted/i)
  })
})
