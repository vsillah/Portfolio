import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { GET } from './route'

describe('GET /api/admin/gamma-reports/themes', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(verifyAdmin).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    vi.mocked(isAuthError).mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it('returns 200 with empty themes when GAMMA_API_KEY is not configured', async () => {
    delete process.env.GAMMA_API_KEY
    process.env.GAMMA_DEFAULT_THEME_ID = 'theme-default'

    const response = await GET(new Request('http://localhost/api/admin/gamma-reports/themes') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      themes: [],
      defaultThemeId: 'theme-default',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns 200 with empty themes and warning when upstream themes call fails', async () => {
    process.env.GAMMA_API_KEY = 'gamma-key'
    process.env.GAMMA_DEFAULT_THEME_ID = 'theme-default'
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Rate limited' }),
    } as Response)

    const response = await GET(new Request('http://localhost/api/admin/gamma-reports/themes') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      themes: [],
      defaultThemeId: 'theme-default',
      warning: 'Rate limited',
    })
  })
})
