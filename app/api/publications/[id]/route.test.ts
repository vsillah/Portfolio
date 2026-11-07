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

const params = { params: { id: '7' } }

function getRequest() {
  return new NextRequest('http://localhost/api/publications/7')
}

function putRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/publications/7', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deleteRequest() {
  return new NextRequest('http://localhost/api/publications/7', {
    method: 'DELETE',
  })
}

describe('GET /api/publications/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns unpublished publications including file_path without auth', async () => {
    const unpublished = {
      id: 7,
      title: 'Draft',
      is_published: false,
      file_path: 'pubs/draft.pdf',
    }
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: unpublished, error: null }),
        }),
      }),
    })

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(unpublished)
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
  })

  it('returns 404 when the publication is missing', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          }),
        }),
      }),
    })

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Publication not found' })
  })
})

describe('PUT /api/publications/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before updating', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(putRequest({ title: 'Renamed' }), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('nulls empty audiobook and audio fields', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 7, title: 'Renamed' },
            error: null,
          }),
        }),
      }),
    })
    mocks.from.mockReturnValue({ update })

    const response = await PUT(
      putRequest({
        title: 'Renamed',
        audiobook_lead_magnet_id: '',
        audio_preview_url: '',
        audio_file_path: '',
      }),
      params,
    )

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Renamed',
        audiobook_lead_magnet_id: null,
        audio_preview_url: null,
        audio_file_path: null,
      }),
    )
  })
})

describe('DELETE /api/publications/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before deleting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(deleteRequest(), params)

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 204 on successful delete', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq }),
    })

    const response = await DELETE(deleteRequest(), params)

    expect(response.status).toBe(204)
    expect(eq).toHaveBeenCalledWith('id', '7')
    expect(await response.text()).toBe('')
  })
})
