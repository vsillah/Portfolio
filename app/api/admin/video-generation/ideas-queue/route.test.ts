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

import { GET } from './route'

const SCRIPT_SELECT =
  'id, title, script_text, storyboard_json, source, status, video_generation_job_id, custom_prompt, created_at, script_template_id, script_outline, script_scorecard, research_packet_ids'
const BASE_SELECT =
  'id, title, script_text, storyboard_json, source, status, video_generation_job_id, custom_prompt, created_at'

function makeRequest(status?: string) {
  const url = new URL('http://localhost/api/admin/video-generation/ideas-queue')
  if (status !== undefined) url.searchParams.set('status', status)
  return new NextRequest(url)
}

function mockList(result: { data: unknown; error: { code?: string; message?: string } | null }) {
  const order = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ eq }))
  return { select, eq, order }
}

describe('GET /api/admin/video-generation/ideas-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before querying the queue', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults to pending and returns script-intelligence columns', async () => {
    const query = mockList({
      data: [{ id: 'idea-1', status: 'pending', script_template_id: 'tpl-1' }],
      error: null,
    })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      items: [{ id: 'idea-1', status: 'pending', script_template_id: 'tpl-1' }],
    })
    expect(mocks.from).toHaveBeenCalledWith('video_ideas_queue')
    expect(query.select).toHaveBeenCalledWith(SCRIPT_SELECT)
    expect(query.eq).toHaveBeenCalledWith('status', 'pending')
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('passes status=all through as an equality filter', async () => {
    const query = mockList({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest('all'))

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('status', 'all')
  })

  it('fills script columns when the intelligence migration is missing', async () => {
    const primary = mockList({
      data: null,
      error: { code: '42703', message: 'column script_outline does not exist' },
    })
    const fallback = mockList({
      data: [{ id: 'idea-2', title: 'Receipt' }],
      error: null,
    })
    mocks.from.mockReturnValueOnce(primary).mockReturnValueOnce(fallback)

    const response = await GET(makeRequest('approved'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(primary.select).toHaveBeenCalledWith(SCRIPT_SELECT)
    expect(fallback.select).toHaveBeenCalledWith(BASE_SELECT)
    expect(fallback.eq).toHaveBeenCalledWith('status', 'approved')
    expect(body.items).toEqual([
      {
        id: 'idea-2',
        title: 'Receipt',
        script_template_id: null,
        script_outline: {},
        script_scorecard: {},
        research_packet_ids: [],
      },
    ])
  })

  it('does not fall back for an unrelated missing column', async () => {
    const primary = mockList({
      data: null,
      error: { code: '42703', message: 'column title does not exist' },
    })
    mocks.from.mockReturnValue(primary)

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to list ideas queue' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('returns the generic list error when the fallback query fails', async () => {
    mocks.from
      .mockReturnValueOnce(mockList({
        data: null,
        error: { code: '42703', message: 'column research_packet_ids does not exist' },
      }))
      .mockReturnValueOnce(mockList({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      }))

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to list ideas queue' })
  })

  it('coerces a null payload to an empty list', async () => {
    mocks.from.mockReturnValue(mockList({ data: null, error: null }))

    const response = await GET(makeRequest('dismissed'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: [] })
  })

  it('returns a thrown string as the error body', async () => {
    mocks.from.mockImplementation(() => {
      throw 'queue down'
    })

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'queue down' })
  })
})
