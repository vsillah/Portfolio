import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  listCodexAutomationInventory: vi.fn(),
  getCodexWorkspaceRootReport: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/codex-automation-inventory', () => ({
  listCodexAutomationInventory: mocks.listCodexAutomationInventory,
}))

vi.mock('@/lib/codex-workspace-roots', () => ({
  getCodexWorkspaceRootReport: mocks.getCodexWorkspaceRootReport,
}))

import { GET } from './route'

function makeRequest() {
  return new Request('http://localhost/api/admin/agents/automations', {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/agents/automations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.listCodexAutomationInventory.mockResolvedValue({
      available: true,
      sourceDirectory: '/Users/vambahsillah/.codex/automations',
      generatedAt: '2026-05-03T00:00:00.000Z',
      automations: [
        {
          id: 'portfolio-operations-manager',
          name: 'Portfolio Operations Manager',
          promptExcerpt: 'Run a safe report.',
        },
      ],
      hiddenCount: 1,
      overview: {
        total: 1,
        active: 1,
        paused: 0,
        duplicateCandidates: 0,
        highRisk: 0,
        missingContext: 0,
      },
      progress: {
        label: 'Memory and automation context readiness',
        percent: 100,
        completedTasks: 7,
        totalTasks: 7,
        tasks: [],
      },
      repairPackets: [],
    })
    mocks.getCodexWorkspaceRootReport.mockResolvedValue({
      available: true,
      generatedAt: '2026-05-03T00:00:00.000Z',
      expectedRoot: '/Users/vambahsillah/Projects/Portfolio',
      stateDatabase: '/Users/vambahsillah/.codex/state_5.sqlite',
      globalStateFile: '/Users/vambahsillah/.codex/.codex-global-state.json',
      savedWorkspaceRoots: ['/Users/vambahsillah/Projects/Portfolio'],
      activeWorkspaceRoots: ['/Users/vambahsillah/Projects/Portfolio'],
      projectOrderRoots: ['/Users/vambahsillah/Projects/Portfolio'],
      threadRoots: [],
      overview: {
        activeThreads: 0,
        portfolioThreads: 0,
        nonPortfolioThreads: 0,
        savedRootDrift: 0,
        activeRootDrift: 0,
        projectOrderDrift: 0,
      },
      health: 'green',
      warnings: [],
      operationalBoundary: 'Read-only workspace visibility.',
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.listCodexAutomationInventory).not.toHaveBeenCalled()
    expect(mocks.getCodexWorkspaceRootReport).not.toHaveBeenCalled()
  })

  it('returns the sanitized local automation inventory', async () => {
    const response = await GET(makeRequest() as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      available: true,
      automations: [
        expect.objectContaining({
          id: 'portfolio-operations-manager',
          promptExcerpt: 'Run a safe report.',
        }),
      ],
      hiddenCount: 1,
      workspaceRoots: expect.objectContaining({
        expectedRoot: '/Users/vambahsillah/Projects/Portfolio',
        health: 'green',
      }),
    }))
  })
})
