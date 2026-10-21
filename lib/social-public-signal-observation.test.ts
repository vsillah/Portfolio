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
})
