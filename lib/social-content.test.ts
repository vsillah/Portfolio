import { describe, it, expect } from 'vitest'
import { extractMeetingTitle, extractMeetingSourceUrl, STATUS_CONFIG } from './social-content'

describe('social-content helpers', () => {
  describe('STATUS_CONFIG', () => {
    it('uses opaque high-contrast lifecycle colors in dark mode', () => {
      expect(STATUS_CONFIG.draft).toMatchObject({
        color: expect.stringContaining('dark:text-white'),
        bgColor: expect.stringContaining('dark:bg-[#334155]'),
      })
      expect(STATUS_CONFIG.approved).toMatchObject({
        color: expect.stringContaining('dark:text-white'),
        bgColor: expect.stringContaining('dark:bg-blue-700'),
      })
      expect(STATUS_CONFIG.scheduled).toMatchObject({
        color: expect.stringContaining('dark:text-amber-950'),
        bgColor: expect.stringContaining('dark:bg-amber-400'),
      })
      expect(STATUS_CONFIG.published).toMatchObject({
        color: expect.stringContaining('dark:text-white'),
        bgColor: expect.stringContaining('dark:bg-emerald-700'),
      })
      expect(STATUS_CONFIG.rejected).toMatchObject({
        color: expect.stringContaining('dark:text-white'),
        bgColor: expect.stringContaining('dark:bg-red-700'),
      })
    })
  })

  describe('extractMeetingTitle', () => {
    it('prefers structured_notes.title when present', () => {
      const title = extractMeetingTitle(
        '<https://app.read.ai/analytics/abc| Wrong Title >',
        { title: '  Structured Notes Title  ' }
      )
      expect(title).toBe('Structured Notes Title')
    })

    it('extracts title from Slack-style links in raw notes', () => {
      const title = extractMeetingTitle(
        '<https://app.read.ai/analytics/abc| Weekly Revenue Sync * >',
        null
      )
      expect(title).toBe('Weekly Revenue Sync')
    })

    it('returns null when no structured title or Slack link is available', () => {
      expect(extractMeetingTitle('General notes without link', null)).toBeNull()
      expect(extractMeetingTitle(null, null)).toBeNull()
    })
  })

  describe('extractMeetingSourceUrl', () => {
    it('extracts and decodes source URL from Slack-style links', () => {
      const url = extractMeetingSourceUrl(
        '<https://app.read.ai/analytics/abc?foo=1&amp;bar=2| Meeting Link >'
      )
      expect(url).toBe('https://app.read.ai/analytics/abc?foo=1&bar=2')
    })

    it('returns null when no URL is present', () => {
      expect(extractMeetingSourceUrl('No links in this note')).toBeNull()
      expect(extractMeetingSourceUrl(undefined)).toBeNull()
    })
  })
})
