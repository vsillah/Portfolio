import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  listPendingVercelResearchApprovals: vi.fn(),
  createVercelResearchApproval: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/vercel-deployment-research-approvals', () => ({
  listPendingVercelResearchApprovals: mocks.listPendingVercelResearchApprovals,
  createVercelResearchApproval: mocks.createVercelResearchApproval,
}))

import { GET, POST } from './route'

function request(body?: unknown) {
  return new Request('http://localhost/api/admin/agents/vercel-research/proposals', {
    method: body ? 'POST' : 'GET',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const proposal = {
  id: 'next-build-profile',
  title: 'Profile build',
  hypothesis: 'Find build bottlenecks.',
  expectedImpact: 'Lower deployment research time.',
  scorecardBaseline: {
    project: 'portfolio',
    target: 'preview',
    queueSeconds: 10,
    buildSeconds: 300,
    totalSeconds: 310,
  },
  touchedFiles: ['package.json'],
  touchedSettings: [],
  riskLevel: 'low',
  approvalState: 'not_required',
  approvalQuestion: 'Approve the build-profile experiment?',
  rollbackPath: 'Discard the branch.',
  evidence: ['build=5m00s'],
}

describe('/api/admin/agents/vercel-research/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.listPendingVercelResearchApprovals.mockResolvedValue([{ approvalId: 'approval-1' }])
    mocks.createVercelResearchApproval.mockResolvedValue({
      workItem: { id: 'work-1' },
      approvalId: 'approval-1',
      runId: 'run-1',
      notification: { sent: true },
    })
  })

  it('lists pending AutoResearch approvals', async () => {
    const response = await GET(request() as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, approvals: [{ approvalId: 'approval-1' }] })
  })

  it('creates a proposal approval packet for the current admin', async () => {
    const response = await POST(request({ proposal }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, approvalId: 'approval-1' })
    expect(mocks.createVercelResearchApproval).toHaveBeenCalledWith({
      proposal,
      createdByUserId: 'admin-user',
    })
  })

  it('rejects malformed proposal packets', async () => {
    const response = await POST(request({ proposal: { id: 'missing-title' } }) as never)

    expect(response.status).toBe(400)
    expect(mocks.createVercelResearchApproval).not.toHaveBeenCalled()
  })
})
