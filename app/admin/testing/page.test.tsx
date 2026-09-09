import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react'
import TestingPage from './page'
import { getCurrentSession } from '@/lib/auth'
vi.mock('@/lib/auth', () => ({ getCurrentSession: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/testing' }))
vi.mock('@/components/admin/Breadcrumbs', () => ({ default: () => <nav>Testing navigation</nav> }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentSession).mockResolvedValue({ access_token: 'synthetic-token', expires_at: Date.now() / 1000 + 300 } as Awaited<ReturnType<typeof getCurrentSession>>)
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    expect(String(url)).toMatch(/^\/api\/testing\//)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-token')
    return new Response(JSON.stringify({ runs: [], activeRuns: [], requests: [] }))
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('testing dashboard authorization states', () => {
  it.each([401, 403])('shows a persistent HTTP %i failure and permits retry to a real empty result', async status => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status }))
    render(<TestingPage />)
    const expected = status === 401 ? 'Sign in again to use testing tools.' : 'Admin access is required for testing tools.'
    expect(await screen.findByRole('alert')).toHaveTextContent(expected)
    expect(screen.queryByText('No test runs yet')).not.toBeInTheDocument()
    expect(screen.getByText('Testing data unavailable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth/login?redirect=/admin/testing')
    fireEvent.click(screen.getByRole('button', { name: 'Retry testing data' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByText('No test runs yet')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it.each(['missing', 'expired'])('shows session recovery for %s session without an API call', async mode => {
    vi.mocked(getCurrentSession).mockResolvedValue(mode === 'missing' ? null : { access_token: 'old', expires_at: 1 } as Awaited<ReturnType<typeof getCurrentSession>>)
    render(<TestingPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in again')
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByText('No test runs yet')).not.toBeInTheDocument()
  })
  it('keeps a denied log action visible after a successful list refresh and never shows a false empty log', async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-token')
      if (String(url).includes('/status?')) return new Response('{}', { status: 403 })
      return new Response(JSON.stringify({ runs: [{ id: 'one', run_id: 'synthetic-run', status: 'completed',
        started_at: '2026-09-06T00:00:00Z', clients_spawned: 1, clients_completed: 1, clients_failed: 0, config: {} }], activeRuns: [], requests: [] }))
    })
    render(<TestingPage />)
    fireEvent.click(await screen.findByRole('button', { name: /^Log$/ }))
    await waitFor(() => expect(screen.getAllByRole('alert').some(el => el.textContent?.includes('Admin access'))).toBe(true))
    expect(screen.queryByText('No errors for this run')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(5))
    expect(screen.getAllByRole('alert').some(el => el.textContent?.includes('Admin access'))).toBe(true)
    expect(screen.queryByText('No errors for this run')).not.toBeInTheDocument()
  })

  it('removes stale rows after a denied list refresh', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ runs: [{ id: 'one', run_id: 'synthetic-run', status: 'completed',
      started_at: '2026-09-06T00:00:00Z', clients_spawned: 1, clients_completed: 1, clients_failed: 0, config: {} }], activeRuns: [], requests: [] })))
    render(<TestingPage />)
    expect(await screen.findByText('synthetic-run')).toBeInTheDocument()
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 401 }))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in again')
    expect(screen.queryByText('synthetic-run')).not.toBeInTheDocument()
    expect(screen.getByText('Testing data unavailable')).toBeInTheDocument()
  })

  it('ignores a late log response from a previous run', async () => {
    let resolveOld!: (value: Response) => void
    const oldResponse = new Promise<Response>(resolve => { resolveOld = resolve })
    vi.mocked(fetch).mockImplementation(async url => {
      if (String(url).includes('runId=first')) return oldResponse
      if (String(url).includes('runId=second')) return new Response('{}', { status: 403 })
      return new Response(JSON.stringify({ runs: ['first', 'second'].map(id => ({ id, run_id: id, status: 'completed',
        started_at: '2026-09-06T00:00:00Z', clients_spawned: 1, clients_completed: 1, clients_failed: 0, config: {} })), activeRuns: [], requests: [] }))
    })
    render(<TestingPage />)
    fireEvent.click((await screen.findAllByRole('button', { name: /^Log$/ }))[0])
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getAllByRole('button', { name: /^Log$/ })[1])
    await waitFor(() => expect(screen.getAllByRole('alert').some(el => el.textContent?.includes('Admin access'))).toBe(true))
    await act(async () => {
      resolveOld(new Response(JSON.stringify({ recentErrors: [] })))
      await oldResponse
    })
    await waitFor(() => expect(screen.queryByText('No errors for this run')).not.toBeInTheDocument())
    expect(screen.getAllByRole('alert').some(el => el.textContent?.includes('Admin access'))).toBe(true)
  })

})
