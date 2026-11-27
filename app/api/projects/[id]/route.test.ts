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

import { DELETE, GET, PUT } from './route'

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/projects/12', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function params(id = '12') {
  return { params: { id } }
}

function mockSelectSingle(result: { data: unknown; error: { code?: string; message?: string } | null }) {
  const single = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockReturnValue({ select })
  return { eq }
}

describe('GET /api/projects/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns an unpublished project, including file_path, without auth', async () => {
    const project = {
      id: 12,
      title: 'Draft',
      is_published: false,
      file_path: 'projects/secret.pdf',
    }
    const { eq } = mockSelectSingle({ data: project, error: null })

    const response = await GET(makeRequest('GET'), params())

    expect(response.status).toBe(200)
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('id', '12')
    await expect(response.json()).resolves.toEqual(project)
  })

  it('returns 404 when the project is missing', async () => {
    mockSelectSingle({ data: null, error: { code: 'PGRST116', message: 'not found' } })

    const response = await GET(makeRequest('GET'), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Project not found' })
  })

  it('returns the database error message on unexpected failures', async () => {
    mockSelectSingle({ data: null, error: { code: 'XX000', message: 'projects read failed' } })

    const response = await GET(makeRequest('GET'), params())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'projects read failed' })
  })
})

describe('PUT /api/projects/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before updating', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(makeRequest('PUT', { title: 'Updated' }), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/projects/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before deleting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(makeRequest('DELETE'), params())

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
