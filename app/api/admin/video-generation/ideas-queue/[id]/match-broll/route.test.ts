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

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/video-generation/ideas-queue/draft-1/match-broll')
}

function queueFetch(row: Record<string, unknown> | null, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error })
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ single })),
    })),
  }
}

describe('GET /api/admin/video-generation/ideas-queue/[id]/match-broll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before reading the draft', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest(), { params: { id: 'draft-1' } })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the draft is missing and does not query the library', async () => {
    mocks.from.mockReturnValueOnce(queueFetch(null, { code: 'PGRST116' }))

    const response = await GET(makeRequest(), { params: { id: 'missing' } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Draft not found' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('video_ideas_queue')
  })

  it('returns empty matches and skips the library when no scene has a b-roll hint', async () => {
    mocks.from.mockReturnValueOnce(queueFetch({
      id: 'draft-1',
      storyboard_json: { scenes: [{ description: 'Opening' }, { brollHint: '' }] },
    }))

    const response = await GET(makeRequest(), { params: { id: 'draft-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ matchedIds: [], hints: [] })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('matches the first asset by filename or description, case-insensitively, and dedupes ids', async () => {
    const librarySelect = vi.fn().mockResolvedValue({
      data: [
        { id: 'asset-home', filename: 'Screenshot-HOME.png', route_description: 'Hero' },
        { id: 'asset-store', filename: 'store.mp4', route_description: null },
        { id: 'asset-admin', filename: 'other.mp4', route_description: 'Admin Dashboard' },
      ],
      error: null,
    })
    mocks.from
      .mockReturnValueOnce(queueFetch({
        id: 'draft-1',
        storyboard_json: {
          scenes: [
            { brollHint: 'Home' },
            { brollHint: 'home' },
            { brollHint: 'ADMIN' },
            { brollHint: 'missing-hint' },
          ],
        },
      }))
      .mockReturnValueOnce({ select: librarySelect })

    const response = await GET(makeRequest(), { params: { id: 'draft-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      matchedIds: ['asset-home', 'asset-admin'],
      hints: ['Home', 'home', 'ADMIN', 'missing-hint'],
    })
    expect(librarySelect).toHaveBeenCalledWith('id, filename, route_description')
  })

  it('keeps the hints and returns no ids when the library query is empty', async () => {
    mocks.from
      .mockReturnValueOnce(queueFetch({
        id: 'draft-1',
        storyboard_json: null,
      }))

    const emptyStoryboard = await GET(makeRequest(), { params: { id: 'draft-1' } })
    expect(emptyStoryboard.status).toBe(200)
    await expect(emptyStoryboard.json()).resolves.toEqual({ matchedIds: [], hints: [] })

    mocks.from
      .mockReturnValueOnce(queueFetch({
        id: 'draft-1',
        storyboard_json: { scenes: [{ brollHint: 'store' }] },
      }))
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

    const response = await GET(makeRequest(), { params: { id: 'draft-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      matchedIds: [],
      hints: ['store'],
    })
  })

  it('returns a thrown string as the error body', async () => {
    mocks.from.mockImplementation(() => {
      throw 'library down'
    })

    const response = await GET(makeRequest(), { params: { id: 'draft-1' } })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'library down' })
  })
})
