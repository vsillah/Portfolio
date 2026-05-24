import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getRoadmapBundleForProject: vi.fn(),
  ensureRoadmapForProject: vi.fn(),
  projectRoadmapTasks: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/client-ai-ops-roadmap-db', () => ({
  getRoadmapBundleForProject: mocks.getRoadmapBundleForProject,
  ensureRoadmapForProject: mocks.ensureRoadmapForProject,
  projectRoadmapTasks: mocks.projectRoadmapTasks,
}))

import { GET } from './route'

function request() {
  return new Request('http://localhost/api/admin/client-projects/project-1/ai-ops', {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/client-projects/[id]/ai-ops', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getRoadmapBundleForProject.mockResolvedValue({
      clientView: {
        title: 'Acme AI Ops Roadmap',
        projectionStatus: {
          tasksTotal: 2,
          tasksComplete: 1,
          blockedTasks: 0,
          clientActionCount: 1,
          amadutownActionCount: 0,
          sharedActionCount: 0,
          approvalNeededCount: 1,
          isolationRequiredCount: 1,
          overdueTasks: 0,
          staleCostItems: 0,
          reportMissing: false,
          nextReportingAction: 'Review approval-gated roadmap work',
        },
      },
    })
  })

  it('returns the roadmap projection status in the admin AI Ops response', async () => {
    const response = await GET(request() as never, { params: Promise.resolve({ id: 'project-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.getRoadmapBundleForProject).toHaveBeenCalledWith('project-1')
    expect(body.roadmap.clientView.projectionStatus).toMatchObject({
      approvalNeededCount: 1,
      isolationRequiredCount: 1,
      nextReportingAction: 'Review approval-gated roadmap work',
    })
  })

  it('requires admin auth before reading the roadmap bundle', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never, { params: Promise.resolve({ id: 'project-1' }) })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getRoadmapBundleForProject).not.toHaveBeenCalled()
  })
})
