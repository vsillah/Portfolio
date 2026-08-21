import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  createSignedUrl: vi.fn(),
  triggerEbookNurtureSequence: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mocks.getUser },
  })),
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

vi.mock('@/lib/n8n', () => ({
  triggerEbookNurtureSequence: mocks.triggerEbookNurtureSequence,
}))

import { GET } from './route'

const MAGNET_ID = '11111111-1111-1111-1111-111111111111'
const USER = {
  id: 'user-1',
  email: 'reader@example.com',
  user_metadata: { full_name: 'Reader One' },
}

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest(
  id: string,
  {
    token,
    ipHeaders = {},
  }: { token?: string | null; ipHeaders?: Record<string, string> } = {},
) {
  const headers = new Headers()
  if (token !== null) {
    headers.set('authorization', `Bearer ${token ?? 'valid-token'}`)
  }
  for (const [key, value] of Object.entries(ipHeaders)) {
    headers.set(key, value)
  }

  return new NextRequest(`http://localhost/api/lead-magnets/${id}/download`, {
    method: 'GET',
    headers,
  })
}

function params(id: string) {
  return { params: { id } }
}

function createChain(singleResult: { data: unknown; error: unknown }) {
  const chain: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    single: vi.fn().mockResolvedValue(singleResult),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  return chain
}

function mockLeadMagnet(magnet: Record<string, unknown> | null, downloadId = 'dl-1') {
  const magnetChain = createChain({
    data: magnet,
    error: magnet ? null : { message: 'not found' },
  })
  const downloadChain = createChain({
    data: { id: downloadId },
    error: null,
  })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'lead_magnets') return magnetChain
    if (table === 'lead_magnet_downloads') return downloadChain
    throw new Error(`Unexpected table: ${table}`)
  })

  return { magnetChain, downloadChain }
}

describe('GET /api/lead-magnets/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
    mocks.getUser.mockResolvedValue({ data: { user: USER }, error: null })
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/file.pdf' },
      error: null,
    })
    mocks.triggerEbookNurtureSequence.mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreEnv()
    vi.restoreAllMocks()
  })

  it('rejects malformed lead magnet ids before auth or storage work', async () => {
    const response = await GET(makeRequest('not-a-uuid'), params('not-a-uuid'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid lead magnet ID' })
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects missing bearer tokens', async () => {
    const response = await GET(makeRequest(MAGNET_ID, { token: null }), params(MAGNET_ID))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid auth tokens', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } })

    const response = await GET(makeRequest(MAGNET_ID), params(MAGNET_ID))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the active lead magnet is missing', async () => {
    mockLeadMagnet(null)

    const response = await GET(makeRequest(MAGNET_ID), params(MAGNET_ID))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Lead magnet not found' })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('returns 500 when the stored file path is missing', async () => {
    mockLeadMagnet({
      id: MAGNET_ID,
      title: 'Empty magnet',
      type: 'pdf',
      download_count: 0,
    })

    const response = await GET(makeRequest(MAGNET_ID), params(MAGNET_ID))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Lead magnet file path is missing',
    })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('returns external https URLs without creating a signed storage URL', async () => {
    const { downloadChain, magnetChain } = mockLeadMagnet({
      id: MAGNET_ID,
      title: 'External ebook',
      type: 'ebook',
      slug: 'external-ebook',
      file_url: 'https://cdn.example.com/guide.pdf',
      download_count: 2,
    })

    const response = await GET(
      makeRequest(MAGNET_ID, { ipHeaders: { 'x-forwarded-for': '203.0.113.45' } }),
      params(MAGNET_ID),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      downloadUrl: 'https://cdn.example.com/guide.pdf',
    })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
    expect(downloadChain.insert).toHaveBeenCalledWith([
      {
        user_id: USER.id,
        lead_magnet_id: MAGNET_ID,
        ip_address: '203.0.113.0',
      },
    ])
    expect(magnetChain.update).toHaveBeenCalledWith({ download_count: 3 })
    expect(mocks.triggerEbookNurtureSequence).toHaveBeenCalledWith({
      user_id: USER.id,
      user_email: USER.email,
      user_name: 'Reader One',
      lead_magnet_id: MAGNET_ID,
      lead_magnet_title: 'External ebook',
      lead_magnet_slug: 'external-ebook',
      download_id: 'dl-1',
      download_timestamp: expect.any(String),
    })
  })

  it('creates a signed URL for in-bucket paths and skips nurture for non-document types', async () => {
    mockLeadMagnet({
      id: MAGNET_ID,
      title: 'Audit tool',
      type: 'interactive',
      file_path: 'private/audit.pdf',
      download_count: 0,
    })

    const response = await GET(
      makeRequest(MAGNET_ID, { ipHeaders: { 'x-real-ip': '198.51.100.9' } }),
      params(`  ${MAGNET_ID}  `),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      downloadUrl: 'https://signed.example/file.pdf',
    })
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('private/audit.pdf', 3600)
    expect(mocks.triggerEbookNurtureSequence).not.toHaveBeenCalled()
  })

  it('anonymizes IPv4 addresses and leaves non-IPv4 values unchanged', async () => {
    const { downloadChain } = mockLeadMagnet({
      id: MAGNET_ID,
      title: 'PDF pack',
      type: 'pdf',
      file_path: 'pack.pdf',
    })

    const response = await GET(
      makeRequest(MAGNET_ID, { ipHeaders: { 'x-forwarded-for': '2001:db8::1' } }),
      params(MAGNET_ID),
    )

    expect(response.status).toBe(200)
    expect(downloadChain.insert).toHaveBeenCalledWith([
      {
        user_id: USER.id,
        lead_magnet_id: MAGNET_ID,
        ip_address: '2001:db8::1',
      },
    ])
  })

  it('returns 404 when signed URL creation fails', async () => {
    mockLeadMagnet({
      id: MAGNET_ID,
      title: 'Missing file',
      type: 'document',
      file_path: 'gone.pdf',
    })
    mocks.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Object not found' },
    })

    const response = await GET(makeRequest(MAGNET_ID), params(MAGNET_ID))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'File not found or unavailable for download',
    })
    expect(mocks.triggerEbookNurtureSequence).not.toHaveBeenCalled()
  })
})
