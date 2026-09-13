import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET, POST } from './route'

function getRequest(query = '') {
  return new NextRequest(`http://localhost/api/publications${query}`)
}

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/publications', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function thenable<T extends Record<string, unknown>>(
  value: T,
  extra: Record<string, unknown> = {},
) {
  return {
    ...extra,
    then(onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(value).then(onFulfilled, onRejected)
    },
  }
}

const publication = {
  id: 7,
  title: 'Banned Books',
  is_published: true,
  file_path: 'pubs/banned.pdf',
  lead_magnet_id: 'lm-ebook',
  audiobook_lead_magnet_id: 'lm-audio',
  audio_file_path: 'audio/preview.mp3',
  audio_preview_url: 'https://cdn.example/preview.mp3',
}

describe('GET /api/publications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('defaults to published-only rows', async () => {
    const publishedEq = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    })
    const secondOrder = vi.fn().mockReturnValue(thenable({ data: [], error: null }, { eq: publishedEq }))
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ order: secondOrder }),
      }),
    })

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    expect(publishedEq).toHaveBeenCalledWith('is_published', true)
    expect(await response.json()).toEqual([])
  })

  it('does not restrict is_published when published=false', async () => {
    const publishedEq = vi.fn()
    const result = {
      data: [{ ...publication, is_published: false }],
      error: null,
    }
    const secondOrder = vi.fn().mockReturnValue(thenable(result, { eq: publishedEq }))
    mocks.from.mockImplementation((table: string) => {
      if (table === 'publications') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ order: secondOrder }),
          }),
        }
      }
      if (table === 'products') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }
      if (table === 'lead_magnets') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(getRequest('?published=false'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(publishedEq).not.toHaveBeenCalled()
    expect(body[0].is_published).toBe(false)
    expect(body[0].file_path).toBe('pubs/banned.pdf')
  })

  it('returns an empty array when the publications table is missing', async () => {
    const publishedEq = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'does not exist' },
    })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(thenable({ data: null, error: { code: '42P01' } }, { eq: publishedEq })),
        }),
      }),
    })

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('attaches linked product, magnets, and the audio proxy URL', async () => {
    const publishedEq = vi.fn().mockResolvedValue({
      data: [publication],
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'publications') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue(
                thenable({ data: [publication], error: null }, { eq: publishedEq }),
              ),
            }),
          }),
        }
      }
      if (table === 'products') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 99, price: 2500, publication_id: 7 }],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'lead_magnets') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockImplementation((column: string, ids: string[]) => ({
              eq: vi.fn().mockResolvedValue({
                data: ids.includes('lm-ebook')
                  ? [{ id: 'lm-ebook', slug: 'banned-ebook', title: 'Ebook' }]
                  : [{ id: 'lm-audio', slug: 'banned-audio', title: 'Audiobook' }],
                error: null,
              }),
            })),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(getRequest())
    const [row] = await response.json()

    expect(response.status).toBe(200)
    expect(row.linked_product).toEqual({ id: 99, price: 2500 })
    expect(row.linked_lead_magnet).toEqual({
      id: 'lm-ebook',
      slug: 'banned-ebook',
      title: 'Ebook',
    })
    expect(row.linked_audiobook_lead_magnet).toEqual({
      id: 'lm-audio',
      slug: 'banned-audio',
      title: 'Audiobook',
    })
    expect(row.audio_preview_playable_url).toBe('/api/publications/7/audio')
  })
})

describe('POST /api/publications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before inserting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(postRequest({ title: 'New Book' }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing title before inserting', async () => {
    const response = await POST(postRequest({ description: 'No title' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Title is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults display_order to 0 and is_published to true', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 8, title: 'New Book' },
          error: null,
        }),
      }),
    })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(postRequest({ title: 'New Book' }))

    expect(response.status).toBe(201)
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'New Book',
        display_order: 0,
        is_published: true,
        created_by: 'admin-1',
      }),
    ])
  })
})
