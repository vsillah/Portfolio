import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  captureBroll: vi.fn(),
  DEFAULT_ROUTES: [
    { route: '/', filename: 'screenshot-home', description: 'Home / hero' },
    { route: '/store', filename: 'screenshot-store', description: 'Store' },
  ],
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

vi.mock('@/lib/playtest-broll', () => ({
  DEFAULT_ROUTES: mocks.DEFAULT_ROUTES,
  captureBroll: mocks.captureBroll,
}))

import { POST } from './route'

const NOW = '2026-09-27T10:00:00.000Z'
const SEVEN_DAY_CUTOFF = '2026-09-20T10:00:00.000Z'

function makeRequest(body: unknown, headers?: Record<string, string>) {
  return new NextRequest('http://localhost/api/admin/video-generation/broll-library/capture', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/video-generation/broll-library/capture', () => {
  const originalBaseUrl = process.env.BASE_URL

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    delete process.env.BASE_URL
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.captureBroll.mockResolvedValue({
      screenshots: ['/tmp/screenshot-home.png', '/tmp/screenshot-store.png'],
      clips: ['/tmp/screenshot-store.webm'],
    })
    mocks.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalBaseUrl === undefined) delete process.env.BASE_URL
    else process.env.BASE_URL = originalBaseUrl
  })

  it('requires admin auth before parsing the body or capturing', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ routes: ['/store'] }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.captureBroll).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an explicit route list that matches nothing', async () => {
    const response = await POST(makeRequest({ routes: ['/missing'] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No matching routes found' })
    expect(mocks.captureBroll).not.toHaveBeenCalled()
  })

  it('treats invalid JSON and an empty route list as every default route', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ upsert })

    const invalidJson = await POST(makeRequest('not-json'))
    const emptyList = await POST(makeRequest({ routes: [] }))

    expect(invalidJson.status).toBe(200)
    expect(emptyList.status).toBe(200)
    expect((await invalidJson.json()).captured).toBe(2)
    expect((await emptyList.json()).captured).toBe(2)
    expect(mocks.captureBroll).toHaveBeenNthCalledWith(1, {
      routes: mocks.DEFAULT_ROUTES,
      outputDir: path.join(process.cwd(), 'design-files', 'broll', 'library'),
      recordVideos: true,
      baseUrl: 'http://localhost:3000',
      noStartServer: true,
    })
    expect(mocks.captureBroll).toHaveBeenNthCalledWith(2, expect.objectContaining({
      routes: mocks.DEFAULT_ROUTES,
      recordVideos: true,
    }))
    expect(upsert).toHaveBeenCalledTimes(4)
  })

  it('captures only the requested routes and turns recordVideos off only for explicit false', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ upsert })
    process.env.BASE_URL = 'https://preview.example'

    const response = await POST(makeRequest({
      routes: ['/store', '/missing'],
      recordVideos: false,
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      captured: 1,
      routes: ['/store'],
      screenshots: 2,
      clips: 1,
    })
    expect(mocks.captureBroll).toHaveBeenCalledWith(expect.objectContaining({
      routes: [mocks.DEFAULT_ROUTES[1]],
      recordVideos: false,
      baseUrl: 'https://preview.example',
      noStartServer: true,
    }))
    expect(upsert).toHaveBeenCalledWith(
      {
        route: '/store',
        route_description: 'Store',
        filename: 'screenshot-store',
        screenshot_path: '/tmp/screenshot-store.png',
        clip_path: '/tmp/screenshot-store.webm',
        captured_at: NOW,
      },
      { onConflict: 'route,filename' }
    )
  })

  it('keeps recording when recordVideos is the string false and omits a failed upsert', async () => {
    const upsert = vi.fn()
      .mockResolvedValueOnce({ error: { message: 'conflict' } })
      .mockResolvedValueOnce({ error: null })
    mocks.from.mockReturnValue({ upsert })

    const response = await POST(makeRequest({ recordVideos: 'false' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.captured).toBe(1)
    expect(body.routes).toEqual(['/store'])
    expect(mocks.captureBroll).toHaveBeenCalledWith(expect.objectContaining({ recordVideos: true }))
    expect(upsert.mock.calls[0][0].screenshot_path).toBe('/tmp/screenshot-home.png')
    expect(upsert.mock.calls[0][0].clip_path).toBeNull()
  })

  it('skips fresh routes and recaptures a route captured exactly at the stale cutoff', async () => {
    const select = vi.fn().mockResolvedValue({
      data: [
        { route: '/', captured_at: '2026-09-20T10:00:00.001Z' },
        { route: '/store', captured_at: SEVEN_DAY_CUTOFF },
      ],
      error: null,
    })
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ select, upsert })

    const response = await POST(makeRequest({ onlyMissing: true }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.routes).toEqual(['/store'])
    expect(mocks.captureBroll).toHaveBeenCalledWith(expect.objectContaining({
      routes: [mocks.DEFAULT_ROUTES[1]],
    }))
    expect(select).toHaveBeenCalledWith('route, captured_at')
  })

  it('uses a numeric stale window and reports that every route is fresh without capturing', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { route: '/', captured_at: '2026-09-26T10:00:00.001Z' },
          { route: '/store', captured_at: '2026-09-26T12:00:00.000Z' },
        ],
        error: null,
      }),
    })

    const response = await POST(makeRequest({ onlyMissing: true, staleThresholdDays: 1 }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      captured: 0,
      message: 'All routes are fresh',
    })
    expect(mocks.captureBroll).not.toHaveBeenCalled()
  })

  it('ignores a non-numeric stale window and streams the fresh result', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { route: '/', captured_at: '2026-09-21T10:00:00.000Z' },
          { route: '/store', captured_at: '2026-09-21T10:00:00.000Z' },
        ],
        error: null,
      }),
    })

    const response = await POST(
      makeRequest(
        { onlyMissing: true, staleThresholdDays: '1' },
        { accept: 'text/event-stream' }
      )
    )
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(text).toContain('"step":"done"')
    expect(text).toContain('All routes are fresh')
    expect(mocks.captureBroll).not.toHaveBeenCalled()
  })

  it('returns the capture error on the JSON path', async () => {
    mocks.captureBroll.mockRejectedValue(new Error('playwright failed'))

    const response = await POST(makeRequest({}))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'playwright failed' })
  })

  it('streams a capture failure as an error event instead of an HTTP 500', async () => {
    mocks.captureBroll.mockRejectedValue('capture crashed')

    const response = await POST(makeRequest({}, { accept: 'text/event-stream' }))
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('"step":"error"')
    expect(text).toContain('capture crashed')
  })
})
