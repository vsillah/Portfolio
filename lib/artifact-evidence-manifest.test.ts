import { describe, expect, it } from 'vitest'
import {
  calculateArtifactEvaluationOverall,
  validateArtifactEvaluationReceipt,
  type ArtifactEvaluationReceipt,
} from '@/lib/artifact-evidence-evaluation'
import {
  validateArtifactEvidenceManifest,
} from '@/lib/artifact-evidence-manifest'
import { completeArtifactEvidenceManifest, completeEvaluationReceipt } from '@/lib/__tests__/artifact-evidence-fixture'

const VERSION = '2026-10-15T12:00:00.000Z'
const EVALUATION_AS_OF = '2026-10-16T12:00:00.000Z'

const manifest = () => completeArtifactEvidenceManifest(VERSION)

function evaluationReceipt(): ArtifactEvaluationReceipt {
  return completeEvaluationReceipt('script_message', 'copy-script', VERSION)
}

function validateReceipt(receipt: ArtifactEvaluationReceipt) {
  return validateArtifactEvaluationReceipt(receipt, VERSION, EVALUATION_AS_OF)
}

describe('artifact evidence manifest', () => {
  it('accepts a complete version-bound manifest spanning every required artifact input', () => {
    const result = validateArtifactEvidenceManifest(manifest(), VERSION, EVALUATION_AS_OF)
    expect(result.ready).toBe(true)
    expect(result.blockers).toEqual([])
  })

  it('accepts complete 0-100 scoring with measured, heuristic, and model-judgment dimensions', () => {
    const result = validateArtifactEvidenceManifest(manifest(), VERSION, EVALUATION_AS_OF)
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

    const result = validateArtifactEvidenceManifest(candidate, VERSION, EVALUATION_AS_OF)
    expect(result.ready).toBe(false)
    expect(receipt.dimensions.outlier_pattern_fit.score).toBeNull()
    expect(result.blockers.join(' ')).toMatch(/Unscored dimensions/i)
  })

  it('fails closed when a scored benchmark cohort is stale', () => {
    const candidate = manifest()
    const receipt = candidate.elements.find((element) => element.category === 'title')!.evaluation_receipt!
    receipt.benchmark_cohort.status = 'stale'
    receipt.benchmark_cohort.fresh_until = '2026-10-14T00:00:00.000Z'
    const result = validateArtifactEvidenceManifest(candidate, VERSION, EVALUATION_AS_OF)
    expect(result.ready).toBe(false)
    expect(result.blockers.join(' ')).toMatch(/current approved benchmark cohort/i)
  })

  it('expires a cohort against the evaluation as-of time even when it was fresh at the content version', () => {
    const candidate = manifest()
    const receipt = candidate.elements.find((element) => element.category === 'title')!.evaluation_receipt!
    receipt.benchmark_cohort.fresh_until = '2026-10-16T00:00:00.000Z'

    const result = validateArtifactEvidenceManifest(candidate, VERSION, '2026-10-17T00:00:00.000Z')

    expect(Date.parse(receipt.benchmark_cohort.fresh_until!)).toBeGreaterThan(Date.parse(VERSION))
    expect(result.ready).toBe(false)
    expect(result.blockers.join(' ')).toMatch(/expired before the evaluation as-of time/i)
    expect(result.blockers.join(' ')).toMatch(/must remain Unscored|cannot be scored/i)
  })

  it('requires every deterministic score input to link to an exact safe receipt', () => {
    const candidate = manifest()
    const receipt = candidate.elements.find((element) => element.category === 'cta')!.evaluation_receipt!
    receipt.dimensions.source_support.deterministic_inputs[0].receipt_id = 'missing-receipt-link'
    const result = validateArtifactEvidenceManifest(candidate, VERSION, EVALUATION_AS_OF)
    expect(result.ready).toBe(false)
    expect(result.blockers.join(' ')).toMatch(/not linked to an exact source receipt/i)
  })

  it('fails closed when a customer-facing field loses its source, evidence, or rights binding', () => {
    const candidate = manifest()
    candidate.elements[0].authoritative_href = null
    candidate.elements[0].evidence_receipt_ids = []
    candidate.elements[0].rights_privacy_status = 'missing'
    candidate.elements[0].rights_privacy_receipt_ids = []
    const result = validateArtifactEvidenceManifest(candidate, VERSION, EVALUATION_AS_OF)
    expect(result.ready).toBe(false)
    expect(result.blockers.join(' ')).toMatch(/safe authoritative source link/i)
    expect(result.blockers.join(' ')).toMatch(/no evidence receipt/i)
    expect(result.blockers.join(' ')).toMatch(/rights\/privacy receipt/i)
  })

  it('fails closed when the artifact or one manifested element is stale', () => {
    const candidate = manifest()
    candidate.elements[1].content_version = '2026-10-15T11:59:00.000Z'
    const result = validateArtifactEvidenceManifest(candidate, '2026-10-15T12:01:00.000Z', EVALUATION_AS_OF)
    expect(result.stale).toBe(true)
    expect(result.blockers.join(' ')).toMatch(/stale/i)
  })

  it('allows private research only as a redacted review-only approved summary', () => {
    const candidate = manifest()
    const privateResearch = candidate.elements.find((element) => element.category === 'source_research')!
    expect(privateResearch.redacted).toBe(true)
    expect(privateResearch.customer_facing).toBe(false)
    expect(validateArtifactEvidenceManifest(candidate, VERSION, EVALUATION_AS_OF).ready).toBe(true)

    privateResearch.customer_facing = true
    expect(validateArtifactEvidenceManifest(candidate, VERSION, EVALUATION_AS_OF).blockers.join(' ')).toMatch(/cannot be both customer-facing and redacted/i)
  })

  it('fails the manifest when a manifested overall score drifts from the weighted calculation', () => {
    const candidate = manifest()
    const copyScript = candidate.elements.find((element) => element.category === 'copy_script')!
    copyScript.evaluation_receipt!.overall.score = 70

    const result = validateArtifactEvidenceManifest(candidate, VERSION, EVALUATION_AS_OF)

    expect(result.ready).toBe(false)
    expect(result.blockers).toEqual([
      'copy_script evidence: The overall score does not match the versioned weighted calculation.',
    ])
  })
})

