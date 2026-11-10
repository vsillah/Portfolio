import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(async () => ({ data: { provider: 'google' }, error: null })),
  refreshSession: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      refreshSession: mocks.refreshSession,
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signInWithOAuth: mocks.signInWithOAuth,
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}))

import { getStoredAuthNextPath, normalizeAuthRedirectPath, refreshCurrentSession, signInWithOAuth } from './auth'

describe('auth redirect helpers', () => {
  beforeEach(() => {
    mocks.signInWithOAuth.mockClear()
    sessionStorage.clear()
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('stores the post-OAuth path while keeping Supabase callback URLs bare', async () => {
    window.history.replaceState({}, '', '/store')

    await signInWithOAuth('google', '/admin/social-content/social-1?returnTo=%2Fadmin%2Fsocial-content&step=submit')

    expect(sessionStorage.getItem('auth_next_path')).toBe('/admin/social-content/social-1?returnTo=%2Fadmin%2Fsocial-content&step=submit')
    expect(localStorage.getItem('auth_next_path')).toBe('/admin/social-content/social-1?returnTo=%2Fadmin%2Fsocial-content&step=submit')
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  })

  it('reads the stored redirect once, preferring session storage and clearing fallbacks', () => {
    sessionStorage.setItem('auth_next_path', '/admin/source-protocol?filter=needs-review#queue')
    localStorage.setItem('auth_next_path', '/checkout')

    expect(getStoredAuthNextPath()).toBe('/admin/source-protocol?filter=needs-review#queue')
    expect(sessionStorage.getItem('auth_next_path')).toBeNull()
    expect(localStorage.getItem('auth_next_path')).toBeNull()
    expect(getStoredAuthNextPath()).toBeNull()
  })

  it('falls back to local storage when session storage is unavailable for the callback', () => {
    localStorage.setItem('auth_next_path', '/client/projects/project-1?tab=roadmap')

    expect(getStoredAuthNextPath()).toBe('/client/projects/project-1?tab=roadmap')
    expect(localStorage.getItem('auth_next_path')).toBeNull()
  })

  it('rejects external auth redirect targets', async () => {
    expect(normalizeAuthRedirectPath('https://evil.test/admin')).toBe('/')
    expect(normalizeAuthRedirectPath('//evil.test/admin')).toBe('/')
    expect(normalizeAuthRedirectPath('admin/social-content')).toBe('/')

    await signInWithOAuth('google', 'https://evil.test/admin')

    expect(sessionStorage.getItem('auth_next_path')).toBeNull()
    expect(localStorage.getItem('auth_next_path')).toBeNull()
  })
})

describe('refreshCurrentSession', () => {
  beforeEach(() => {
    mocks.refreshSession.mockReset()
  })

  it('returns null when refresh reports an error, even if a session payload is present', async () => {
    mocks.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'partial-token' }, user: null },
      error: { message: 'refresh failed' },
    })

    expect(await refreshCurrentSession()).toBeNull()
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
  })

  it('returns the refreshed session only when refresh reports no error', async () => {
    const refreshed = { access_token: 'fresh-token' } as Session
    mocks.refreshSession.mockResolvedValue({
      data: { session: refreshed, user: null },
      error: null,
    })

    expect(await refreshCurrentSession()).toBe(refreshed)
  })

  it('returns null when refresh succeeds without a session', async () => {
    mocks.refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    })

    expect(await refreshCurrentSession()).toBeNull()
  })
})
