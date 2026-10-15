import { describe, expect, it } from 'vitest'
import {
  OUTLIER_EVIDENCE_MODEL_VERSION,
  evaluateOutlierEvidenceCalibration,
  outlierEvidenceCalibrationQaFixture,
} from './social-outlier-evidence-calibration'

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
})
