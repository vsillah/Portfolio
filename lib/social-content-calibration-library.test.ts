import { describe, expect, it } from 'vitest'
import {
  getSocialContentCalibrationReferenceById,
  listSocialContentCalibrationReferences,
} from './social-content-calibration-library'

describe('social content calibration library', () => {
  it('treats omitted, null, and all platform filters as unrestricted', () => {
    const unfiltered = listSocialContentCalibrationReferences()
    const explicitAll = listSocialContentCalibrationReferences({ platform: 'all' })
    const uppercaseAll = listSocialContentCalibrationReferences({ platform: 'ALL' })
    const nullPlatform = listSocialContentCalibrationReferences({ platform: null })

    expect(unfiltered.length).toBeGreaterThan(0)
    expect(explicitAll).toEqual(unfiltered)
    expect(uppercaseAll).toEqual(unfiltered)
    expect(nullPlatform).toEqual(unfiltered)
  })

  it('normalizes supported platform filters and rejects unsupported platforms', () => {
    const unfiltered = listSocialContentCalibrationReferences()

    expect(listSocialContentCalibrationReferences({ platform: 'LinkedIn' })).toEqual(unfiltered)
    expect(listSocialContentCalibrationReferences({ platform: 'tiktok' })).toEqual([])
  })

  it('returns a fresh array so callers cannot reorder the shared reference list', () => {
    const firstRead = listSocialContentCalibrationReferences()
    const removed = firstRead.pop()

    expect(removed?.id).toBeTruthy()
    expect(listSocialContentCalibrationReferences()).toHaveLength(firstRead.length + 1)
  })

  it('finds references by stable id and returns null for missing ids', () => {
    expect(getSocialContentCalibrationReferenceById('linkedin-governed-agent-work')).toMatchObject({
      id: 'linkedin-governed-agent-work',
      platform: 'linkedin',
      source_type: 'operator_approved_pattern',
    })
    expect(getSocialContentCalibrationReferenceById('missing-reference')).toBeNull()
  })
})
