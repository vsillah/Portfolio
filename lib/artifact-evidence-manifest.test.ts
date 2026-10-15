import { describe, expect, it } from 'vitest'
import {
  validateArtifactEvidenceManifest,
} from '@/lib/artifact-evidence-manifest'
import { completeArtifactEvidenceManifest } from '@/lib/__tests__/artifact-evidence-fixture'

const VERSION = '2026-10-15T12:00:00.000Z'

const manifest = () => completeArtifactEvidenceManifest(VERSION)

describe('artifact evidence manifest', () => {
  it('accepts a complete version-bound manifest spanning every required artifact input', () => {
    const result = validateArtifactEvidenceManifest(manifest(), VERSION)
    expect(result.ready).toBe(true)
    expect(result.blockers).toEqual([])
  })

  it('accepts complete 0-100 scoring with measured, heuristic, and model-judgment dimensions', () => {
    const result = validateArtifactEvidenceManifest(manifest(), VERSION)
    const receipt = result.manifest?.elements.find((element) => element.category === 'copy_script')?.evaluation_receipt
    expect(result.ready).toBe(true)
    expect(receipt?.overall).toMatchObject({ score: 88.8, recommendation: 'advance', confidence_score: 91 })
    expect(new Set(Object.values(receipt!.dimensions).map((dimension) => dimension.basis))).toEqual(new Set(['measured', 'heuristic', 'model_judgment']))
  })

  it('keeps missing benchmark evidence Unscored and blocks advancement without treating it as zero', () => {
    const candidate = manifest()
    const receipt = candidate.elements.find((element) => element.category === 'copy_script')!.evaluation_receipt!
    receipt.benchmark_cohort = { cohort_id: null, status: 'missing', sample_size: null, observed_from: null, observed_to: null, fresh_until: null, source_receipts: [] }
    receipt.dimensions.outlier_pattern_fit = { ...receipt.dimensions.outlier_pattern_fit, status: 'unscored', score: null, basis: 'unavailable', deterministic_inputs: [], rationale: 'Unscored: the linked research receipt has no approved comparable cohort.' }
    receipt.overall = { score: null, threshold: 75, recommendation: 'hold', confidence_score: null, confidence_label: 'unscored', rationale: 'Hold until the benchmark cohort is approved.', source_receipts: receipt.overall.source_receipts }

    const result = validateArtifactEvidenceManifest(candidate, VERSION)
    expect(result.ready).toBe(false)
    expect(receipt.dimensions.outlier_pattern_fit.score).toBeNull()
    expect(result.blockers.join(' ')).toMatch(/Unscored dimensions/i)
  })

  it('fails closed when a scored benchmark cohort is stale', () => {
    const candidate = manifest()
    const receipt = candidate.elements.find((element) => element.category === 'title')!.evaluation_receipt!
    receipt.benchmark_cohort.status = 'stale'
    receipt.benchmark_cohort.fresh_until = '2026-10-14T00:00:00.000Z'
    const result = validateArtifactEvidenceManifest(candidate, VERSION)
    expect(result.ready).toBe(false)
    expect(result.blockers.join(' ')).toMatch(/current approved benchmark cohort/i)
  })

  it('requires every deterministic score input to link to an exact safe receipt', () => {
    const candidate = manifest()
    const receipt = candidate.elements.find((element) => element.category === 'cta')!.evaluation_receipt!
    receipt.dimensions.source_support.deterministic_inputs[0].receipt_id = 'missing-receipt-link'
    const result = validateArtifactEvidenceManifest(candidate, VERSION)
    expect(result.ready).toBe(false)
    expect(result.blockers.join(' ')).toMatch(/not linked to an exact source receipt/i)
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
