import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  createClient: vi.fn(),
  createSignedUrl: vi.fn(),
  triggerEbookNurtureSequence: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: mocks.createSignedUrl,
      })),
    },
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/n8n', () => ({
  triggerEbookNurtureSequence: mocks.triggerEbookNurtureSequence,
}))

import { GET } from './route'

const MAGNET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = {
  id: 'user-1',
  email: 'member@example.com',
  user_metadata: { full_name: 'Ada Lovelace' },
}

function authRequest(url: string, token = 'valid-token', extraHeaders: Record<string, string> = {}) {
  return new NextRequest(url, {
    headers: {
      authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
  })
}

function params(id = MAGNET_ID) {
  return { params: { id } }
}

function magnetQuery(data: unknown, error: unknown = null) {
  const query: Record<string, unknown> = {}
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.single = vi.fn().mockResolvedValue({ data, error })
  return query
}

function downloadInsertQuery(id = 'dl-1') {
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: { id }, error: null }),
    })),
  }))
  return { insert }
}

function incrementQuery() {
  const update = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  }))
  return { update }
}

function mockSuccessfulDownload(magnet: Record<string, unknown>) {
  const downloads = downloadInsertQuery()
  const increment = incrementQuery()
  mocks.from.mockImplementation((table: string) => {
    if (table === 'lead_magnets') {
      if (increment.update.mock.calls.length > 0 || downloads.insert.mock.calls.length > 0) {
        return increment
      }
      return magnetQuery(magnet)
    }
    if (table === 'lead_magnet_downloads') return downloads
    throw new Error(`Unexpected table: ${table}`)
  })
  return { downloads, increment }
}

describe('GET /api/lead-magnets/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    })
    mocks.getUser.mockResolvedValue({ data: { user: USER }, error: null })
    mocks.triggerEbookNurtureSequence.mockResolvedValue({ triggered: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects a non-UUID id', async () => {
    const response = await GET(
      authRequest('http://localhost/api/lead-magnets/bad-id/download'),
      params('bad-id'),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid lead magnet ID' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a bearer token', async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}/download`),
      params(),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns 404 when the magnet is missing or inactive', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') return magnetQuery(null, { message: 'missing' })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}/download`),
      params(),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Lead magnet not found' })
  })

  it('returns an external URL without creating a signed URL', async () => {
    const { downloads } = mockSuccessfulDownload({
      id: MAGNET_ID,
      title: 'External pack',
      type: 'link',
      file_path: 'https://cdn.example/pack.pdf',
      download_count: 2,
      slug: 'external-pack',
    })

    const response = await GET(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}/download`, 'valid-token', {
        'x-forwarded-for': '203.0.113.77',
      }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      downloadUrl: 'https://cdn.example/pack.pdf',
    })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
    expect(downloads.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: USER.id,
        lead_magnet_id: MAGNET_ID,
        ip_address: '203.0.113.0',
      }),
    ])
    expect(mocks.triggerEbookNurtureSequence).not.toHaveBeenCalled()
  })

  it('signs in-bucket paths and starts nurture for ebook downloads', async () => {
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/ebook.pdf' },
      error: null,
    })
    mockSuccessfulDownload({
      id: MAGNET_ID,
      title: 'AI Primer',
      type: 'ebook',
      file_path: 'ebooks/primer.pdf',
      download_count: 0,
      slug: 'ai-primer',
    })

    const response = await GET(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}/download`),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      downloadUrl: 'https://signed.example/ebook.pdf',
    })
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('ebooks/primer.pdf', 3600)
    expect(mocks.triggerEbookNurtureSequence).toHaveBeenCalledWith(expect.objectContaining({
      user_id: USER.id,
      user_email: USER.email,
      user_name: 'Ada Lovelace',
      lead_magnet_id: MAGNET_ID,
      lead_magnet_title: 'AI Primer',
      download_id: 'dl-1',
    }))
  })

  it('returns 404 when the signed URL cannot be created', async () => {
    mocks.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'object missing' },
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') {
        return magnetQuery({
          id: MAGNET_ID,
          title: 'Missing file',
          type: 'pdf',
          file_path: 'gone.pdf',
        })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(
      authRequest(`http://localhost/api/lead-magnets/${MAGNET_ID}/download`),
      params(),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'File not found or unavailable for download',
    })
    expect(mocks.triggerEbookNurtureSequence).not.toHaveBeenCalled()
  })
})
