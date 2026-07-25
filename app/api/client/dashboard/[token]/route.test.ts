import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDashboardByToken: vi.fn(),
}))

vi.mock('@/lib/client-dashboard', () => ({
  getDashboardByToken: mocks.getDashboardByToken,
}))

import { GET } from './route'

const VALID_TOKEN = 'client-dashboard-token-abcdefghij'
const SHORT_TOKEN = 'too-short-token'

function request(token: string) {
  return new NextRequest(`http://localhost/api/client/dashboard/${token}`)
}

describe('GET /api/client/dashboard/[token]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects short dashboard tokens before loading dashboard data', async () => {
    const response = await GET(request(SHORT_TOKEN), {
      params: Promise.resolve({ token: SHORT_TOKEN }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid dashboard link' })
    expect(mocks.getDashboardByToken).not.toHaveBeenCalled()
  })

  it('returns 404 when the token cannot resolve a dashboard', async () => {
    mocks.getDashboardByToken.mockResolvedValue({
      data: null,
      stage: 'client',
      error: 'Invalid or expired dashboard link',
    })

    const response = await GET(request(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid or expired dashboard link',
    })
    expect(mocks.getDashboardByToken).toHaveBeenCalledWith(VALID_TOKEN)
  })

  it('returns the dashboard payload and stage for a valid token', async () => {
    const dashboard = {
      project: { id: 'project-1', project_name: 'KMB' },
      tasks: [],
    }
    mocks.getDashboardByToken.mockResolvedValue({
      data: dashboard,
      stage: 'client',
    })

    const response = await GET(request(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: dashboard,
      stage: 'client',
    })
    expect(mocks.getDashboardByToken).toHaveBeenCalledWith(VALID_TOKEN)
  })
})
