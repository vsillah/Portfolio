import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabaseAdmin: {},
}))

vi.mock('./agent-run', () => ({
  attachAgentArtifact: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
  recordAgentStep: vi.fn(),
  startAgentRun: vi.fn(),
}))

import { buildProgressUpdateAgentTracePayload } from './progress-update-templates'

describe('progress update agent trace payloads', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null trace fields when no agent run exists', () => {
    expect(buildProgressUpdateAgentTracePayload(null)).toEqual({
      agent_run_id: null,
      agent_event_callback_url: null,
      agent_trace: null,
    })
  })

  it('builds the generic Agent Ops callback envelope for n8n', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://portfolio.example.com/')

    expect(buildProgressUpdateAgentTracePayload('agent-run-1')).toMatchObject({
      agent_run_id: 'agent-run-1',
      agent_event_callback_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
      agent_trace: {
        version: 1,
        runtime: 'n8n',
        agent_run_id: 'agent-run-1',
        workflow_id: 'client-progress-update-router',
        events_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
        auth: 'Bearer N8N_INGEST_SECRET',
      },
    })
  })
})
