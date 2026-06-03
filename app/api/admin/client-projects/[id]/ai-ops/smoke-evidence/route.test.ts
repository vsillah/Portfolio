import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  buildClientAiOpsRealPilotQaPlan: vi.fn(),
  buildClientAiOpsSmokeEvidencePacket: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/client-ai-ops-real-pilot-qa', () => ({
  buildClientAiOpsRealPilotQaPlan: mocks.buildClientAiOpsRealPilotQaPlan,
  buildClientAiOpsSmokeEvidencePacket: mocks.buildClientAiOpsSmokeEvidencePacket,
}))

import { GET } from './route'

function request() {
  return new Request('http://localhost/api/admin/client-projects/project-1/ai-ops/smoke-evidence', {
    method: 'GET',
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/client-projects/[id]/ai-ops/smoke-evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.buildClientAiOpsRealPilotQaPlan.mockReturnValue({
      generatedAt: '2026-06-02T12:00:00.000Z',
      fixture: 'synthetic_client_ai_ops_pilot',
      projectId: 'synthetic-client-ai-ops-project',
    })
    mocks.buildClientAiOpsSmokeEvidencePacket.mockReturnValue({
      generatedAt: '2026-06-02T12:00:00.000Z',
      fixture: 'synthetic_client_ai_ops_pilot',
      projectId: 'synthetic-client-ai-ops-project',
      summary: {
        totalTargets: 3,
        pendingCapture: 3,
        readyForReview: 0,
        needsRedaction: 0,
        blocked: 0,
      },
      items: [
        {
          surface: 'Admin project detail',
          status: 'pending_capture',
          clientSafe: false,
          sideEffectFree: true,
        },
      ],
      forbiddenActions: ['credential sync', 'provider write', 'outbound send'],
    })
  })

  it('returns a read-only smoke evidence template for admin review', async () => {
    const response = await GET(request() as never, { params: Promise.resolve({ id: 'project-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.buildClientAiOpsRealPilotQaPlan).toHaveBeenCalled()
    expect(mocks.buildClientAiOpsSmokeEvidencePacket).toHaveBeenCalledWith({
      generatedAt: '2026-06-02T12:00:00.000Z',
      fixture: 'synthetic_client_ai_ops_pilot',
      projectId: 'synthetic-client-ai-ops-project',
    })
    expect(body).toMatchObject({
      clientProjectId: 'project-1',
      source: 'synthetic_smoke_evidence_template',
      sideEffectsEnabled: false,
      capturesAccepted: false,
      approvalBoundary: {
        liveSetupActions: 'agent_approvals_required',
        evidencePersistence: 'not_enabled_in_v1',
        clientDataMutation: 'agent_approvals_required',
      },
      smokeEvidence: {
        summary: {
          pendingCapture: 3,
          blocked: 0,
        },
        forbiddenActions: ['credential sync', 'provider write', 'outbound send'],
      },
    })
  })

  it('requires admin auth before building the evidence packet', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never, { params: Promise.resolve({ id: 'project-1' }) })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.buildClientAiOpsRealPilotQaPlan).not.toHaveBeenCalled()
    expect(mocks.buildClientAiOpsSmokeEvidencePacket).not.toHaveBeenCalled()
  })
})
