import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getSignedUrl: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/storage', () => ({
  getSignedUrl: mocks.getSignedUrl,
}))

import { GET } from './route'

function makeRequest(id = '12') {
  return new NextRequest(`http://localhost/api/projects/${id}/download`)
}

function params(id = '12') {
  return { params: { id } }
}

function mockPublishedLookup(result: { data: unknown; error: { message?: string } | null }) {
  const single = vi.fn().mockResolvedValue(result)
  const publishedEq = vi.fn().mockReturnValue({ single })
  const idEq = vi.fn().mockReturnValue({ eq: publishedEq })
  const select = vi.fn().mockReturnValue({ eq: idEq })
  mocks.from.mockReturnValue({ select })
  return { idEq, publishedEq }
}

describe('GET /api/projects/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getSignedUrl.mockResolvedValue('https://signed.example/project.zip')
  })

  it('rejects a non-numeric project id before querying', async () => {
    const response = await GET(makeRequest('abc'), params('abc'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid project ID' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the project is missing or unpublished', async () => {
    mockPublishedLookup({ data: null, error: { message: 'not found' } })

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Project not found' })
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it('returns 404 when a published project has no file', async () => {
    const { idEq, publishedEq } = mockPublishedLookup({
      data: { id: 12, is_published: true, file_path: null },
      error: null,
    })

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'No file available for this project' })
    expect(idEq).toHaveBeenCalledWith('id', 12)
    expect(publishedEq).toHaveBeenCalledWith('is_published', true)
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it('returns a one-hour signed URL for a published file', async () => {
    mockPublishedLookup({
      data: { id: 12, is_published: true, file_path: 'projects/deck.pdf' },
      error: null,
    })

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      downloadUrl: 'https://signed.example/project.zip',
    })
    expect(mocks.getSignedUrl).toHaveBeenCalledWith('projects', 'projects/deck.pdf', 3600)
  })

  it('returns the thrown error message when signed URL generation fails', async () => {
    mockPublishedLookup({
      data: { id: 12, is_published: true, file_path: 'projects/deck.pdf' },
      error: null,
    })
    mocks.getSignedUrl.mockRejectedValue(new Error('storage timeout'))

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'storage timeout' })
  })
})
