import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  recordAgentStep: vi.fn(),
  markAgentRunFailed: vi.fn(),
  attachAgentArtifact: vi.fn(),
  endAgentRun: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/agent-run', () => ({
  recordAgentStep: mocks.recordAgentStep,
  markAgentRunFailed: mocks.markAgentRunFailed,
  attachAgentArtifact: mocks.attachAgentArtifact,
  endAgentRun: mocks.endAgentRun,
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function request(body: unknown, authHeader: string | null = 'Bearer secret-token') {
  return new NextRequest('http://localhost/api/admin/outreach/run-complete', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/outreach/run-complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.N8N_INGEST_SECRET = 'secret-token'
    mocks.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })
    mocks.recordAgentStep.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.attachAgentArtifact.mockResolvedValue(undefined)
    mocks.endAgentRun.mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreEnv()
    vi.restoreAllMocks()
  })

  it('returns 401 when bearer token is missing, invalid, or the ingest secret is unset', async () => {
    const missing = await POST(request({ source: 'facebook' }, null))
    expect(missing.status).toBe(401)
    expect(await missing.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()

    const wrong = await POST(request({ source: 'facebook' }, 'Bearer wrong'))
    expect(wrong.status).toBe(401)

    delete process.env.N8N_INGEST_SECRET
    const unset = await POST(request({ source: 'facebook' }))
    expect(unset.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when source is missing or invalid', async () => {
    const missing = await POST(request({}))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({
      error: 'source is required and must be one of: facebook, google_contacts, linkedin',
    })

    const invalid = await POST(request({ source: 'all' }))
    expect(invalid.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('records a success audit row so the 24-hour skip gate can fire', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(request({ source: 'linkedin', leads_inserted: 3 }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      message: 'Run complete recorded for source: linkedin',
      agent_run_id: null,
    })

    expect(mocks.from).toHaveBeenCalledWith('warm_lead_trigger_audit')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'linkedin',
        triggered_by: null,
        status: 'success',
        leads_inserted: 3,
        error_message: null,
      }),
    )
    expect(insert.mock.calls[0][0].completed_at).toBe(insert.mock.calls[0][0].triggered_at)
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })

  it('treats non-failed completion status as success and closes the agent run with an artifact', async () => {
    const response = await POST(
      request({
        source: 'facebook',
        agent_run_id: 'run-1',
        status: 'ok',
        leads_inserted: 2,
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, agent_run_id: 'run-1' })

    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        status: 'completed',
        idempotencyKey: 'run-1:complete:facebook',
      }),
    )
    expect(mocks.attachAgentArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        artifactType: 'lead_import',
        refId: 'facebook',
      }),
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-1', status: 'completed' }),
    )
    expect(mocks.markAgentRunFailed).not.toHaveBeenCalled()
  })

  it('records a failed audit row and marks the agent run failed without attaching an artifact', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(
      request({
        source: 'google_contacts',
        agent_run_id: 'run-fail',
        status: 'failed',
        error_message: 'apify timeout',
      }),
    )
    expect(response.status).toBe(200)

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'google_contacts',
        status: 'failed',
        error_message: 'apify timeout',
      }),
    )
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'run-fail',
      'apify timeout',
      expect.objectContaining({ source: 'google_contacts' }),
    )
    expect(mocks.attachAgentArtifact).not.toHaveBeenCalled()
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })

  it('returns 500 with a generic message when the audit insert fails', async () => {
    mocks.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: 'constraint' } }),
    })

    const response = await POST(request({ source: 'facebook' }))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to record run complete' })
  })
})
