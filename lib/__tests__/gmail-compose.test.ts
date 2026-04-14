import { describe, expect, it } from 'vitest'
import { buildGmailComposeUrl, GMAIL_COMPOSE_MAX_URL_LENGTH } from '@/lib/gmail-compose'

describe('buildGmailComposeUrl', () => {
  it('includes body when URL stays under limit', () => {
    const { url, omitBodyFromUrl } = buildGmailComposeUrl(
      'a@b.co',
      'Hi',
      'Short body'
    )
    expect(omitBodyFromUrl).toBe(false)
    expect(url).toContain('to=a%40b.co')
    expect(url).toContain('su=Hi')
    expect(url).toContain('body=Short+body')
    expect(url.length).toBeLessThanOrEqual(GMAIL_COMPOSE_MAX_URL_LENGTH)
  })

  it('omits body from URL when full string would exceed limit', () => {
    const huge = 'x'.repeat(GMAIL_COMPOSE_MAX_URL_LENGTH)
    const { url, omitBodyFromUrl } = buildGmailComposeUrl('lead@example.com', 'Subject', huge)
    expect(omitBodyFromUrl).toBe(true)
    expect(url).toContain('to=')
    expect(url).toContain('su=Subject')
    expect(url).not.toContain(huge)
    expect(url.length).toBeLessThanOrEqual(GMAIL_COMPOSE_MAX_URL_LENGTH)
  })
})
