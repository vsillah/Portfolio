import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  fetchVideoContextByEmail: vi.fn(),
  fetchVideoContext: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/video-context', () => ({
  fetchVideoContextByEmail: mocks.fetchVideoContextByEmail,
  fetchVideoContext: mocks.fetchVideoContext,
}))

import { GET } from './route'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function request(query = '', authHeader?: string) {
  return new NextRequest(`http://localhost/api/video-context${query}`, {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('GET /api/video-context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.N8N_INGEST_SECRET = 'ingest-secret'
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    mocks.fetchVideoContextByEmail.mockResolvedValue({ found: true, source_type: 'lead' })
    mocks.fetchVideoContext.mockResolvedValue({ found: true, source_type: 'client_project' })
  })

  afterEach(() => {
    restoreEnv()
  })

  it('rejects callers without admin auth or the ingest secret', async () => {
    const response = await GET(request('?email=owner@example.com'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.fetchVideoContextByEmail).not.toHaveBeenCalled()
  })

  it('rejects a bearer token that does not match the ingest secret', async () => {
    const response = await GET(request('?email=owner@example.com', 'Bearer other-secret'))

    expect(response.status).toBe(401)
    expect(mocks.fetchVideoContextByEmail).not.toHaveBeenCalled()
  })

  it('allows an admin session without the ingest secret', async () => {
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)

    const response = await GET(request('?email=%20Owner@Example.COM%20'))

    expect(response.status).toBe(200)
    expect(mocks.fetchVideoContextByEmail).toHaveBeenCalledWith('owner@example.com')
    await expect(response.json()).resolves.toEqual({ found: true, source_type: 'lead' })
  })

  it('allows the n8n ingest secret and requires email or target+id', async () => {
    const missing = await GET(request('', 'Bearer ingest-secret'))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({
      error: 'Provide email= or target= and id=',
    })

    const byTarget = await GET(
      request('?target=client_project&id=proj-1', 'Bearer ingest-secret'),
    )
    expect(byTarget.status).toBe(200)
    expect(mocks.fetchVideoContext).toHaveBeenCalledWith('client_project', 'proj-1')
  })

  it('prefers email lookup over target+id when both are present', async () => {
    const response = await GET(
      request('?email=owner@example.com&target=lead&id=lead-1', 'Bearer ingest-secret'),
    )

    expect(response.status).toBe(200)
    expect(mocks.fetchVideoContextByEmail).toHaveBeenCalledWith('owner@example.com')
    expect(mocks.fetchVideoContext).not.toHaveBeenCalled()
  })
})
