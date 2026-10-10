import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  recordAgentStep: vi.fn(),
  recordAgentEvent: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/agent-run', () => ({
  recordAgentStep: mocks.recordAgentStep,
  recordAgentEvent: mocks.recordAgentEvent,
}))

import { POST } from './route'

const originalEnv = { ...process.env }

function request(body?: unknown, authorization?: string) {
  return new NextRequest('http://localhost/api/admin/value-evidence/workflow-progress', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/workflow-progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env = { ...originalEnv, N8N_INGEST_SECRET: 'secret-token' }
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function installRuns(options: {
    byId?: { id: string } | null
    fallback?: { id: string } | null
    current?: { stages: Record<string, string> | null; items_inserted: number | null } | null
    updateError?: { message: string } | null
  }) {
    const updateEq = vi.fn().mockResolvedValue({ error: options.updateError ?? null })
    const update = vi.fn(() => ({ eq: updateEq }))
    const idSingle = vi.fn().mockResolvedValue({ data: options.byId ?? null, error: null })
    const fallbackMaybe = vi.fn().mockResolvedValue({ data: options.fallback ?? null, error: null })
    const stagesSingle = vi.fn().mockResolvedValue({ data: options.current ?? null, error: null })
    const workflowEq = vi.fn()

    mocks.from.mockImplementation(() => ({
      select: (columns: string) => {
        if (columns === 'id') {
          return {
            eq: (column: string, value: string) => {
              if (column === 'id') return { single: idSingle, value }
              workflowEq(column, value)
              return {
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({ maybeSingle: fallbackMaybe })),
                  })),
                })),
              }
            },
          }
        }
        return { eq: vi.fn(() => ({ single: stagesSingle })) }
      },
      update,
    }))

    return { update, updateEq, idSingle, fallbackMaybe, workflowEq }
  }

  it('rejects a missing or mismatched ingest secret before reading the body', async () => {
    delete process.env.N8N_INGEST_SECRET

    const missing = await POST(request({ workflow_id: 'vep001', stage: 'extract' }, 'Bearer secret-token'))
    expect(missing.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()

    process.env.N8N_INGEST_SECRET = 'secret-token'
    const mismatched = await POST(request({ workflow_id: 'vep001', stage: 'extract' }, 'bearer secret-token'))
    expect(mismatched.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a known workflow id and stage', async () => {
    const invalidJson = await POST(request('not-json', 'Bearer secret-token'))
    expect(invalidJson.status).toBe(400)
    expect(await invalidJson.json()).toEqual({ error: 'workflow_id and stage are required' })

    const unknown = await POST(request({ workflow_id: 'vep003', stage: 'extract' }, 'Bearer secret-token'))
    expect(unknown.status).toBe(400)
    expect(await unknown.json()).toEqual({
      error: 'workflow_id must be vep001, vep002, WF-VEP-001, or WF-VEP-002',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('falls back to the latest running row when the supplied run id is missing', async () => {
    const { workflowEq, update, updateEq } = installRuns({
      byId: null,
      fallback: { id: 'latest-run' },
      current: { stages: { extract: 'complete' }, items_inserted: 2 },
    })

    const response = await POST(
      request(
        {
          run_id: 'missing-run',
          workflow_id: 'WF-VEP-002',
          stage: 'classify',
          items_count: 3,
          agent_run_id: 'agent-1',
        },
        'Bearer secret-token'
      )
    )

    expect(workflowEq).toHaveBeenCalledWith('workflow_id', 'vep002')
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        stages: { extract: 'complete', classify: 'complete' },
        items_inserted: 5,
      })
    )
    expect(updateEq).toHaveBeenCalledWith('id', 'latest-run')
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-1',
        stepKey: 'n8n_vep002_classify',
        status: 'completed',
        outputSummary: '3 item(s)',
        idempotencyKey: 'agent-1:vep002:classify:complete',
      })
    )
    expect(await response.json()).toEqual({ ok: true, run_id: 'latest-run', agent_run_id: 'agent-1' })
  })

  it('records an error stage as failed and does not add items when the count is omitted', async () => {
    const { update, fallbackMaybe } = installRuns({
      byId: { id: 'run-1' },
      current: { stages: null, items_inserted: null },
    })

    await POST(
      request(
        {
          run_id: 'run-1',
          workflow_id: 'vep001',
          stage: 'extract',
          status: 'error',
          items_count: null,
          agent_run_id: 'agent-1',
        },
        'Bearer secret-token'
      )
    )

    expect(fallbackMaybe).not.toHaveBeenCalled()
    const patch = update.mock.calls[0][0] as { stages: Record<string, string>; items_inserted?: number }
    expect(patch.stages).toEqual({ extract: 'error' })
    expect(patch.items_inserted).toBeUndefined()
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        outputSummary: 'error',
        idempotencyKey: 'agent-1:vep001:extract:error',
      })
    )
  })

  it('counts a zero item increment and records an agent event when the step write fails', async () => {
    const { update } = installRuns({
      byId: { id: 'run-1' },
      current: { stages: {}, items_inserted: 4 },
    })
    mocks.recordAgentStep.mockRejectedValue(new Error('step write failed'))

    const response = await POST(
      request(
        {
          run_id: 'run-1',
          workflow_id: 'vep001',
          stage: 'extract',
          status: 'running',
          items_count: 0,
          agent_run_id: 'agent-1',
        },
        'Bearer secret-token'
      )
    )

    expect(update.mock.calls[0][0]).toEqual(expect.objectContaining({ items_inserted: 4, stages: { extract: 'running' } }))
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-1',
        eventType: 'n8n_progress',
        severity: 'info',
        idempotencyKey: 'agent-1:vep001:extract:event:running',
      })
    )
    expect(response.status).toBe(200)
  })

  it('returns 404 when no run matches and returns the database message when the update fails', async () => {
    installRuns({ byId: null, fallback: null })
    const missing = await POST(request({ workflow_id: 'vep001', stage: 'extract' }, 'Bearer secret-token'))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'No matching run found', ok: false })

    installRuns({
      byId: { id: 'run-1' },
      current: { stages: {}, items_inserted: 0 },
      updateError: { message: 'write failed' },
    })
    const failed = await POST(
      request({ run_id: 'run-1', workflow_id: 'vep001', stage: 'extract', agent_run_id: 'agent-1' }, 'Bearer secret-token')
    )
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'write failed' })
    expect(mocks.recordAgentStep).not.toHaveBeenCalled()
  })
})
