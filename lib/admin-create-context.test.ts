import { describe, expect, it } from 'vitest'
import { ADMIN_CREATE_PARAMS, adminCreateUrl } from './admin-create-context'

function parseAdminUrl(url: string) {
  return new URL(url, 'https://amadutown.test')
}

describe('adminCreateUrl', () => {
  it('opens the outreach lead form on the leads tab', () => {
    const url = parseAdminUrl(adminCreateUrl('leads', { returnTo: '/admin/meetings' }))

    expect(url.pathname).toBe('/admin/outreach')
    expect(url.searchParams.get(ADMIN_CREATE_PARAMS.OPEN)).toBe(ADMIN_CREATE_PARAMS.OPEN_ADD)
    expect(url.searchParams.get('tab')).toBe('leads')
    expect(url.searchParams.get(ADMIN_CREATE_PARAMS.RETURN_TO)).toBe('/admin/meetings')
  })

  it('preserves lead magnet type and return context for post-create navigation', () => {
    const url = parseAdminUrl(
      adminCreateUrl('lead-magnets', {
        type: 'audiobook',
        returnTo: '/admin/content/publications?format=ebook',
      }),
    )

    expect(url.pathname).toBe('/admin/content/lead-magnets')
    expect(url.searchParams.get(ADMIN_CREATE_PARAMS.OPEN)).toBe(ADMIN_CREATE_PARAMS.OPEN_ADD)
    expect(url.searchParams.get(ADMIN_CREATE_PARAMS.TYPE)).toBe('audiobook')
    expect(url.searchParams.get(ADMIN_CREATE_PARAMS.RETURN_TO)).toBe(
      '/admin/content/publications?format=ebook',
    )
    expect(url.searchParams.has('tab')).toBe(false)
  })

  it('opens client project creation without unrelated resource params', () => {
    const url = parseAdminUrl(adminCreateUrl('client-projects'))

    expect(url.pathname).toBe('/admin/client-projects')
    expect(url.searchParams.get(ADMIN_CREATE_PARAMS.OPEN)).toBe(ADMIN_CREATE_PARAMS.OPEN_ADD)
    expect(url.searchParams.has(ADMIN_CREATE_PARAMS.TYPE)).toBe(false)
    expect(url.searchParams.has(ADMIN_CREATE_PARAMS.RETURN_TO)).toBe(false)
  })
})
