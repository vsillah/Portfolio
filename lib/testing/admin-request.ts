import { getCurrentSession } from '@/lib/auth'

export class TestingRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'TestingRequestError'
  }
}

/** Send the current session token only to the local testing API; never follow redirects. */
export async function testingAdminRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, window.location.origin)
  if (!path.startsWith('/api/testing/') || /\\|%2f|%5c/i.test(url.pathname) || url.origin !== window.location.origin ||
      !url.pathname.startsWith('/api/testing/')) {
    throw new TestingRequestError('Invalid testing request destination', 400)
  }
  const session = await getCurrentSession()
  if (!session?.access_token || (session.expires_at != null && session.expires_at <= Date.now() / 1000)) {
    throw new TestingRequestError('Sign in again to use testing tools.', 401)
  }
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  const response = await fetch(url.pathname + url.search, { ...init, headers, redirect: 'error' })
  if (!response.ok) {
    if (response.status === 401) throw new TestingRequestError('Sign in again to use testing tools.', 401)
    if (response.status === 403) throw new TestingRequestError('Admin access is required for testing tools.', 403)
    if (response.status === 400 || response.status === 404) {
      const body = await response.json().catch(() => null)
      if (typeof body?.error === 'string' && body.error.trim()) {
        throw new TestingRequestError(body.error.trim().slice(0, 300), response.status)
      }
    }
    throw new TestingRequestError('Testing request failed. Try again.', response.status)
  }
  return response
}
