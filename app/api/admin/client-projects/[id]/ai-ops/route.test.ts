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

import { GET, POST } from './route'

function request(method = 'GET', body?: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/client-projects/project-1/ai-ops', {
    method,
    headers: { authorization: 'Bearer token' },
    body: body ? JSON.stringify(body) : undefined,
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
        connectorReadiness: {
          summary: '5 required, 0 ready, 4 need auth, 0 approval-blocked',
          requiredConnectorCount: 5,
          readyConnectorCount: 0,
          approvalBlockedConnectorCount: 0,
          missingCriticalConnectorCount: 0,
          connectorNextAction: 'Prepare oauth setup packet for HubSpot; do not connect until approved.',
          conflicts: [],
          items: [
            {
              key: 'hubspot',
              label: 'HubSpot',
              category: 'crm',
              status: 'needs_auth',
              source: 'audit',
              authMethod: 'oauth',
              setupOwner: 'shared',
              requiredScopes: [],
              approvalActions: [],
              healthChecks: [],
              fallbackPath: 'Use CSV exports until OAuth approval.',
              critical: true,
              evidence: 'Audit CRM: hubspot',
              nextAction: 'Prepare oauth setup packet for HubSpot; do not connect until approved.',
            },
          ],
        },
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
    expect(body.roadmap.clientView.connectorReadiness).toMatchObject({
      requiredConnectorCount: 5,
      connectorNextAction: 'Prepare oauth setup packet for HubSpot; do not connect until approved.',
    })
    expect(body.readiness).toMatchObject({
      status: 'waiting_approval',
      sideEffectsEnabled: false,
      connector: {
        required: 5,
      },
      projection: {
        approvals: 1,
        isolationChecks: 1,
      },
      approvalBoundaries: {
        credentialSync: 'waiting_approval',
        outboundSend: 'waiting_approval',
        productionDeploy: 'waiting_approval',
      },
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

  it('returns a readiness contract after creating and projecting roadmap tasks', async () => {
    const roadmap = {
      clientView: {
        title: 'Acme AI Ops Roadmap',
        connectorReadiness: {
          summary: '1 required, 0 ready, 1 need auth, 0 approval-blocked',
          requiredConnectorCount: 1,
          readyConnectorCount: 0,
          approvalBlockedConnectorCount: 0,
          missingCriticalConnectorCount: 0,
          connectorNextAction: 'Prepare oauth setup packet for HubSpot; do not connect until approved.',
          conflicts: [],
          items: [],
        },
        projectionStatus: {
          tasksTotal: 1,
          tasksComplete: 0,
          blockedTasks: 0,
          clientActionCount: 0,
          amadutownActionCount: 1,
          sharedActionCount: 0,
          approvalNeededCount: 0,
          isolationRequiredCount: 0,
          overdueTasks: 0,
          staleCostItems: 0,
          reportMissing: false,
          nextReportingAction: 'Continue scheduled roadmap monitoring',
        },
      },
    }
    mocks.ensureRoadmapForProject.mockResolvedValue(roadmap)
    mocks.projectRoadmapTasks.mockResolvedValue({ dashboardCreated: 1, meetingCreated: 1 })

    const response = await POST(request('POST', { project_tasks: true }) as never, { params: Promise.resolve({ id: 'project-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.ensureRoadmapForProject).toHaveBeenCalledWith('project-1', {
      generatedFrom: 'manual',
      userId: 'admin-user',
    })
    expect(mocks.projectRoadmapTasks).toHaveBeenCalledWith('project-1')
    expect(body.projection).toEqual({ dashboardCreated: 1, meetingCreated: 1 })
    expect(body.readiness).toMatchObject({
      status: 'ready_for_planning',
      sideEffectsEnabled: false,
      projection: {
        openActions: 1,
      },
    })
  })
})
