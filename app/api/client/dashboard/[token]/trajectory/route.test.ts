import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  validateDashboardToken: vi.fn(),
  projectTrajectory: vi.fn(),
}))

vi.mock('@/lib/client-dashboard', () => ({
  validateDashboardToken: mocks.validateDashboardToken,
}))

vi.mock('@/lib/assessment-scoring', () => ({
  projectTrajectory: mocks.projectTrajectory,
}))

import { GET } from './route'

const VALID_TOKEN = 'client-dashboard-token-abcdefghij'
const SHORT_TOKEN = 'too-short-token'

function request(token: string) {
  return new NextRequest(`http://localhost/api/client/dashboard/${token}/trajectory`)
}

describe('GET /api/client/dashboard/[token]/trajectory', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects short dashboard tokens before projecting trajectory', async () => {
    const response = await GET(request(SHORT_TOKEN), {
      params: Promise.resolve({ token: SHORT_TOKEN }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid dashboard link' })
    expect(mocks.validateDashboardToken).not.toHaveBeenCalled()
    expect(mocks.projectTrajectory).not.toHaveBeenCalled()
  })

  it('rejects expired or project-less tokens before projecting trajectory', async () => {
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
    expect(mocks.validateDashboardToken).toHaveBeenCalledWith(VALID_TOKEN)
    expect(mocks.projectTrajectory).not.toHaveBeenCalled()
  })

  it('projects trajectory for the project linked to the dashboard token', async () => {
    const trajectory = {
      snapshots: [{ date: '2026-07-20', overallScore: 61, isCurrent: true }],
      projected: [{ date: '2026-08-20', overallScore: 74 }],
    }
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: 'project-1',
      error: null,
    })
    mocks.projectTrajectory.mockResolvedValue(trajectory)

    const response = await GET(request(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ trajectory })
    expect(mocks.validateDashboardToken).toHaveBeenCalledWith(VALID_TOKEN)
    expect(mocks.projectTrajectory).toHaveBeenCalledWith('project-1')
  })
})