describe('artifact evaluation receipt gates', () => {
  it('accepts the fixture score only when it matches the lower-is-better weighted total', () => {
    const receipt = evaluationReceipt()
    expect(calculateArtifactEvaluationOverall(receipt)).toBe(88.8)
    expect(validateReceipt(receipt)).toMatchObject({ ready: true, blockers: [] })

    receipt.overall.score = 70
    expect(validateReceipt(receipt).blockers).toEqual([
      'The overall score does not match the versioned weighted calculation.',
    ])

    receipt.overall.score = null
    expect(validateReceipt(receipt).blockers).toEqual([
      'The overall score does not match the versioned weighted calculation.',
    ])
  })

  it('fails closed when dimension weights are negative or do not total 100', () => {
    const drifted = evaluationReceipt()
    drifted.dimensions.timeliness.weight = 11
    expect(calculateArtifactEvaluationOverall(drifted)).toBeNull()
    expect(validateReceipt(drifted).blockers).toEqual([
      'Evaluation dimension weights must total 100.',
      'The overall score does not match the versioned weighted calculation.',
    ])

    const negative = evaluationReceipt()
    negative.dimensions.timeliness.weight = -1
    expect(validateReceipt(negative).blockers).toEqual([
      'timeliness has an invalid weight.',
      'Evaluation dimension weights must total 100.',
      'The overall score does not match the versioned weighted calculation.',
    ])
  })

  it('strips unsafe receipt hrefs and blocks the dimension, overall, and cohort gates', () => {
    for (const href of [
      'javascript:alert(1)',
      'https://example.com/admin/source',
      '/admin/../secrets',
      '/admin/source://open',
    ]) {
      const receipt = evaluationReceipt()
      // The fixture reuses dimension link objects on the overall score. Copy before mutating.
      const link = receipt.dimensions.source_support.source_receipts[0]
      receipt.dimensions.source_support.source_receipts = [{ ...link, href }]
      const result = validateReceipt(receipt)
      expect(result.receipt?.dimensions.source_support.source_receipts[0].href, href).toBe('')
      expect(result.ready, href).toBe(false)
      expect(result.blockers, href).toEqual([
        'source support has no safe source-receipt link for its score or rationale.',
      ])
    }

    const safe = evaluationReceipt()
    const safeLink = safe.dimensions.source_support.source_receipts[0]
    safe.dimensions.source_support.source_receipts = [{ ...safeLink, href: '  /admin/source-protocol?receipt=evidence' }]
    const safeResult = validateReceipt(safe)
    expect(safeResult.receipt?.dimensions.source_support.source_receipts[0].href).toBe('/admin/source-protocol?receipt=evidence')
    expect(safeResult.ready).toBe(true)

    const overall = evaluationReceipt()
    overall.overall.source_receipts = overall.overall.source_receipts.map((link) => ({
      ...link,
      href: 'https://evil.example/steal',
    }))
    const overallResult = validateReceipt(overall)
    expect(overallResult.receipt?.overall.source_receipts.every((link) => link.href === '')).toBe(true)
    expect(overallResult.blockers).toEqual([
      'The overall recommendation and rationale need exact safe source-receipt links.',
    ])

    const cohort = evaluationReceipt()
    cohort.benchmark_cohort.source_receipts[0].href = 'javascript:cohort'
    expect(validateReceipt(cohort).blockers).toEqual([
      'Outlier-pattern fit cannot be scored without a current approved benchmark cohort and safe receipt links.',
      'Missing, stale, or unapproved benchmark evidence must remain Unscored.',
    ])
  })

  it('rejects a scored-looking unscored dimension and keeps a null unavailable dimension from advancing', () => {
    const numbered = evaluationReceipt()
    numbered.dimensions.outlier_pattern_fit = {
      ...numbered.dimensions.outlier_pattern_fit,
      status: 'unscored',
      score: 0,
      basis: 'unavailable',
      deterministic_inputs: [],
    }
    numbered.overall = {
      ...numbered.overall,
      score: null,
      recommendation: 'hold',
      confidence_score: null,
      confidence_label: 'unscored',
    }
    expect(validateReceipt(numbered).blockers).toEqual([
      'outlier pattern fit must use Unscored with a null value when evidence is unavailable.',
      'The evaluation contains Unscored dimensions and cannot advance until approved evidence is attached.',
    ])

    const measured = evaluationReceipt()
    measured.dimensions.outlier_pattern_fit = {
      ...measured.dimensions.outlier_pattern_fit,
      status: 'unscored',
      score: null,
      basis: 'measured',
      deterministic_inputs: [],
    }
    measured.overall = numbered.overall
    expect(validateReceipt(measured).blockers).toEqual([
      'outlier pattern fit must use Unscored with a null value when evidence is unavailable.',
      'The evaluation contains Unscored dimensions and cannot advance until approved evidence is attached.',
    ])

    const held = evaluationReceipt()
    held.dimensions.outlier_pattern_fit = {
      ...held.dimensions.outlier_pattern_fit,
      status: 'unscored',
      score: null,
      basis: 'unavailable',
      deterministic_inputs: [],
    }
    held.overall = numbered.overall
    expect(validateReceipt(held)).toMatchObject({
      ready: false,
      blockers: ['The evaluation contains Unscored dimensions and cannot advance until approved evidence is attached.'],
    })
  })

  it('matches the advancement recommendation to the threshold, including an equal score', () => {
    const equal = evaluationReceipt()
    equal.overall.threshold = 88.8
    expect(validateReceipt(equal).ready).toBe(true)

    equal.overall.recommendation = 'hold'
    expect(validateReceipt(equal).blockers).toEqual([
      'The overall recommendation does not match the versioned advancement threshold.',
    ])

    const below = evaluationReceipt()
    below.overall.threshold = 95
    expect(validateReceipt(below).blockers).toEqual([
      'The overall recommendation does not match the versioned advancement threshold.',
    ])
    below.overall.recommendation = 'revise'
    expect(validateReceipt(below).ready).toBe(true)
    below.overall.recommendation = 'hold'
    expect(validateReceipt(below).ready).toBe(true)

    const openFloor = evaluationReceipt()
    openFloor.overall.threshold = 0
    expect(validateReceipt(openFloor).ready).toBe(true)

    const closedCeiling = evaluationReceipt()
    closedCeiling.overall.threshold = 100
    closedCeiling.overall.recommendation = 'hold'
    expect(validateReceipt(closedCeiling).ready).toBe(true)
  })

  it('rejects an overall threshold outside 0-100', () => {
    const low = evaluationReceipt()
    low.overall.threshold = -1
    expect(validateReceipt(low).blockers).toEqual([
      'The overall recommendation threshold must be between 0 and 100.',
    ])

    const high = evaluationReceipt()
    high.overall.threshold = 101
    high.overall.recommendation = 'hold'
    expect(validateReceipt(high).blockers).toEqual([
      'The overall recommendation threshold must be between 0 and 100.',
    ])
  })

  it('rejects a benchmark rank that is not a positive integer inside the cohort', () => {
    for (const rank of [
      { position: 0, total: 12 },
      { position: 1.5, total: 12 },
      { position: 13, total: 12 },
      { position: 2, total: 1 },
    ]) {
      const receipt = evaluationReceipt()
      receipt.dimensions.outlier_pattern_fit.rank = rank
      const result = validateReceipt(receipt)
      expect(result.ready, JSON.stringify(rank)).toBe(false)
      expect(result.blockers, JSON.stringify(rank)).toEqual([
        'outlier pattern fit has an invalid benchmark rank.',
      ])
    }

    const first = evaluationReceipt()
    first.dimensions.outlier_pattern_fit.rank = { position: 1, total: 1 }
    expect(validateReceipt(first).ready).toBe(true)

    const unranked = evaluationReceipt()
    unranked.dimensions.outlier_pattern_fit.rank = null
    expect(validateReceipt(unranked).ready).toBe(true)
  })
})
