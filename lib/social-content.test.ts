import { describe, it, expect } from 'vitest'
import { extractMeetingSourceUrl, extractMeetingTitle } from './social-content'

describe('social-content meeting traceability helpers', () => {
  describe('extractMeetingTitle', () => {
    it('prefers structured_notes.title when present and trims whitespace', () => {
      const result = extractMeetingTitle(
        '<https://app.read.ai/abc|Fallback Title>',
        { title: '  Executive Weekly Sync  ' }
      )
      expect(result).toBe('Executive Weekly Sync')
    })

    it('extracts title from Slack-formatted link in raw notes', () => {
      const result = extractMeetingTitle(
        'Meeting notes: <https://app.read.ai/abc|Q2 Planning Review >',
        null
      )
      expect(result).toBe('Q2 Planning Review')
    })

    it('strips trailing markdown marker from extracted Slack title', () => {
      const result = extractMeetingTitle(
        '<https://app.read.ai/abc|Pipeline Retrospective *>',
        null
      )
      expect(result).toBe('Pipeline Retrospective')
    })

    it('returns null when title cannot be determined', () => {
      expect(extractMeetingTitle(null, null)).toBeNull()
      expect(extractMeetingTitle('No Slack link content', null)).toBeNull()
      expect(extractMeetingTitle(undefined, { title: 123 as unknown as string })).toBeNull()
    })
  })

  describe('extractMeetingSourceUrl', () => {
    it('extracts source URL from Slack-formatted raw notes', () => {
      const result = extractMeetingSourceUrl(
        '<https://app.read.ai/analytics/session-123|Meeting label>'
      )
      expect(result).toBe('https://app.read.ai/analytics/session-123')
    })

    it('decodes HTML ampersand entities in extracted URLs', () => {
      const result = extractMeetingSourceUrl(
        '<https://app.read.ai/analytics?id=abc&amp;view=full|Meeting label>'
      )
      expect(result).toBe('https://app.read.ai/analytics?id=abc&view=full')
    })

    it('returns null when no Slack-style URL exists', () => {
      expect(extractMeetingSourceUrl('https://app.read.ai/analytics')).toBeNull()
      expect(extractMeetingSourceUrl(null)).toBeNull()
      expect(extractMeetingSourceUrl(undefined)).toBeNull()
    })
  })
})
