import { describe, expect, it } from 'vitest'
import { recommendSpeakerFit, speakingServiceHref, SPEAKING_SERVICE_ID } from './speaker-fit'

const complete = { audience: 'community', outcome: 'action', format: 'fireside', topic: 'burden' }

describe('speaker fit brief', () => {
  it('gives a specific direction and event checklist from complete input', () => {
    const result = recommendSpeakerFit(complete)
    expect(result?.title).toContain('work lighter')
    expect(result?.fit).toContain('community & nonprofit leaders')
    expect(result?.checklist).toHaveLength(3)
    expect(result?.checklist[1]).toContain('audience questions')
  })

  it('keeps empty or invalid input from producing a result or query context', () => {
    expect(recommendSpeakerFit({ ...complete, audience: '' })).toBeNull()
    expect(recommendSpeakerFit({ ...complete, topic: '<script>' })).toBeNull()
    expect(speakingServiceHref({ ...complete, format: 'other' })).toBe(`/services/${SPEAKING_SERVICE_ID}`)
  })

  it('routes into the existing public service with only allowlisted context', () => {
    const url = new URL(speakingServiceHref(complete), 'https://example.com')
    expect(url.pathname).toBe(`/services/${SPEAKING_SERVICE_ID}`)
    expect(url.searchParams.get('speakerTopic')).toBe('burden')
    expect(url.searchParams.get('speakerAudience')).toBe('community')
    expect([...url.searchParams.keys()]).toHaveLength(4)
  })
})
