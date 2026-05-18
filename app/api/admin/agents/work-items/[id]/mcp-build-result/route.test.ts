import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  recordAgentWorkItemMcpBuildResult: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  recordAgentWorkItemMcpBuildResult: mocks.recordAgentWorkItemMcpBuildResult,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/mcp-build-result', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/work-items/[id]/mcp-build-result', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.recordAgentWorkItemMcpBuildResult.mockResolvedValue({ id: 'work-1', status: 'ready_for_review' })
  })

  it('records returned MCP build evidence for a work item', async () => {
    const response = await POST(request({
      result_summary: 'Inactive staging workflow created and inspected.',
      workflow_id: 'wf_123',
      validation_result: 'Static inspection passed.',
      test_evidence: 'Dry-run fixture completed.',
      credential_gaps: ['MAILGUN_API_KEY'],
      env_gaps: ['N8N_INGEST_SECRET'],
      rollback_notes: 'Delete inactive workflow wf_123.',
      activation_requested: true,
    }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, work_item: { id: 'work-1' } })
    expect(mocks.recordAgentWorkItemMcpBuildResult).toHaveBeenCalledWith({
      id: 'work-1',
      resultSummary: 'Inactive staging workflow created and inspected.',
      workflowId: 'wf_123',
      inspectionResult: null,
      validationResult: 'Static inspection passed.',
      testEvidence: 'Dry-run fixture completed.',
      credentialGaps: ['MAILGUN_API_KEY'],
      envGaps: ['N8N_INGEST_SECRET'],
      rollbackNotes: 'Delete inactive workflow wf_123.',
      activationRequested: true,
      actorLabel: 'admin@example.com',
    })
  })

  it('requires a result summary', async () => {
    const response = await POST(request({ result_summary: '' }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(400)
    expect(mocks.recordAgentWorkItemMcpBuildResult).not.toHaveBeenCalled()
  })
})
