import { describe, it, expect } from 'vitest'
import { scenarioIncludesDiagnosticStep } from './scenarios'

describe('scenarioIncludesDiagnosticStep', () => {
  it('returns true for scenarios that include a diagnostic step', () => {
    expect(scenarioIncludesDiagnosticStep('chat_to_diagnostic')).toBe(true)
    expect(scenarioIncludesDiagnosticStep('full_funnel')).toBe(true)
  })

  it('returns false for scenarios without a diagnostic step', () => {
    expect(scenarioIncludesDiagnosticStep('quick_browse')).toBe(false)
    expect(scenarioIncludesDiagnosticStep('seed_warm_leads')).toBe(false)
  })

  it('returns false for unknown scenario IDs', () => {
    expect(scenarioIncludesDiagnosticStep('nonexistent_scenario')).toBe(false)
  })
})
