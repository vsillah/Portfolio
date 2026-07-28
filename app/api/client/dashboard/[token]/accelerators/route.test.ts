import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  validateDashboardToken: vi.fn(),
  getRecommendationsForDashboard: vi.fn(),
}))

vi.mock('@/lib/client-dashboard', () => ({
  validateDashboardToken: mocks.validateDashboardToken,
}))

vi.mock('@/lib/acceleration-engine', () => ({
  getRecommendationsForDashboard: mocks.getRecommendationsForDashboard,
}))

import { GET } from './route'

const VALID_TOKEN = 'client-dashboard-token-abcdefghij'
const SHORT_TOKEN = 'too-short-token'

function request(token: string) {
  return new NextRequest(`http://localhost/api/client/dashboard/${token}/accelerators`)
}

describe('GET /api/client/dashboard/[token]/accelerators', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects short dashboard tokens before loading recommendations', async () => {
    const response = await GET(request(SHORT_TOKEN), {
      params: Promise.resolve({ token: SHORT_TOKEN }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid dashboard link' })
    expect(mocks.validateDashboardToken).not.toHaveBeenCalled()
    expect(mocks.getRecommendationsForDashboard).not.toHaveBeenCalled()
  })

  it('rejects expired or project-less tokens before loading recommendations', async () => {
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: null,
      error: 'Invalid or expired dashboard link',
    })

    const response = await GET(request(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid or expired dashboard link',
    })
    expect(mocks.getRecommendationsForDashboard).not.toHaveBeenCalled()
  })

  it('returns active recommendations for the token-linked project', async () => {
    const recommendations = [
      {
        id: 'rec-1',
        client_project_id: 'project-1',
        service_title: 'Community Impact Accelerator',
      },
    ]
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: 'project-1',
      error: null,
    })
    mocks.getRecommendationsForDashboard.mockResolvedValue(recommendations)

    const response = await GET(request(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ recommendations })
    expect(mocks.validateDashboardToken).toHaveBeenCalledWith(VALID_TOKEN)
    expect(mocks.getRecommendationsForDashboard).toHaveBeenCalledWith('project-1')
  })
})
