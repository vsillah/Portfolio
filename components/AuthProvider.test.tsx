import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthProvider'

const authMocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getCurrentUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: authMocks.getCurrentSession,
  getCurrentUser: authMocks.getCurrentUser,
  onAuthStateChange: authMocks.onAuthStateChange,
}))

function AuthProbe() {
  const { loading, user, session, profile } = useAuth()

  return (
    <div>
      <div data-testid="status">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{user ? 'user' : 'no-user'}</div>
      <div data-testid="session">{session ? 'session' : 'no-session'}</div>
      <div data-testid="profile">{profile ? 'profile' : 'no-profile'}</div>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    authMocks.getCurrentSession.mockReset()
    authMocks.getCurrentUser.mockReset()
    authMocks.onAuthStateChange.mockReset()
    authMocks.unsubscribe.mockReset()
    authMocks.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: authMocks.unsubscribe,
        },
      },
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('fails closed when initial session restore stalls', async () => {
    authMocks.getCurrentSession.mockReturnValue(new Promise(() => {}))
    authMocks.getCurrentUser.mockResolvedValue(null)

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByTestId('status')).toHaveTextContent('loading')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000)
      await Promise.resolve()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('ready')
    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(screen.getByTestId('session')).toHaveTextContent('no-session')
    expect(screen.getByTestId('profile')).toHaveTextContent('no-profile')
  })
})
