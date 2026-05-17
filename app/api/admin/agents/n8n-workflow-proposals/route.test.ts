import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  createN8nWorkflowProposal: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-n8n-workflow-proposals', () => ({
  createN8nWorkflowProposal: mocks.createN8nWorkflowProposal,
  isN8nWorkflowProposalAction: (value: string) => [
    'inspect_workflow',
    'draft_workflow',
    'stage_workflow',
    'request_activation',
  ].includes(value),
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/n8n-workflow-proposals', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/n8n-workflow-proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createN8nWorkflowProposal.mockResolvedValue({ id: 'proposal-work-item' })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ action: 'draft_workflow', title: 'Draft', objective: 'Draft' }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('creates draft workflow proposals', async () => {
    const response = await POST(request({
      action: 'draft_workflow',
      title: 'Meeting follow-up workflow',
      objective: 'Draft the n8n workflow.',
      workflow_family: 'meeting_follow_up',
      automation_goal_seed_id: 'meeting-intake-follow-up-drafts',
      required_env_vars: ['N8N_INGEST_SECRET'],
      credential_needs: ['Supabase API'],
      node_plan: ['Webhook trigger'],
      ingest_callbacks: ['/api/admin/meetings/ingest'],
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, work_item: { id: 'proposal-work-item' } })
    expect(mocks.createN8nWorkflowProposal).toHaveBeenCalledWith(expect.objectContaining({
      action: 'draft_workflow',
      title: 'Meeting follow-up workflow',
      requestedByUserId: 'admin-user',
      requiredEnvVars: ['N8N_INGEST_SECRET'],
    }))
  })

  it('requires confirmation for staging and activation requests', async () => {
    const response = await POST(request({
      action: 'stage_workflow',
      title: 'Stage workflow',
      objective: 'Stage inactive workflow.',
    }) as never)

    expect(response.status).toBe(400)
    expect(mocks.createN8nWorkflowProposal).not.toHaveBeenCalled()
  })

  it('rejects invalid actions', async () => {
    const response = await POST(request({
      action: 'activate_now',
      title: 'Bad',
      objective: 'Bad',
    }) as never)

    expect(response.status).toBe(400)
  })
})
