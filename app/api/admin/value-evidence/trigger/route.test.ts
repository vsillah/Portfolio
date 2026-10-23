import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  triggerValueEvidenceExtraction: vi.fn(),
  triggerSocialListening: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  markAgentRunFailed: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/n8n', () => ({
  triggerValueEvidenceExtraction: mocks.triggerValueEvidenceExtraction,
  triggerSocialListening: mocks.triggerSocialListening,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

import { POST } from './route'

type QueryResult = { data: unknown; error: unknown }

function thenableQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  return query
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/value-evidence/trigger', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.triggerValueEvidenceExtraction.mockResolvedValue({ triggered: true, message: 'ok' })
    mocks.triggerSocialListening.mockResolvedValue({ triggered: true, message: 'ok' })
    mocks.startAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.recordAgentStep.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
  })

  it('requires admin authentication before dispatching n8n', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ workflow: 'internal_extraction' }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.triggerValueEvidenceExtraction).not.toHaveBeenCalled()
  })

  it('rejects unknown workflows and scope types without writing a run', async () => {
    const badWorkflow = await POST(makeRequest({ workflow: 'not_a_workflow' }))
    expect(badWorkflow.status).toBe(400)
    await expect(badWorkflow.json()).resolves.toEqual({
      error: 'workflow must be one of: internal_extraction, social_listening, social_listening_lead',
    })

    const badScope = await POST(makeRequest({ workflow: 'internal_extraction', scope_type: 'proposal', scope_id: '1' }))
    expect(badScope.status).toBe(400)
    await expect(badScope.json()).resolves.toEqual({
      error: 'scope_type must be one of: meeting, assessment, lead',
    })

    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.triggerValueEvidenceExtraction).not.toHaveBeenCalled()
    expect(mocks.triggerSocialListening).not.toHaveBeenCalled()
  })

  it('returns 404 when a scoped meeting cannot be found', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: null }))

    const response = await POST(
      makeRequest({ workflow: 'internal_extraction', scope_type: 'meeting', scope_id: 'missing-meeting' }),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Could not find meeting with id missing-meeting',
    })
    expect(mocks.from).toHaveBeenCalledWith('meeting_records')
    expect(mocks.triggerValueEvidenceExtraction).not.toHaveBeenCalled()
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('records a vep001 run and dispatches internal extraction', async () => {
    const insertQuery = thenableQuery({ data: { id: 'run-1' }, error: null })
    mocks.from.mockReturnValue(insertQuery)

    const response = await POST(makeRequest({ workflow: 'internal_extraction', maxResults: 7, sources: ['reddit', 'nope'] }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      triggered: true,
      message: 'ok',
      run_id: 'run-1',
      agent_run_id: 'agent-run-1',
    })
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_id: 'vep001',
        status: 'running',
      }),
    )
    expect(mocks.triggerValueEvidenceExtraction).toHaveBeenCalledWith({
      runId: 'run-1',
      agentRunId: 'agent-run-1',
    })
    expect(mocks.triggerSocialListening).not.toHaveBeenCalled()
    expect(mocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: 'n8n',
        kind: 'internal_extraction',
        triggerSource: 'admin_value_evidence_trigger',
        triggeredByUserId: 'admin-1',
        idempotencyKey: 'n8n:value-evidence:run-1',
      }),
    )
  })

  it('uses vep002 for social_listening_lead and defaults maxResults to 5', async () => {
    const insertQuery = thenableQuery({ data: { id: 'run-2' }, error: null })
    mocks.from.mockReturnValue(insertQuery)

    const response = await POST(makeRequest({ workflow: 'social_listening_lead' }))

    expect(response.status).toBe(200)
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_id: 'vep002',
        stages: { scope: { maxResults: 5, mode: 'single_lead' } },
      }),
    )
    expect(mocks.triggerSocialListening).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-2',
        agentRunId: 'agent-run-1',
        maxResults: 5,
      }),
    )
    expect(mocks.triggerValueEvidenceExtraction).not.toHaveBeenCalled()
  })

  it('marks the agent run failed when the webhook does not dispatch', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: { id: 'run-3' }, error: null }))
    mocks.triggerSocialListening.mockResolvedValue({ triggered: false, message: 'Webhook returned 502' })

    const response = await POST(makeRequest({ workflow: 'social_listening' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ triggered: false, run_id: 'run-3' })
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith('agent-run-1', 'Webhook returned 502', {
      workflow_id: 'vep002',
      legacy_run_id: 'run-3',
    })
    expect(mocks.recordAgentStep).not.toHaveBeenCalled()
  })
})
