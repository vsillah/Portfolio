import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  validateDashboardToken: vi.fn(),
  dismissRecommendation: vi.fn(),
  convertRecommendation: vi.fn(),
}))

vi.mock('@/lib/client-dashboard', () => ({
  validateDashboardToken: mocks.validateDashboardToken,
}))

vi.mock('@/lib/acceleration-engine', () => ({
  dismissRecommendation: mocks.dismissRecommendation,
  convertRecommendation: mocks.convertRecommendation,
}))

import { PATCH } from './route'

const VALID_TOKEN = 'client-dashboard-token-abcdefghij'
const SHORT_TOKEN = 'too-short-token'

function request(token: string, recId: string, body?: unknown) {
  return new NextRequest(
    `http://localhost/api/client/dashboard/${token}/accelerators/${recId}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  )
}

describe('PATCH /api/client/dashboard/[token]/accelerators/[recId]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects short dashboard tokens before mutating recommendations', async () => {
    const response = await PATCH(request(SHORT_TOKEN, 'rec-1', { action: 'dismiss' }), {
      params: Promise.resolve({ token: SHORT_TOKEN, recId: 'rec-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid dashboard link' })
    expect(mocks.validateDashboardToken).not.toHaveBeenCalled()
    expect(mocks.dismissRecommendation).not.toHaveBeenCalled()
  })

  it('rejects expired or project-less tokens before dismiss/convert', async () => {
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: null,
      error: 'Invalid or expired dashboard link',
    })

    const response = await PATCH(request(VALID_TOKEN, 'rec-1', { action: 'dismiss' }), {
      params: Promise.resolve({ token: VALID_TOKEN, recId: 'rec-1' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid or expired dashboard link',
    })
    expect(mocks.validateDashboardToken).toHaveBeenCalledWith(VALID_TOKEN)
    expect(mocks.dismissRecommendation).not.toHaveBeenCalled()
    expect(mocks.convertRecommendation).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON bodies', async () => {
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: 'project-1',
      error: null,
    })
    const badRequest = new NextRequest(
      `http://localhost/api/client/dashboard/${VALID_TOKEN}/accelerators/rec-1`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{not-json',
      }
    )

    const response = await PATCH(badRequest, {
      params: Promise.resolve({ token: VALID_TOKEN, recId: 'rec-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request body' })
    expect(mocks.dismissRecommendation).not.toHaveBeenCalled()
  })

  it('rejects actions outside dismiss/convert', async () => {
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: 'project-1',
      error: null,
    })

    const response = await PATCH(request(VALID_TOKEN, 'rec-1', { action: 'archive' }), {
      params: Promise.resolve({ token: VALID_TOKEN, recId: 'rec-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid action. Must be dismiss or convert',
    })
    expect(mocks.dismissRecommendation).not.toHaveBeenCalled()
    expect(mocks.convertRecommendation).not.toHaveBeenCalled()
  })

  it('dismisses a recommendation scoped to the token project', async () => {
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: 'project-1',
      error: null,
    })
    mocks.dismissRecommendation.mockResolvedValue({ success: true })

    const response = await PATCH(request(VALID_TOKEN, 'rec-9', { action: 'dismiss' }), {
      params: Promise.resolve({ token: VALID_TOKEN, recId: 'rec-9' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.dismissRecommendation).toHaveBeenCalledWith('rec-9', 'project-1')
    expect(mocks.convertRecommendation).not.toHaveBeenCalled()
  })

  it('converts a recommendation and returns the project-scoped CTA URL', async () => {
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: 'project-1',
      error: null,
    })
    mocks.convertRecommendation.mockResolvedValue({
      success: true,
      ctaUrl: '/pricing#community-impact-accelerator',
    })

    const response = await PATCH(request(VALID_TOKEN, 'rec-9', { action: 'convert' }), {
      params: Promise.resolve({ token: VALID_TOKEN, recId: 'rec-9' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      ctaUrl: '/pricing#community-impact-accelerator',
    })
    expect(mocks.convertRecommendation).toHaveBeenCalledWith('rec-9', 'project-1')
    expect(mocks.dismissRecommendation).not.toHaveBeenCalled()
  })
})
