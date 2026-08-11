import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginForm from './LoginForm'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  search: '',
  signIn: vi.fn(async () => ({ data: {}, error: null })),
  signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}))

vi.mock('@/lib/auth', () => ({
  normalizeAuthRedirectPath: (path: string | null | undefined) => {
    if (!path || !path.startsWith('/') || path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return '/'
    return path
  },
  signIn: mocks.signIn,
  signInWithOAuth: mocks.signInWithOAuth,
}))

describe('LoginForm redirect preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    localStorage.clear()
    mocks.search = ''
  })

  it('stores and forwards the exact safe admin deep link for OAuth login', async () => {
    const redirect = '/admin/social-content/social-1?returnTo=%2Fadmin%2Fsocial-content&step=submit'
    mocks.search = `redirect=${encodeURIComponent(redirect)}`

    render(<LoginForm />)

    await waitFor(() => {
      expect(sessionStorage.getItem('auth_next_path')).toBe(redirect)
      expect(localStorage.getItem('auth_next_path')).toBe(redirect)
    })

    fireEvent.click(screen.getByRole('button', { name: /Google/i }))

    await waitFor(() => {
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith('google', redirect)
    })
  })
})
