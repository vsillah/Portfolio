import { describe, it, expect } from 'vitest'
import {
  validateReturnPath,
  buildLinkWithReturn,
  buildAdminReturnPath,
  parseReturnTo,
  getBackUrl,
  RETURN_TO_PARAM,
} from './admin-return-context'

describe('validateReturnPath', () => {
  it('accepts valid admin paths', () => {
    expect(validateReturnPath('/admin')).toBe('/admin')
    expect(validateReturnPath('/admin/outreach')).toBe('/admin/outreach')
    expect(validateReturnPath('/admin/outreach?tab=leads&id=42')).toBe(
      '/admin/outreach?tab=leads&id=42'
    )
    expect(validateReturnPath('/admin/sales/conversation/abc-123')).toBe(
      '/admin/sales/conversation/abc-123'
    )
  })

  it('rejects null/undefined/empty', () => {
    expect(validateReturnPath(null)).toBeNull()
    expect(validateReturnPath(undefined)).toBeNull()
    expect(validateReturnPath('')).toBeNull()
    expect(validateReturnPath('   ')).toBeNull()
  })

  it('rejects protocol-relative URLs (open redirect)', () => {
    expect(validateReturnPath('//evil.com/admin')).toBeNull()
    expect(validateReturnPath('//evil.com/admin/outreach')).toBeNull()
  })

  it('rejects absolute URLs with a scheme', () => {
    expect(validateReturnPath('https://evil.com')).toBeNull()
    expect(validateReturnPath('https://evil.com/admin/outreach')).toBeNull()
    expect(validateReturnPath('http://localhost:3000/admin')).toBeNull()
    expect(validateReturnPath('javascript:alert(1)')).toBeNull()
    expect(validateReturnPath('data:text/html,hello')).toBeNull()
  })

  it('rejects non-admin paths', () => {
    expect(validateReturnPath('/')).toBeNull()
    expect(validateReturnPath('/store')).toBeNull()
    expect(validateReturnPath('/auth/callback')).toBeNull()
    expect(validateReturnPath('/administrator')).toBeNull()
  })

  it('trims whitespace', () => {
    expect(validateReturnPath('  /admin/outreach  ')).toBe('/admin/outreach')
  })
})

describe('buildLinkWithReturn', () => {
  it('appends returnTo to a simple destination', () => {
    const result = buildLinkWithReturn('/admin/meetings/abc', '/admin/outreach?tab=leads&id=5')
    expect(result).toBe(
      '/admin/meetings/abc?returnTo=%2Fadmin%2Foutreach%3Ftab%3Dleads%26id%3D5'
    )
  })

  it('appends with & when destination already has query params', () => {
    const result = buildLinkWithReturn('/admin/meetings/abc?view=notes', '/admin/outreach')
    expect(result).toContain('&returnTo=')
  })

  it('returns destination unchanged when returnPath is invalid', () => {
    expect(buildLinkWithReturn('/admin/meetings/abc', '//evil.com')).toBe(
      '/admin/meetings/abc'
    )
    expect(buildLinkWithReturn('/admin/meetings/abc', '')).toBe(
      '/admin/meetings/abc'
    )
  })
})

describe('buildAdminReturnPath', () => {
  it('returns pathname only when search is empty', () => {
    expect(buildAdminReturnPath('/admin/reports/gamma', '')).toBe('/admin/reports/gamma')
    expect(buildAdminReturnPath('/admin/reports/gamma', undefined)).toBe('/admin/reports/gamma')
  })

  it('preserves query and strips returnTo', () => {
    expect(
      buildAdminReturnPath(
        '/admin/reports/gamma',
        'type=audit_summary&contactId=5&returnTo=%2Fadmin%2Fsales',
      ),
    ).toBe('/admin/reports/gamma?type=audit_summary&contactId=5')
  })

  it('handles leading ? on search string', () => {
    expect(buildAdminReturnPath('/admin/meetings', '?contact_submission_id=3')).toBe(
      '/admin/meetings?contact_submission_id=3',
    )
  })
})

describe('parseReturnTo', () => {
  it('reads and validates from URLSearchParams', () => {
    const params = new URLSearchParams('returnTo=%2Fadmin%2Foutreach%3Ftab%3Dleads%26id%3D42')
    expect(parseReturnTo(params)).toBe('/admin/outreach?tab=leads&id=42')
  })

  it('returns null for missing param', () => {
    const params = new URLSearchParams('')
    expect(parseReturnTo(params)).toBeNull()
  })

  it('returns null for invalid param', () => {
    const params = new URLSearchParams('returnTo=https%3A%2F%2Fevil.com')
    expect(parseReturnTo(params)).toBeNull()
  })

  it('works with an object that has a get method', () => {
    const mock = { get: (key: string) => key === RETURN_TO_PARAM ? '/admin/meetings' : null }
    expect(parseReturnTo(mock)).toBe('/admin/meetings')
  })
})

describe('getBackUrl', () => {
  it('returns returnTo when valid', () => {
    const params = new URLSearchParams('returnTo=%2Fadmin%2Foutreach')
    expect(getBackUrl(params, '/admin/sales')).toBe('/admin/outreach')
  })

  it('returns default when returnTo is missing', () => {
    const params = new URLSearchParams('')
    expect(getBackUrl(params, '/admin/sales')).toBe('/admin/sales')
  })

  it('returns default when returnTo is invalid', () => {
    const params = new URLSearchParams('returnTo=https%3A%2F%2Fevil.com')
    expect(getBackUrl(params, '/admin/sales')).toBe('/admin/sales')
  })
})
