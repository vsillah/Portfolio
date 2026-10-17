import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  upload: vi.fn(),
  storageFrom: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: (...args: unknown[]) => mocks.storageFrom(...args),
    },
  },
}))

import { POST } from './route'

function makeRequest(fields: Record<string, string | File>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value)
  }
  return { formData: async () => form } as unknown as NextRequest
}

describe('POST /api/videos/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.upload.mockResolvedValue({ data: { path: 'ok' }, error: null })
    mocks.storageFrom.mockReturnValue({ upload: mocks.upload })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated callers before uploading', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(
      makeRequest({ file: new File(['x'], 'clip.mp4', { type: 'video/mp4' }) }),
    )

    expect(response.status).toBe(403)
    expect(mocks.storageFrom).not.toHaveBeenCalled()
  })

  it('returns 400 when no file is provided', async () => {
    const response = await POST(makeRequest({ videoId: 'vid-1' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No file provided' })
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('uploads into the videos bucket under video-{id}/ when videoId is set', async () => {
    const file = new File(['bytes'], 'clip.mp4', { type: 'video/mp4' })
    const response = await POST(makeRequest({ file, videoId: 'vid-9' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.storageFrom).toHaveBeenCalledWith('videos')
    expect(body.file_path.startsWith('video-vid-9/')).toBe(true)
    expect(body.file_path.endsWith('.mp4')).toBe(true)
    expect(body.file_type).toBe('video/mp4')
    expect(body.file_size).toBe(5)
    expect(mocks.upload).toHaveBeenCalledWith(
      body.file_path,
      file,
      { cacheControl: '3600', upsert: false },
    )
  })

  it('uses uploads/ when videoId is omitted', async () => {
    const file = new File(['bytes'], 'clip.mp4', { type: 'video/mp4' })
    const response = await POST(makeRequest({ file }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.file_path.startsWith('uploads/')).toBe(true)
  })
})
