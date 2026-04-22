import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

import {
  CALENDLY_EVENT_KEYS,
  CALENDLY_EVENT_META,
  DEFAULT_CALENDLY_EVENT_FOR_REPORT_TYPE,
  defaultCalendlyEventForReportType,
  getCalendlyUrlForEvent,
  isCalendlyEventKey,
  resolveCalendlyEvent,
  type CalendlyEventKey,
} from './calendly-events'

const CALENDLY_ENV_VARS = [
  'NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL',
  'CALENDLY_DISCOVERY_LINK',
  'CALENDLY_ONBOARDING_CALL_URL',
  'CALENDLY_KICKOFF_MEETING_URL',
  'CALENDLY_PROGRESS_CHECKIN_URL',
  'CALENDLY_RENEWAL_REVIEW_URL',
  'CALENDLY_DELIVERY_REVIEW_URL',
] as const

function snapshotEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {}
  for (const name of CALENDLY_ENV_VARS) {
    snap[name] = process.env[name]
  }
  return snap
}

function clearAllCalendlyEnv() {
  for (const name of CALENDLY_ENV_VARS) {
    delete process.env[name]
  }
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const name of CALENDLY_ENV_VARS) {
    const prev = snap[name]
    if (prev === undefined) delete process.env[name]
    else process.env[name] = prev
  }
}

describe('calendly-events registry', () => {
  it('exposes exactly the 6 canonical event keys', () => {
    expect([...CALENDLY_EVENT_KEYS].sort()).toEqual(
      [
        'delivery_review',
        'discovery_call',
        'kickoff',
        'onboarding',
        'progress_checkin',
        'renewal_review',
      ].sort()
    )
  })

  it('every key has meta with label, duration, blurb, and envVar', () => {
    for (const key of CALENDLY_EVENT_KEYS) {
      const meta = CALENDLY_EVENT_META[key]
      expect(meta.key).toBe(key)
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.duration).toMatch(/minutes$/)
      expect(meta.blurb.length).toBeGreaterThan(0)
      expect(meta.envVar.length).toBeGreaterThan(0)
    }
  })

  it('uses the renamed CALENDLY_RENEWAL_REVIEW_URL env var (not the legacy GO_NO_GO name)', () => {
    expect(CALENDLY_EVENT_META.renewal_review.envVar).toBe('CALENDLY_RENEWAL_REVIEW_URL')
    for (const key of CALENDLY_EVENT_KEYS) {
      expect(CALENDLY_EVENT_META[key].envVar).not.toMatch(/GO_NO_GO/)
    }
  })
})

describe('report-type default mapping', () => {
  it('pre-commit report types default to the Discovery Call', () => {
    expect(defaultCalendlyEventForReportType('prospect_overview')).toBe('discovery_call')
    expect(defaultCalendlyEventForReportType('audit_summary')).toBe('discovery_call')
    expect(defaultCalendlyEventForReportType('offer_presentation')).toBe('discovery_call')
  })

  it('post-commit report types default to the Onboarding Call', () => {
    expect(defaultCalendlyEventForReportType('value_quantification')).toBe('onboarding')
    expect(defaultCalendlyEventForReportType('implementation_strategy')).toBe('onboarding')
  })

  it('exposes the full default map', () => {
    expect(DEFAULT_CALENDLY_EVENT_FOR_REPORT_TYPE).toEqual({
      prospect_overview: 'discovery_call',
      audit_summary: 'discovery_call',
      offer_presentation: 'discovery_call',
      value_quantification: 'onboarding',
      implementation_strategy: 'onboarding',
    })
  })
})

describe('isCalendlyEventKey', () => {
  it('accepts valid keys', () => {
    for (const key of CALENDLY_EVENT_KEYS) {
      expect(isCalendlyEventKey(key)).toBe(true)
    }
  })

  it('rejects unknown strings and non-strings', () => {
    expect(isCalendlyEventKey('go_no_go')).toBe(false)
    expect(isCalendlyEventKey('foo')).toBe(false)
    expect(isCalendlyEventKey('')).toBe(false)
    expect(isCalendlyEventKey(null)).toBe(false)
    expect(isCalendlyEventKey(undefined)).toBe(false)
    expect(isCalendlyEventKey(123)).toBe(false)
  })
})

describe('getCalendlyUrlForEvent — env resolution', () => {
  const envSnap = snapshotEnv()
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    clearAllCalendlyEnv()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    restoreEnv(envSnap)
  })

  it('returns the event-specific env var when set', () => {
    process.env.CALENDLY_ONBOARDING_CALL_URL = 'https://calendly.com/acme/onboarding'
    expect(getCalendlyUrlForEvent('onboarding')).toBe('https://calendly.com/acme/onboarding')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('falls back to the discovery URL when the event-specific var is missing (and warns)', () => {
    process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL = 'https://cal.example.com/discovery'
    const url = getCalendlyUrlForEvent('onboarding')
    expect(url).toBe('https://cal.example.com/discovery')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const msg = warnSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('CALENDLY_ONBOARDING_CALL_URL')
    expect(msg).toContain('onboarding')
  })

  it('falls back to the legacy CALENDLY_DISCOVERY_LINK when the public var is missing', () => {
    process.env.CALENDLY_DISCOVERY_LINK = 'https://legacy.example.com/book'
    const url = getCalendlyUrlForEvent('kickoff')
    expect(url).toBe('https://legacy.example.com/book')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('falls back to amadutown.com when no Calendly env var is set', () => {
    const url = getCalendlyUrlForEvent('renewal_review')
    expect(url).toBe('https://amadutown.com')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('does NOT warn when resolving the discovery_call itself with no env set', () => {
    const url = getCalendlyUrlForEvent('discovery_call')
    expect(url).toBe('https://amadutown.com')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('treats empty or whitespace-only env vars as unset', () => {
    process.env.CALENDLY_ONBOARDING_CALL_URL = '   '
    process.env.NEXT_PUBLIC_CALENDLY_DISCOVERY_CALL_URL = 'https://cal.example.com/discovery'
    const url = getCalendlyUrlForEvent('onboarding')
    expect(url).toBe('https://cal.example.com/discovery')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('resolveCalendlyEvent merges meta + url', () => {
    process.env.CALENDLY_DELIVERY_REVIEW_URL = 'https://calendly.com/acme/delivery'
    const resolved = resolveCalendlyEvent('delivery_review')
    expect(resolved.key).toBe('delivery_review')
    expect(resolved.label).toBe('Delivery & Review')
    expect(resolved.url).toBe('https://calendly.com/acme/delivery')
    expect(resolved.duration).toMatch(/minutes$/)
    expect(resolved.blurb.length).toBeGreaterThan(0)
  })

  it('resolves every event key to a non-empty URL even when nothing is configured', () => {
    for (const key of CALENDLY_EVENT_KEYS) {
      const url = getCalendlyUrlForEvent(key as CalendlyEventKey)
      expect(url.length).toBeGreaterThan(0)
      expect(url).toMatch(/^https?:\/\//)
    }
  })
})
