import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  authState: {
    user: null as { id: string } | null,
    profile: null as { role: 'user' | 'admin' } | null,
    loading: false,
    isAdmin: false,
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => mocks.authState,
}))

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mocks.push.mockClear()
    Object.assign(mocks.authState, {
      user: null,
      profile: null,
      loading: false,
      isAdmin: false,
    })
    window.history.replaceState({}, '', '/')
  })

  it('preserves full deep links when redirecting unauthenticated users to login', async () => {
    window.history.replaceState({}, '', '/admin/outreach?tab=queue#drafts')

    render(
      <ProtectedRoute>
        <div>Admin queue</div>
      </ProtectedRoute>,
    )

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(
        `/auth/login?redirect=${encodeURIComponent('/admin/outreach?tab=queue#drafts')}`,
      )
    })
    expect(screen.queryByText('Admin queue')).not.toBeInTheDocument()
  })

  it('does not redirect while auth state is still loading', () => {
    mocks.authState.loading = true

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
