import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  createVideo: vi.fn(),
  isOverVideoGenerationLimit: vi.fn(),
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

vi.mock('@/lib/heygen', () => ({
  createVideo: mocks.createVideo,
}))

vi.mock('@/lib/video-generation-rate-limit', () => ({
  isOverVideoGenerationLimit: mocks.isOverVideoGenerationLimit,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/video-generation/ideas-queue/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/video-generation/ideas-queue/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isOverVideoGenerationLimit.mockResolvedValue(false)
  })

  it('requires render approval before batch generation can touch HeyGen', async () => {
    const response = await POST(makeRequest({ items: [{ id: 'draft-1' }] }))

    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Render approval confirmation')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })
})
