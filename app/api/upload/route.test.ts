import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  isAuthError: vi.fn(),
  storageFrom: vi.fn(),
  storageUpload: vi.fn(),
  getPublicUrl: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAuth: mocks.verifyAuth,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: mocks.storageFrom,
    },
  },
}))

import { POST } from './route'

function makeRequest(fields: {
  file?: { name: string; type: string; size: number } | null
  bucket?: string
  folder?: string
  omitFile?: boolean
}) {
  const values = new Map<string, unknown>()
  if (!fields.omitFile && fields.file !== null) {
    const meta = fields.file ?? {
      name: 'photo.png',
      type: 'image/png',
      size: 1024,
    }
    values.set('file', {
      name: meta.name,
      type: meta.type,
      size: meta.size,
      arrayBuffer: vi.fn(async () => Buffer.from('file-bytes').buffer),
    })
  }
  if (fields.bucket !== undefined) values.set('bucket', fields.bucket)
  if (fields.folder !== undefined) values.set('folder', fields.folder)

  const request = new NextRequest('http://localhost/api/upload', { method: 'POST' })
  vi.spyOn(request, 'formData').mockResolvedValue({
    get: vi.fn((key: string) => (values.has(key) ? values.get(key) : null)),
  } as unknown as FormData)
  return request
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' }, isAdmin: false })
    mocks.isAuthError.mockReturnValue(false)
    mocks.storageFrom.mockReturnValue({
      upload: mocks.storageUpload,
      getPublicUrl: mocks.getPublicUrl,
    })
    mocks.storageUpload.mockResolvedValue({
      data: { path: '1700000000000-photo.png' },
      error: null,
    })
    mocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.example/1700000000000-photo.png' },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated requests before reading the file', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({}))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.storageFrom).not.toHaveBeenCalled()
  })

  it('returns 400 when no file is provided', async () => {
    const response = await POST(makeRequest({ omitFile: true }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No file provided' })
    expect(mocks.storageFrom).not.toHaveBeenCalled()
  })

  it('rejects unsupported file types', async () => {
    const response = await POST(
      makeRequest({
        file: { name: 'payload.zip', type: 'application/zip', size: 100 },
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Unsupported file type. Allowed: images, PDF, DOCX, PPTX, text, CSV.',
    })
    expect(mocks.storageFrom).not.toHaveBeenCalled()
  })

  it('rejects files larger than 10MB', async () => {
    const response = await POST(
      makeRequest({
        file: {
          name: 'huge.pdf',
          type: 'application/pdf',
          size: 10 * 1024 * 1024 + 1,
        },
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'File size must be less than 10MB',
    })
    expect(mocks.storageFrom).not.toHaveBeenCalled()
  })

  it('uploads an allowed file to the default products bucket', async () => {
    const response = await POST(
      makeRequest({
        file: { name: 'Q2 report.pdf', type: 'application/pdf', size: 2048 },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      path: '1700000000000-photo.png',
      publicUrl: 'https://cdn.example/1700000000000-photo.png',
    })
    expect(mocks.storageFrom).toHaveBeenCalledWith('products')
    expect(mocks.storageUpload).toHaveBeenCalledWith(
      '1700000000000-Q2_report.pdf',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'application/pdf',
        upsert: false,
      }),
    )
  })

  it('prefixes a folder when provided', async () => {
    await POST(
      makeRequest({
        file: { name: 'notes.txt', type: 'text/plain', size: 12 },
        bucket: 'client-assets',
        folder: 'kickoff',
      }),
    )

    expect(mocks.storageFrom).toHaveBeenCalledWith('client-assets')
    expect(mocks.storageUpload).toHaveBeenCalledWith(
      'kickoff/1700000000000-notes.txt',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'text/plain' }),
    )
  })
})
