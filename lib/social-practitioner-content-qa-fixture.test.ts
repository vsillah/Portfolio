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

    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('SOCIAL_PRACTITIONER_CONTENT_QA_FIXTURE', 'true')
    expect(isPractitionerContentQaFixtureId(PRACTITIONER_CONTENT_QA_ID)).toBe(false)
  })
})
