import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const themeMocks = vi.hoisted(() => ({
  listGammaThemeConfigRows: vi.fn(),
  getResolvedDefaultThemeId: vi.fn(),
  getGammaThemeSyncState: vi.fn(),
  recordGammaThemeSyncResult: vi.fn(),
  syncGammaThemesFromApi: vi.fn(),
  setGammaThemeDefault: vi.fn(),
  toggleGammaThemeFavorite: vi.fn(),
  addManualGammaTheme: vi.fn(),
}))

vi.mock('@/lib/gamma-theme-config', () => ({
  listGammaThemeConfigRows: themeMocks.listGammaThemeConfigRows,
  getResolvedDefaultThemeId: themeMocks.getResolvedDefaultThemeId,
  getGammaThemeSyncState: themeMocks.getGammaThemeSyncState,
  recordGammaThemeSyncResult: themeMocks.recordGammaThemeSyncResult,
  syncGammaThemesFromApi: themeMocks.syncGammaThemesFromApi,
  setGammaThemeDefault: themeMocks.setGammaThemeDefault,
  toggleGammaThemeFavorite: themeMocks.toggleGammaThemeFavorite,
  addManualGammaTheme: themeMocks.addManualGammaTheme,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { GET, POST } from './route'

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

function postRequest(body: unknown, init: RequestInit = {}) {
  return new Request('http://localhost/api/admin/gamma-reports/themes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  }) as never
}

describe('POST /api/admin/gamma-reports/themes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(verifyAdmin).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    vi.mocked(isAuthError).mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the admin auth error when verification fails', async () => {
    vi.mocked(verifyAdmin).mockResolvedValue({ error: 'Unauthorized', status: 401 } as never)
    vi.mocked(isAuthError).mockReturnValue(true)

    const response = await POST(postRequest({ action: 'sync' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(themeMocks.syncGammaThemesFromApi).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON before routing an action', async () => {
    const response = await POST(postRequest('{', { headers: { 'content-type': 'application/json' } }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
    expect(themeMocks.syncGammaThemesFromApi).not.toHaveBeenCalled()
  })

  it('rejects unknown or missing actions', async () => {
    const unknown = await POST(postRequest({ action: 'delete_all' }))
    expect(unknown.status).toBe(400)
    await expect(unknown.json()).resolves.toEqual({
      error: 'Unknown action. Use "sync", "set_default", "toggle_favorite", or "add_manual".',
    })

    const missing = await POST(postRequest({}))
    expect(missing.status).toBe(400)
    expect(themeMocks.setGammaThemeDefault).not.toHaveBeenCalled()
  })

  it('syncs from Gamma and records the result even when the API reports a partial error', async () => {
    const result = { themesSynced: 3, error: 'page 2 timed out' }
    themeMocks.syncGammaThemesFromApi.mockResolvedValue(result)
    themeMocks.recordGammaThemeSyncResult.mockResolvedValue(undefined)

    const response = await POST(postRequest({ action: 'sync' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      message: 'Sync complete',
      themesSynced: 3,
      error: 'page 2 timed out',
      success: false,
    })
    expect(typeof body.syncedAt).toBe('string')
    expect(themeMocks.recordGammaThemeSyncResult).toHaveBeenCalledWith(result)
  })

  it('returns 500 when sync throws', async () => {
    themeMocks.syncGammaThemesFromApi.mockRejectedValue(new Error('Gamma unreachable'))

    const response = await POST(postRequest({ action: 'sync' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Gamma unreachable' })
    expect(themeMocks.recordGammaThemeSyncResult).not.toHaveBeenCalled()
  })

  it.each([undefined, '', '   '])('requires a themeId for set_default (%j)', async (themeId) => {
    const response = await POST(postRequest({ action: 'set_default', themeId }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'themeId is required' })
    expect(themeMocks.setGammaThemeDefault).not.toHaveBeenCalled()
  })

  it('sets the default theme after trimming themeId', async () => {
    themeMocks.setGammaThemeDefault.mockResolvedValue({ error: null })

    const response = await POST(postRequest({ action: 'set_default', themeId: '  theme-a  ' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Default theme set to theme-a' })
    expect(themeMocks.setGammaThemeDefault).toHaveBeenCalledWith('theme-a')
  })

  it('returns 500 when set_default fails in the helper', async () => {
    themeMocks.setGammaThemeDefault.mockResolvedValue({ error: 'theme missing' })

    const response = await POST(postRequest({ action: 'set_default', themeId: 'missing' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'theme missing' })
  })

  it('requires themeId for toggle_favorite and reports added vs removed', async () => {
    const missing = await POST(postRequest({ action: 'toggle_favorite', favorite: true }))
    expect(missing.status).toBe(400)
    expect(themeMocks.toggleGammaThemeFavorite).not.toHaveBeenCalled()

    themeMocks.toggleGammaThemeFavorite.mockResolvedValue({ error: null })
    const added = await POST(postRequest({ action: 'toggle_favorite', themeId: 'theme-a', favorite: true }))
    expect(added.status).toBe(200)
    await expect(added.json()).resolves.toEqual({ message: 'Favorite added' })

    const removed = await POST(postRequest({ action: 'toggle_favorite', themeId: 'theme-a', favorite: false }))
    expect(removed.status).toBe(200)
    await expect(removed.json()).resolves.toEqual({ message: 'Favorite removed' })
    expect(themeMocks.toggleGammaThemeFavorite).toHaveBeenNthCalledWith(1, 'theme-a', true)
    expect(themeMocks.toggleGammaThemeFavorite).toHaveBeenNthCalledWith(2, 'theme-a', false)
  })

  it('adds a manual theme and defaults the name to themeId when omitted', async () => {
    themeMocks.addManualGammaTheme.mockResolvedValue({ error: null })

    const response = await POST(postRequest({ action: 'add_manual', themeId: '  custom-1  ' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Added theme custom-1' })
    expect(themeMocks.addManualGammaTheme).toHaveBeenCalledWith('custom-1', 'custom-1')
  })

  it('uses the provided themeName for add_manual', async () => {
    themeMocks.addManualGammaTheme.mockResolvedValue({ error: null })

    const response = await POST(postRequest({
      action: 'add_manual',
      themeId: 'custom-2',
      themeName: '  Custom Theme  ',
    }))

    expect(response.status).toBe(200)
    expect(themeMocks.addManualGammaTheme).toHaveBeenCalledWith('custom-2', 'Custom Theme')
  })
})
