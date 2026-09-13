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

describe('POST /api/publications/upload', () => {
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
      makeRequest({ file: new File(['x'], 'book.pdf', { type: 'application/pdf' }) }),
    )

    expect(response.status).toBe(403)
    expect(mocks.storageFrom).not.toHaveBeenCalled()
  })

  it('returns 400 when no file is provided', async () => {
    const response = await POST(makeRequest({ publicationId: 'pub-1' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No file provided' })
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('uploads into the publications bucket under publication-{id}/', async () => {
    const file = new File(['ebook'], 'book.pdf', { type: 'application/pdf' })
    const response = await POST(makeRequest({ file, publicationId: 'pub-4' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.storageFrom).toHaveBeenCalledWith('publications')
    expect(body.file_path.startsWith('publication-pub-4/')).toBe(true)
    expect(body.file_path.endsWith('.pdf')).toBe(true)
    expect(body.file_type).toBe('application/pdf')
    expect(body.file_size).toBe(5)
    expect(mocks.upload).toHaveBeenCalledWith(
      body.file_path,
      file,
      { cacheControl: '3600', upsert: false },
    )
  })

  it('uses uploads/ when publicationId is omitted', async () => {
    const file = new File(['ebook'], 'book.pdf', { type: 'application/pdf' })
    const response = await POST(makeRequest({ file }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.file_path.startsWith('uploads/')).toBe(true)
  })
})
