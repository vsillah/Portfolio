import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

type QueryResult = { data: unknown; error: unknown; count?: number | null }

function thenableQuery(result: QueryResult) {
  const query = {
    update: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.update.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.is.mockReturnValue(query)
  return query
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/video-generation/jobs/batch-delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/video-generation/jobs/batch-delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication before parsing the body', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    const request = makeRequest({ jobIds: ['job-1'] })
    const jsonSpy = vi.spyOn(request, 'json')

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(jsonSpy).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an empty or non-array jobIds payload', async () => {
    const missing = await POST(makeRequest({}))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'No job IDs provided' })

    const empty = await POST(makeRequest({ jobIds: [] }))
    expect(empty.status).toBe(400)

    const notArray = await POST(makeRequest({ jobIds: 'job-1' }))
    expect(notArray.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('soft-deletes at most 50 live jobs', async () => {
    const query = thenableQuery({ data: null, error: null, count: null })
    mocks.from.mockReturnValue(query)
    const jobIds = Array.from({ length: 51 }, (_, i) => `job-${i}`)

    const response = await POST(makeRequest({ jobIds }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ deleted: 50 })
    expect(mocks.from).toHaveBeenCalledWith('video_generation_jobs')
    expect(query.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(query.in).toHaveBeenCalledWith('id', jobIds.slice(0, 50))
    expect(query.in.mock.calls[0][1]).toHaveLength(50)
    expect(query.is).toHaveBeenCalledWith('deleted_at', null)
  })
})
