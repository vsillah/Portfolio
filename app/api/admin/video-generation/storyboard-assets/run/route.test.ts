import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import path from 'path'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  captureBroll: vi.fn(),
  generateStoryboardSchematics: vi.fn(),
  DEFAULT_ROUTES: [
    { route: '/about', filename: 'about' },
    { route: '/services', filename: 'services' },
  ],
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/playtest-broll', () => ({
  captureBroll: mocks.captureBroll,
  DEFAULT_ROUTES: mocks.DEFAULT_ROUTES,
}))

vi.mock('@/scripts/generate-storyboard-schematics', () => ({
  generateStoryboardSchematics: mocks.generateStoryboardSchematics,
}))

import { POST } from './route'

const OUTPUT_DIR = path.join(process.cwd(), 'design-files', 'about-page-video')

function makeRequest(body?: string) {
  return new NextRequest('http://localhost/api/admin/video-generation/storyboard-assets/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

describe('POST /api/admin/video-generation/storyboard-assets/run', () => {
  const originalBaseUrl = process.env.BASE_URL

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.generateStoryboardSchematics.mockReturnValue(['a.svg', 'b.svg'])
    mocks.captureBroll.mockResolvedValue({
      outputDir: OUTPUT_DIR,
      screenshots: ['about.png'],
      clips: ['about.webm', 'services.webm'],
    })
    delete process.env.BASE_URL
  })

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.BASE_URL
    else process.env.BASE_URL = originalBaseUrl
  })

  it('requires admin auth before generating schematics', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(JSON.stringify({ recordVideos: false })))

    expect(response.status).toBe(403)
    expect(mocks.generateStoryboardSchematics).not.toHaveBeenCalled()
    expect(mocks.captureBroll).not.toHaveBeenCalled()
  })

  it('records videos and uses localhost when the body and BASE_URL are omitted', async () => {
    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.generateStoryboardSchematics).toHaveBeenCalledWith(OUTPUT_DIR)
    expect(mocks.captureBroll).toHaveBeenCalledWith({
      routes: mocks.DEFAULT_ROUTES,
      outputDir: OUTPUT_DIR,
      recordVideos: true,
      baseUrl: 'http://localhost:3000',
      noStartServer: true,
    })
    expect(body).toEqual({
      outputDir: OUTPUT_DIR,
      schematicsCount: 2,
      screenshotsCount: 1,
      clipsCount: 2,
    })
  })

  it('treats only boolean false as a request to skip video recording', async () => {
    process.env.BASE_URL = 'https://preview.example'

    await POST(makeRequest(JSON.stringify({ recordVideos: 'false' })))
    expect(mocks.captureBroll).toHaveBeenLastCalledWith(expect.objectContaining({
      recordVideos: true,
      baseUrl: 'https://preview.example',
    }))

    await POST(makeRequest(JSON.stringify({ recordVideos: false })))
    expect(mocks.captureBroll).toHaveBeenLastCalledWith(expect.objectContaining({
      recordVideos: false,
    }))
  })

  it('uses an empty body when JSON is invalid', async () => {
    const response = await POST(makeRequest('not-json'))

    expect(response.status).toBe(200)
    expect(mocks.captureBroll).toHaveBeenCalledWith(expect.objectContaining({
      recordVideos: true,
    }))
  })

  it('returns a thrown capture error message', async () => {
    mocks.captureBroll.mockRejectedValue(new Error('playwright missing'))

    const response = await POST(makeRequest(JSON.stringify({})))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'playwright missing' })
  })

  it('returns a thrown string as the error body', async () => {
    mocks.generateStoryboardSchematics.mockImplementation(() => {
      throw 'schematic failed'
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'schematic failed' })
    expect(mocks.captureBroll).not.toHaveBeenCalled()
  })
})
