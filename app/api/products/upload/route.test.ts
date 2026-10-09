import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        upload: mocks.upload,
        getPublicUrl: mocks.getPublicUrl,
      }),
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

describe('POST /api/products/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.upload.mockResolvedValue({ data: { path: 'ok' }, error: null })
    mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example/file' } })
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
      makeRequest({ file: new File(['x'], 'a.pdf', { type: 'application/pdf' }) }),
    )

    expect(response.status).toBe(401)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('returns 400 when no file is provided', async () => {
    const response = await POST(makeRequest({ productId: 'prod-1' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No file provided' })
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it.each([
    ['instructions', 'product-prod-1/instructions/'],
    ['card_image', 'product-prod-1/card-'],
    ['product', 'product-prod-1/'],
    ['other', 'product-prod-1/'],
  ] as const)('stores purpose=%s under %s', async (purpose, prefix) => {
    const file = new File(['hello'], 'Guide.PDF', { type: 'application/pdf' })
    const response = await POST(makeRequest({ file, productId: 'prod-1', purpose }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.file_path.startsWith(prefix)).toBe(true)
    expect(body.file_path.endsWith('.PDF')).toBe(true)
    expect(body.public_url).toBe('https://cdn.example/file')
    expect(body.file_type).toBe('application/pdf')
    expect(body.file_size).toBe(5)
    expect(mocks.upload).toHaveBeenCalledWith(
      body.file_path,
      file,
      { cacheControl: '3600', upsert: false },
    )
  })

  it('falls back to the uploads/ tree when productId is omitted', async () => {
    const file = new File(['img'], 'card.png', { type: 'image/png' })
    const response = await POST(makeRequest({ file, purpose: 'card_image' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.file_path.startsWith('uploads/cards/')).toBe(true)
  })

  it('returns the storage error message on the 500 path', async () => {
    mocks.upload.mockResolvedValue({ data: null, error: { message: 'bucket missing' } })
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })

    const response = await POST(makeRequest({ file, productId: 'prod-1' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'bucket missing' })
  })
})
