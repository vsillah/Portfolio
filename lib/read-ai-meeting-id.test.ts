import { describe, expect, it } from 'vitest'
import { extractReadAiMeetingId } from './read-ai-meeting-id'

describe('extractReadAiMeetingId', () => {
  it('extracts id from analytics URL', () => {
    expect(
      extractReadAiMeetingId(
        'https://app.read.ai/analytics/meetings/01KNHYS5S4P7J9ZE8XF6ZGQEB1?utm=1'
      )
    ).toBe('01KNHYS5S4P7J9ZE8XF6ZGQEB1')
  })

  it('returns null when missing', () => {
    expect(extractReadAiMeetingId('')).toBeNull()
    expect(extractReadAiMeetingId(null)).toBeNull()
    expect(extractReadAiMeetingId('no url here')).toBeNull()
  })
})
