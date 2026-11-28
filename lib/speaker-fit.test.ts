import { describe, expect, it } from 'vitest'
import { recommendSpeakerFit, speakingServiceHref, SPEAKING_SERVICE_ID, topicOptions } from './speaker-fit'

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

  it('gives every allowlisted topic a direction and changes the note with the format', () => {
    for (const topic of topicOptions) {
      const result = recommendSpeakerFit({ ...complete, topic: topic.value })
      expect(result?.title.trim().length).toBeGreaterThan(0)
      expect(result?.angle.trim().length).toBeGreaterThan(0)
    }
    expect(recommendSpeakerFit({ ...complete, format: 'panel' })?.checklist[1]).toContain('each speaker')
    expect(recommendSpeakerFit({ ...complete, format: 'keynote' })?.checklist[1]).toContain('human problem')
    expect(recommendSpeakerFit({ ...complete, audience: ' community' })).toBeNull()
    expect(recommendSpeakerFit({ ...complete, outcome: 'Action' })).toBeNull()
    expect(speakingServiceHref()).toBe(`/services/${SPEAKING_SERVICE_ID}`)
  })

  it('routes into the existing public service with only allowlisted context', () => {
    const url = new URL(speakingServiceHref(complete), 'https://example.com')
    expect(url.pathname).toBe(`/services/${SPEAKING_SERVICE_ID}`)
    expect(url.searchParams.get('speakerTopic')).toBe('burden')
    expect(url.searchParams.get('speakerAudience')).toBe('community')
    expect([...url.searchParams.keys()]).toHaveLength(4)
  })
})
