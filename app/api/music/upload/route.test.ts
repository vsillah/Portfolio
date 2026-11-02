import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: (bucket: string) => {
        expect(bucket).toBe('music')
        return { upload: mocks.upload }
      },
    },
  },
}))

import { POST } from './route'

function makeRequest(fields: Record<string, string | File | null>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) form.append(key, value)
  }
  return {
    formData: async () => form,
  } as unknown as NextRequest
}

describe('POST /api/music/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.upload.mockResolvedValue({ data: { path: 'ok' }, error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated callers before reading the file', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(
      makeRequest({ file: new File(['x'], 'track.mp3', { type: 'audio/mpeg' }) }),
    )

    expect(response.status).toBe(401)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('returns 400 when no file is provided', async () => {
    const response = await POST(makeRequest({ musicId: '12' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No file provided' })
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('stores files under music-{id}/ when musicId is present', async () => {
    const file = new File(['riff'], 'Track.MP3', { type: 'audio/mpeg' })
    const response = await POST(makeRequest({ file, musicId: '12' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.file_path.startsWith('music-12/')).toBe(true)
    expect(body.file_path.endsWith('.MP3')).toBe(true)
    expect(body.file_type).toBe('audio/mpeg')
    expect(body.file_size).toBe(4)
    expect(mocks.upload).toHaveBeenCalledWith(body.file_path, file, {
      cacheControl: '3600',
      upsert: false,
    })
  })

  it('falls back to the uploads/ tree when musicId is omitted', async () => {
    const file = new File(['riff'], 'track.mp3', { type: 'audio/mpeg' })
    const response = await POST(makeRequest({ file }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.file_path.startsWith('uploads/')).toBe(true)
  })

  it('returns the storage error message on the 500 path', async () => {
    mocks.upload.mockResolvedValue({ data: null, error: { message: 'bucket missing' } })
    const file = new File(['x'], 'track.mp3', { type: 'audio/mpeg' })

    const response = await POST(makeRequest({ file, musicId: '12' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'bucket missing' })
  })
})
