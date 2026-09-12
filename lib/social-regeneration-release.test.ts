import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.auth, isAuthError: (value: any) => 'error' in value }))
import { POST as audio } from '@/app/api/admin/social-content/[id]/regenerate-audio/route'
import { POST as image } from '@/app/api/admin/social-content/[id]/regenerate-image/route'
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'admin' } }); vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => vi.unstubAllGlobals())
describe.each([{ label: 'audio', route: audio }, { label: 'image', route: image }])('$label legacy regeneration', ({ route }) => {
  it('blocks before mutation or provider dispatch and supplies native asset recovery', async () => {
    const response = await route(new NextRequest('https://fixture.invalid/api/regenerate', { method: 'POST', body: '{}' }), { params: { id: 'social-1' } })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'external_regeneration_unfenced', triggered: false,
      recovery_url: '/admin/social-content/social-1?step=visuals#social-visual-assets-gate' })
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled()
  })
  it.each([401, 403])('retains authorization failure %s', async status => {
    mocks.auth.mockResolvedValue({ error: 'denied', status })
    const response = await route(new NextRequest('https://fixture.invalid/api/regenerate', { method: 'POST' }), { params: { id: 'social-1' } })
    expect(response.status).toBe(status); expect(fetch).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled()
  })
})
