import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const themeMocks = vi.hoisted(() => ({
  listGammaThemeConfigRows: vi.fn(),
  getResolvedDefaultThemeId: vi.fn(),
  getGammaThemeSyncState: vi.fn(),
}))

vi.mock('@/lib/gamma-theme-config', () => ({
  listGammaThemeConfigRows: themeMocks.listGammaThemeConfigRows,
  getResolvedDefaultThemeId: themeMocks.getResolvedDefaultThemeId,
  getGammaThemeSyncState: themeMocks.getGammaThemeSyncState,
  recordGammaThemeSyncResult: vi.fn(),
  syncGammaThemesFromApi: vi.fn(),
  setGammaThemeDefault: vi.fn(),
  toggleGammaThemeFavorite: vi.fn(),
  addManualGammaTheme: vi.fn(),
}))

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
    vi.mocked(verifyAdmin).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    vi.mocked(isAuthError).mockReturnValue(false)
    themeMocks.listGammaThemeConfigRows.mockResolvedValue([])
    themeMocks.getResolvedDefaultThemeId.mockResolvedValue('theme-default')
    themeMocks.getGammaThemeSyncState.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it('returns 200 with catalog payload when GAMMA_API_KEY is not configured', async () => {
    delete process.env.GAMMA_API_KEY
    process.env.GAMMA_DEFAULT_THEME_ID = 'theme-default'

    const response = await GET(new Request('http://localhost/api/admin/gamma-reports/themes') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      themes: [],
      themeAssets: [],
      defaultThemeId: 'theme-default',
      lastSync: null,
      hasApiKey: false,
    })
  })

  it('returns 200 with hasApiKey when GAMMA_API_KEY is set', async () => {
    process.env.GAMMA_API_KEY = 'gamma-key'
    process.env.GAMMA_DEFAULT_THEME_ID = 'theme-default'

    const response = await GET(new Request('http://localhost/api/admin/gamma-reports/themes') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.hasApiKey).toBe(true)
    expect(body.themes).toEqual([])
    expect(body.themeAssets).toEqual([])
    expect(body.defaultThemeId).toBe('theme-default')
    expect(body.lastSync).toBeNull()
  })
})
