import { describe, expect, it } from 'vitest'
import { publicObservationIdentity, validPublicObservation } from './social-public-signal-observation'

const now = '2026-10-20T12:00:00.000Z'
const observation = { coverage_identity: 'openai_agents_api', source_url: 'https://example.org/public-signal',
  observed_at: '2026-10-20T11:00:00.000Z', expires_at: '2026-10-25T11:00:00.000Z',
  public_attention: { observed: 80, required: 100 }, relevance: { observed: 9, required: 10 },
  evidence_note: 'Exact public numerator and denominator visible on this page.' }

describe('review-only public observation intake', () => {
  it('uses a stable content identity and rejects private, stale, or incomplete evidence', () => {
    expect(validPublicObservation(observation, now)).toBe(true)
    expect(publicObservationIdentity(observation)).toBe(publicObservationIdentity({ ...observation }))
    for (const source_url of ['https://127.0.0.1/private', 'https://192.168.1.2/data', 'https://host.internal/data', 'http://example.org/public-signal']) {
      expect(validPublicObservation({ ...observation, source_url }, now)).toBe(false)
    }
    expect(validPublicObservation({ ...observation, observed_at: '2026-10-01T00:00:00Z' }, now)).toBe(false)
    expect(validPublicObservation({ ...observation, relevance: { observed: 9, required: 0 } }, now)).toBe(false)
    expect(validPublicObservation({ ...observation, evidence_note: 'guess' }, now)).toBe(false)
  })

  it('rejects private hosts, future windows, and notes outside the review length', () => {
    for (const source_url of [
      'https://localhost/public-signal',
      'https://user:pass@example.org/public-signal',
      'https://files.local/public-signal',
      'https://files.invalid/public-signal',
      'https://files.example.test/public-signal',
      'https://intranet/public-signal',
    ]) {
      expect(validPublicObservation({ ...observation, source_url }, now)).toBe(false)
    }
    expect(validPublicObservation(null, now)).toBe(false)
    expect(validPublicObservation([observation], now)).toBe(false)
    expect(validPublicObservation({ ...observation, coverage_identity: 'short' }, now)).toBe(false)
    expect(validPublicObservation({ ...observation, coverage_identity: 'bad identity' }, now)).toBe(false)
    expect(validPublicObservation({ ...observation, observed_at: '2026-10-20T13:00:00.000Z' }, now)).toBe(false)
    expect(validPublicObservation({ ...observation, expires_at: now }, now)).toBe(false)
    expect(validPublicObservation({ ...observation, expires_at: '2026-10-27T11:00:01.000Z' }, now)).toBe(false)
    expect(validPublicObservation({ ...observation, public_attention: { observed: -1, required: 100 } }, now)).toBe(false)
    expect(validPublicObservation({ ...observation, evidence_note: 'x'.repeat(501) }, now)).toBe(false)
    expect(validPublicObservation({ ...observation, evidence_note: 'x'.repeat(500) }, now)).toBe(true)
    expect(validPublicObservation(observation, 'not-a-time')).toBe(false)
  })
})
