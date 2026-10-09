import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createSignedUrl: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: () => ({
        createSignedUrl: mocks.createSignedUrl,
      }),
    },
  },
}))

import { GET } from './route'

function makeRequest(id: string, range?: string) {
  return new NextRequest(`http://localhost/api/publications/${id}/audio`, {
    headers: range ? { range } : undefined,
  })
}

function mockPublication(row: {
  id: string
  audio_file_path: string | null
  is_published: boolean
} | null) {
  const single = vi.fn().mockResolvedValue({
    data: row,
    error: row ? null : { message: 'not found' },
  })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockReturnValue({ select })
  return { select, eq, single }
}

describe('GET /api/publications/[id]/audio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/audio.mp3' },
      error: null,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns 400 when the publication id is empty', async () => {
    const response = await GET(makeRequest(''), { params: { id: '' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Publication ID required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the publication is missing', async () => {
    mockPublication(null)

    const response = await GET(makeRequest('pub-1'), { params: { id: 'pub-1' } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Publication not found' })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('returns 404 when there is no audio file path', async () => {
    mockPublication({ id: 'pub-1', audio_file_path: null, is_published: true })

    const response = await GET(makeRequest('pub-1'), { params: { id: 'pub-1' } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'No audio for this publication',
    })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('hides unpublished audio behind a generic 404', async () => {
    mockPublication({
      id: 'pub-1',
      audio_file_path: 'drafts/secret.mp3',
      is_published: false,
    })

    const response = await GET(makeRequest('pub-1'), { params: { id: 'pub-1' } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Not available' })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('streams published audio and forwards Range to the signed URL', async () => {
    mockPublication({
      id: 'pub-1',
      audio_file_path: 'audio/chapter-1.mp3',
      is_published: true,
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 206,
      headers: new Headers({
        'content-type': 'audio/mpeg',
        'content-length': '100',
        'accept-ranges': 'bytes',
        'content-range': 'bytes 0-99/1000',
      }),
      body: null,
      text: async () => '',
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(makeRequest('pub-1', 'bytes=0-99'), {
      params: { id: 'pub-1' },
    })

    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(response.headers.get('Content-Range')).toBe('bytes 0-99/1000')
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('audio/chapter-1.mp3', 3600)
    expect(fetchMock).toHaveBeenCalledWith('https://signed.example/audio.mp3', {
      headers: { Range: 'bytes=0-99' },
    })
  })
})
