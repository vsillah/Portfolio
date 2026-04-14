import { describe, expect, it } from 'vitest'
import {
  buildPlaintextRfc2822,
  rfc2822ToGmailRaw,
} from '@/lib/gmail-user-api'

describe('Gmail user API MIME helpers', () => {
  it('produces Gmail-acceptable raw encoding', () => {
    const rfc = buildPlaintextRfc2822(
      'lead@example.com',
      'Hello 世界',
      'Line1\n\nLine2'
    )
    expect(rfc).toContain('To: lead@example.com')
    expect(rfc).toContain('MIME-Version: 1.0')
    const raw = rfc2822ToGmailRaw(rfc)
    expect(raw).not.toMatch(/\+/)
    expect(raw).not.toMatch(/\//)
    expect(raw.endsWith('=')).toBe(false)
  })
})
