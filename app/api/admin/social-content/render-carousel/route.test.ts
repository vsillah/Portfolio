import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  renderCarousel: vi.fn(),
  from: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  updates: [] as unknown[],
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (result: { error?: string }) => Boolean(result && 'error' in result),
}))

vi.mock('@/lib/carousel', () => ({
  renderCarousel: mocks.renderCarousel,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: vi.fn(() => ({
        upload: mocks.upload,
        getPublicUrl: mocks.getPublicUrl,
      })),
    },
  },
}))

import { POST } from './route'

const slides = [
  { headline: 'One', body: 'First' },
  { headline: 'Two', body: 'Second' },
]

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/admin/social-content/render-carousel', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/social-content/render-carousel', () => {
  const originalSecret = process.env.N8N_INGEST_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updates = []
    process.env.N8N_INGEST_SECRET = 'test-secret'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.renderCarousel.mockResolvedValue({
      pngBuffers: [Buffer.from('a'), Buffer.from('b')],
      pdfBuffer: Buffer.from('pdf'),
    })
    mocks.upload.mockResolvedValue({ error: null })
    mocks.getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.example/${path}` },
    }))
    mocks.from.mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.single = vi.fn().mockResolvedValue({
        data: { carousel_slides: slides },
        error: null,
      })
      chain.update = vi.fn((payload: unknown) => {
        mocks.updates.push({ table, payload })
        return chain
      })
      return chain
    })
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.N8N_INGEST_SECRET
    else process.env.N8N_INGEST_SECRET = originalSecret
  })

  it('rejects a non-admin when the bearer token does not match', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(request({ content_id: 'content-1' }, { authorization: 'bearer test-secret' }))

    expect(response.status).toBe(401)
    expect(mocks.renderCarousel).not.toHaveBeenCalled()
  })

  it('accepts the n8n bearer and skips the admin session', async () => {
    const response = await POST(request(
      { content_id: 'content-1', carousel_slides: slides },
      { authorization: 'Bearer test-secret' },
    ))

    expect(response.status).toBe(200)
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
  })

  it('treats a missing secret and a missing authorization header as n8n auth', async () => {
    delete process.env.N8N_INGEST_SECRET

    const response = await POST(request({}))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'content_id is required' })
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
  })

  it('requires content_id and falls back to stored slides', async () => {
    const missing = await POST(request({ carousel_slides: slides }))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'content_id is required' })

    mocks.from.mockImplementation(() => {
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.single = vi.fn().mockResolvedValue({ data: { carousel_slides: null }, error: null })
      return chain
    })
    const empty = await POST(request({ content_id: 'content-1', carousel_slides: [] }))
    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual({ error: 'No carousel_slides found for this content' })
    expect(mocks.renderCarousel).not.toHaveBeenCalled()
  })

  it('skips a failed slide upload, keeps a failed PDF null, and still updates the row', async () => {
    mocks.upload.mockImplementation(async (path: string) => (
      path.endsWith('slide_01.png') || path.endsWith('carousel.pdf')
        ? { error: { message: 'storage down' } }
        : { error: null }
    ))

    const response = await POST(request({ content_id: 'content-1', carousel_slides: slides }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      carousel_slide_urls: ['https://cdn.example/carousels/content-1/slide_02.png'],
      carousel_pdf_url: null,
      slide_count: 2,
    })
    expect(mocks.updates).toEqual([
      {
        table: 'social_content_queue',
        payload: {
          carousel_slide_urls: ['https://cdn.example/carousels/content-1/slide_02.png'],
          carousel_pdf_url: null,
          content_format: 'carousel',
        },
      },
    ])
  })

  it('hides invalid JSON and renderer exceptions behind a generic message', async () => {
    const invalid = await POST(new NextRequest('http://localhost/api/admin/social-content/render-carousel', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret', 'content-type': 'application/json' },
      body: '{',
    }))
    expect(invalid.status).toBe(500)
    expect(await invalid.json()).toEqual({ error: 'Failed to render carousel. Please try again.' })

    mocks.renderCarousel.mockRejectedValue(new Error('playwright crashed'))
    const response = await POST(request(
      { content_id: 'content-1', carousel_slides: slides },
      { authorization: 'Bearer test-secret' },
    ))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to render carousel. Please try again.' })
  })
})
