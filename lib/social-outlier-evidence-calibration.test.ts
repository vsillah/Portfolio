import { describe, expect, it } from 'vitest'
import {
  OUTLIER_EVIDENCE_DIMENSIONS,
  OUTLIER_EVIDENCE_MODEL_VERSION,
  audienceSizeBand,
  evaluateOutlierEvidenceCalibration,
  outlierEvidenceCalibrationQaFixture,
  type OutlierEvidenceCalibrationInput,
} from './social-outlier-evidence-calibration'

function withUniformSignals(candidate: number, cohort: number[]): OutlierEvidenceCalibrationInput {
  const input = outlierEvidenceCalibrationQaFixture('ready')
  input.candidate.signals = { ...input.candidate.signals }
  for (const dimension of OUTLIER_EVIDENCE_DIMENSIONS) {
    input.candidate.signals[dimension] = candidate
    input.cohort.forEach((source, index) => {
      source.signals = { ...source.signals, [dimension]: cohort[index] }
    })
  }
  return input
}

describe('outlier evidence calibration', () => {
  it('scores a normalized attributable cohort deterministically', () => {
    const input = outlierEvidenceCalibrationQaFixture('ready')
    const first = evaluateOutlierEvidenceCalibration(input)
    const second = evaluateOutlierEvidenceCalibration({
      ...input,
      cohort: [...input.cohort].reverse(),
    })

    expect(first).toMatchObject({
      model_version: OUTLIER_EVIDENCE_MODEL_VERSION,
      status: 'scored',
      normalization: {
        channel: 'linkedin',
        format: 'single_image',
        audience_band: 'emerging',
        freshness_days: 90,
        minimum_sample_size: 3,
      },
    })
    expect(first.overall_score).toBeTypeOf('number')
    expect(first.dimensions).toHaveLength(10)
    expect(first.dimensions.every((dimension) => dimension.sample_size === 4)).toBe(true)
    expect(first.input_fingerprint).toBe(second.input_fingerprint)
    expect(first.dimensions).toEqual(second.dimensions)
  })

  it.each(['missing', 'stale', 'unauthorized'] as const)(
    'fails closed with Unscored dimensions for %s evidence',
    (state) => {
      const evaluation = evaluateOutlierEvidenceCalibration(outlierEvidenceCalibrationQaFixture(state))

      expect(evaluation.status).toBe('unscored')
      expect(evaluation.overall_score).toBeNull()
      expect(evaluation.blockers.length).toBeGreaterThan(0)
      if (state === 'missing') {
        expect(evaluation.dimensions.find((dimension) => dimension.dimension === 'product_evidence')).toMatchObject({
          status: 'unscored',
          score: null,
        })
      } else {
        expect(evaluation.included_sources).toHaveLength(0)
        expect(evaluation.excluded_sources).toHaveLength(4)
      }
    },
  )

  it('excludes mismatched channel, format, audience band, and recency inputs', () => {
    const input = outlierEvidenceCalibrationQaFixture('ready')
    input.cohort[0].channel = 'youtube'
    input.cohort[1].format = 'video'
    input.cohort[2].audience_size = 2_000_000
    input.cohort[3].observed_at = '2025-01-01T00:00:00.000Z'

    const evaluation = evaluateOutlierEvidenceCalibration(input)

    expect(evaluation.status).toBe('unscored')
    expect(evaluation.excluded_sources.map((source) => source.reason)).toEqual(expect.arrayContaining([
      'Channel does not match the candidate.',
      'Format does not match the candidate.',
      'Audience-size band does not match the candidate.',
      'Evidence is stale or outside the 90-day recency window.',
    ]))
  })

  it('rejects unsupported packet versions instead of guessing', () => {
    const evaluation = evaluateOutlierEvidenceCalibration({
      ...outlierEvidenceCalibrationQaFixture('ready'),
      model_version: 'future-model',
    })

    expect(evaluation.status).toBe('unscored')
    expect(evaluation.blockers).toEqual(['The calibration packet version is missing or unsupported.'])
  })

  it('fails closed on a missing packet or invalid candidate normalization inputs', () => {
    expect(evaluateOutlierEvidenceCalibration(null)).toMatchObject({
      status: 'unscored',
      overall_score: null,
      blockers: ['No attributable calibration packet is attached.'],
    })
    expect(evaluateOutlierEvidenceCalibration({
      model_version: OUTLIER_EVIDENCE_MODEL_VERSION,
    }).blockers).toEqual(['Candidate or comparable cohort inputs are missing.'])

    const invalidCandidate = outlierEvidenceCalibrationQaFixture('ready')
    invalidCandidate.candidate.audience_size = -1
    expect(evaluateOutlierEvidenceCalibration(invalidCandidate)).toMatchObject({
      status: 'unscored',
      overall_score: null,
      blockers: ['Candidate normalization inputs are missing or invalid.'],
    })
  })

  it('excludes future observations and non-http attribution without dropping a valid http source', () => {
    const input = outlierEvidenceCalibrationQaFixture('ready')
    input.cohort[0].observed_at = '2026-10-16T12:00:00.000Z'
    input.cohort[1].source_url = 'javascript:alert(1)'
    input.cohort[2].source_url = 'http://example.com/public-evidence/cohort-3'

    const evaluation = evaluateOutlierEvidenceCalibration(input)

    expect(evaluation.included_sources.map((source) => source.id)).toEqual(['cohort-3', 'cohort-4'])
    expect(evaluation.excluded_sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'cohort-1',
        reason: 'Evidence is stale or outside the 90-day recency window.',
      }),
      expect.objectContaining({
        id: 'cohort-2',
        reason: 'Source attribution is missing.',
      }),
    ]))
  })

  it('fails only the out-of-range dimension and keeps the other scores', () => {
    const input = outlierEvidenceCalibrationQaFixture('ready')
    input.candidate.signals = { ...input.candidate.signals, product_evidence: 101 }

    const evaluation = evaluateOutlierEvidenceCalibration(input)
    const productEvidence = evaluation.dimensions.find((dimension) => dimension.dimension === 'product_evidence')
    const headline = evaluation.dimensions.find((dimension) => dimension.dimension === 'headline')

    expect(evaluation.status).toBe('unscored')
    expect(evaluation.overall_score).toBeNull()
    expect(productEvidence).toMatchObject({
      status: 'unscored',
      score: null,
      candidate_value: null,
      reason: 'Candidate evidence is missing, so this dimension fails closed.',
    })
    expect(headline?.status).toBe('scored')
    expect(headline?.score).toEqual(expect.any(Number))
    expect(evaluation.blockers.some((blocker) => blocker.startsWith('Headline:'))).toBe(false)
  })

  it('locks percentile rank, tied ranks, and the even-count median', () => {
    const ranked = evaluateOutlierEvidenceCalibration(withUniformSignals(80, [20, 40, 80, 100]))
    expect(ranked).toMatchObject({ status: 'scored', overall_score: 63 })
    expect(ranked.dimensions.every((dimension) => dimension.score === 63 && dimension.cohort_median === 60)).toBe(true)

    const tied = evaluateOutlierEvidenceCalibration(withUniformSignals(20, [20, 20, 20, 20]))
    expect(tied.overall_score).toBe(50)
    expect(tied.dimensions[0]).toMatchObject({ score: 50, cohort_median: 20, sample_size: 4 })

    const below = evaluateOutlierEvidenceCalibration(withUniformSignals(5, [10, 20, 30, 40]))
    expect(below.dimensions[0]).toMatchObject({ score: 0, cohort_median: 25 })
  })

  it('keeps audience-size bands closed at their boundaries and floors the comparable sample at 2', () => {
    expect(audienceSizeBand(9_999)).toBe('micro')
    expect(audienceSizeBand(10_000)).toBe('emerging')
    expect(audienceSizeBand(99_999)).toBe('emerging')
    expect(audienceSizeBand(100_000)).toBe('established')
    expect(audienceSizeBand(999_999)).toBe('established')
    expect(audienceSizeBand(1_000_000)).toBe('large')

    const boundary = outlierEvidenceCalibrationQaFixture('ready')
    boundary.cohort[0].audience_size = 9_999
    const boundaryEvaluation = evaluateOutlierEvidenceCalibration(boundary)
    expect(boundaryEvaluation.excluded_sources).toEqual([
      expect.objectContaining({
        id: 'cohort-1',
        reason: 'Audience-size band does not match the candidate.',
      }),
    ])
    expect(boundaryEvaluation.dimensions.every((dimension) => dimension.sample_size === 3 && dimension.status === 'scored')).toBe(true)

    const meetsFloor = outlierEvidenceCalibrationQaFixture('ready')
    meetsFloor.minimum_sample_size = 1
    meetsFloor.cohort = meetsFloor.cohort.slice(0, 2)
    const meetsFloorEvaluation = evaluateOutlierEvidenceCalibration(meetsFloor)
    expect(meetsFloorEvaluation.normalization.minimum_sample_size).toBe(2)
    expect(meetsFloorEvaluation.status).toBe('scored')

    const belowFloor = outlierEvidenceCalibrationQaFixture('ready')
    belowFloor.minimum_sample_size = 1
    belowFloor.cohort = belowFloor.cohort.slice(0, 1)
    const belowFloorEvaluation = evaluateOutlierEvidenceCalibration(belowFloor)
    expect(belowFloorEvaluation.normalization.minimum_sample_size).toBe(2)
    expect(belowFloorEvaluation.status).toBe('unscored')
    expect(belowFloorEvaluation.dimensions[0].reason).toBe('Only 1 attributable, fresh comparable(s) are available; 2 are required.')
  })
})
