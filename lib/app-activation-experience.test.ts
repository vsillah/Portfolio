import { describe, expect, it } from 'vitest'
import { adultConsent, activationExperiences, activationFailureMessage, classifyActivationResponse } from './app-activation-experience'

describe('adult activation presentation contract', () => {
  it('binds a versioned adult contact statement to reusable app metadata', () => {
    expect(adultConsent.version).toMatch(/^adult-interest-\d{4}-\d{2}-\d{2}-v\d+$/)
    expect(adultConsent.statement).toMatch(/I am an adult/)
    expect(adultConsent.statement).toMatch(/withdraw my contact consent/)
    expect(activationExperiences['trumpet-trainer'].returnPath).toBe('/work/trumpet-trainer#interest')
  })
  it('gives a safe next action without pretending to know why a token failed', () => {
    expect(classifyActivationResponse(404)).toBe('invalid')
    expect(activationFailureMessage('invalid')).toMatch(/new one/)
    for (const kind of ['used', 'expired', 'blocked', 'disabled'] as const) expect(activationFailureMessage(kind).length).toBeGreaterThan(30)
  })
})
