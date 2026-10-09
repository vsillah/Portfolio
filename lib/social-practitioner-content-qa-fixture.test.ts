import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PRACTITIONER_CONTENT_QA_ID,
  isPractitionerContentQaFixtureId,
  practitionerContentQaFixture,
} from './social-practitioner-content-qa-fixture'
import { validatePractitionerContentQuality } from './social-practitioner-content'

describe('practitioner content QA fixture', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is preview-safe, production-disabled, and passes the practitioner gate', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const item = practitionerContentQaFixture()

    expect(isPractitionerContentQaFixtureId(PRACTITIONER_CONTENT_QA_ID)).toBe(true)
    expect(validatePractitionerContentQuality(item)).toMatchObject({
      status: 'passed',
      specificity_result: 'specific',
    })
    expect(JSON.stringify(item)).not.toContain('example.com')
    expect(item.rag_context).toMatchObject({ external_execution_enabled: false })
    expect(item.hormozi_framework).toMatchObject({ framework_type: 'proof_stacking' })
    expect(item.post_text.length).toBeGreaterThanOrEqual(1800)
    expect(item.post_text.length).toBeLessThanOrEqual(2100)

    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('SOCIAL_PRACTITIONER_CONTENT_QA_FIXTURE', 'true')
    expect(isPractitionerContentQaFixtureId(PRACTITIONER_CONTENT_QA_ID)).toBe(false)
  })

  it('provides synthetic short, medium, and over-cap scripts for responsive editor QA', () => {
    const complete = practitionerContentQaFixture('ready', 'complete').post_text || ''
    const short = practitionerContentQaFixture('ready', 'short').post_text || ''
    const medium = practitionerContentQaFixture('ready', 'medium').post_text || ''
    const overCap = practitionerContentQaFixture('ready', 'over-cap').post_text || ''

    expect(short.length).toBeLessThan(medium.length)
    expect(medium.length).toBeLessThan(overCap.length)
    expect(medium.length).toBeLessThan(complete.length)
    expect(overCap.split('\n\n')).toHaveLength(32)
    expect(practitionerContentQaFixture('ready', 'over-cap').voiceover_text).toBe(overCap)
  })
})
