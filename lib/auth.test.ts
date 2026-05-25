import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(async () => ({ data: { provider: 'google' }, error: null })),
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
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

import { getStoredAuthNextPath, signInWithOAuth } from './auth'

describe('auth redirect helpers', () => {
  beforeEach(() => {
    mocks.signInWithOAuth.mockClear()
    sessionStorage.clear()
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('stores the post-OAuth path while keeping Supabase callback URLs bare', async () => {
    window.history.replaceState({}, '', '/store')

    await signInWithOAuth('google', '/admin/outreach?tab=queue#drafts')

    expect(sessionStorage.getItem('auth_next_path')).toBe('/admin/outreach?tab=queue#drafts')
    expect(localStorage.getItem('auth_next_path')).toBe('/admin/outreach?tab=queue#drafts')
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
})
