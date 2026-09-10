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

function getRequest() {
  return new NextRequest('http://localhost/api/videos/9')
}

function mutationRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/videos/9', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

const params = { params: { id: '9' } }

describe('GET /api/videos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns unpublished rows including file_path without auth', async () => {
    const row = { id: 9, title: 'Draft', is_published: false, file_path: 'videos/draft.mp4' }
    const single = vi.fn().mockResolvedValue({ data: row, error: null })
    const eq = vi.fn().mockReturnValue({ single })
    mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) })

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(200)
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('id', '9')
    await expect(response.json()).resolves.toEqual(row)
  })

  it('maps PGRST116 to 404', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }),
    })

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Video not found' })
  })

  it('returns the database error message on unexpected failures', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'video detail failed' },
    })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }),
    })

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'video detail failed' })
  })
})

describe('PUT /api/videos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before updating', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(mutationRequest('PUT', { title: 'Renamed' }), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('writes only provided fields plus updated_at', async () => {
    const updated = { id: 9, title: 'Renamed', is_published: false }
    const single = vi.fn().mockResolvedValue({ data: updated, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    const response = await PUT(mutationRequest('PUT', { title: 'Renamed', is_published: false }), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: updated })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Renamed',
        is_published: false,
        updated_at: expect.any(String),
      }),
    )
    const payload = update.mock.calls[0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('video_url')
    expect(eq).toHaveBeenCalledWith('id', '9')
  })
})

describe('DELETE /api/videos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before deleting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(mutationRequest('DELETE'), params)

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes the row and returns 204 with an empty body', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ delete: del })

    const response = await DELETE(mutationRequest('DELETE'), params)

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(mocks.from).toHaveBeenCalledWith('videos')
    expect(eq).toHaveBeenCalledWith('id', '9')
  })
})
