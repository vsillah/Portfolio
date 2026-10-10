import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  const defaultRoutes = [{ route: '/', filename: 'screenshot-home' }]
  return {
    defaultRoutes,
    verifyAdmin: vi.fn(),
    isAuthError: vi.fn(),
    from: vi.fn(),
    single: vi.fn(),
    captureBroll: vi.fn(),
    selectRoutesFromScript: vi.fn(),
  }
})

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/playtest-broll', () => ({
  DEFAULT_ROUTES: mocks.defaultRoutes,
  captureBroll: mocks.captureBroll,
  selectRoutesFromScript: mocks.selectRoutesFromScript,
}))

import { POST } from './route'

const params = { params: { id: 'queue-1' } }

function request(body?: string) {
  return new NextRequest('http://localhost/api/admin/video-generation/queue/queue-1/generate-broll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

describe('POST /api/admin/video-generation/queue/[id]/generate-broll', () => {
  const previousBaseUrl = process.env.BASE_URL

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.BASE_URL
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.single.mockResolvedValue({
      data: {
        id: 'queue-1',
        drive_file_name: 'Episode 1 script.txt',
        script_text: '  Visit the store.  ',
      },
      error: null,
    })
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({ single: mocks.single }),
      }),
    })
    mocks.selectRoutesFromScript.mockReturnValue([{ route: '/store', filename: 'screenshot-store' }])
    mocks.captureBroll.mockResolvedValue({
      outputDir: '/tmp/broll',
      screenshots: ['a.png', 'b.png'],
      clips: ['a.webm'],
    })
  })

  afterEach(() => {
    if (previousBaseUrl === undefined) delete process.env.BASE_URL
    else process.env.BASE_URL = previousBaseUrl
  })

  it('rejects non-admins before looking up the queue item', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request('{}'), params)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.captureBroll).not.toHaveBeenCalled()
  })

  it('returns 404 and does not capture when the queue item is missing', async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: 'missing' } })

    const response = await POST(request('{}'), params)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Queue item not found' })
    expect(mocks.captureBroll).not.toHaveBeenCalled()
  })

  it('uses every default route when the body is omitted or not script-scoped', async () => {
    const response = await POST(request('not-json'), params)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      outputDir: '/tmp/broll',
      screenshots: 2,
      clips: 1,
    })
    expect(mocks.selectRoutesFromScript).not.toHaveBeenCalled()
    expect(mocks.captureBroll).toHaveBeenCalledWith({
      routes: mocks.defaultRoutes,
      outputDir: expect.stringMatching(/design-files\/broll\/episode-1-script\/B-roll$/),
      recordVideos: true,
      baseUrl: 'http://localhost:3000',
      noStartServer: true,
    })
  })

  it('passes the trimmed script to script-scoped route selection and honors BASE_URL', async () => {
    process.env.BASE_URL = 'https://preview.example'
    mocks.single.mockResolvedValue({
      data: { id: 'queue-1', drive_file_name: null, script_text: null },
      error: null,
    })

    const response = await POST(request(JSON.stringify({ brollRoutes: 'script' })), params)

    expect(response.status).toBe(200)
    expect(mocks.selectRoutesFromScript).toHaveBeenCalledWith('', mocks.defaultRoutes)
    expect(mocks.captureBroll).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: [{ route: '/store', filename: 'screenshot-store' }],
        baseUrl: 'https://preview.example',
        outputDir: expect.stringMatching(/design-files\/broll\/video-queue-1\/B-roll$/),
      })
    )
  })

  it('returns the thrown message for Error and string failures', async () => {
    mocks.captureBroll.mockRejectedValueOnce(new Error('browser missing'))
    const errorResponse = await POST(request('{}'), params)
    expect(errorResponse.status).toBe(500)
    expect(await errorResponse.json()).toEqual({ error: 'browser missing' })

    mocks.captureBroll.mockRejectedValueOnce('capture crashed')
    const stringResponse = await POST(request('{}'), params)
    expect(stringResponse.status).toBe(500)
    expect(await stringResponse.json()).toEqual({ error: 'capture crashed' })
  })
})
