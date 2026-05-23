import { describe, expect, it } from 'vitest'

import {
  buildN8nAgentCallbackContract,
  buildN8nAgentCallbackEnvelope,
} from './n8n-agent-callback'

describe('n8n Agent Ops callback contracts', () => {
  it('builds a reusable callback contract for workflow exports', () => {
    expect(buildN8nAgentCallbackContract(
      'https://portfolio.example.com/api/admin/agents/runs/run-1/events',
      'WF-PROV',
    )).toEqual({
      version: 1,
      runtime: 'n8n',
      events_url: 'https://portfolio.example.com/api/admin/agents/runs/run-1/events',
      auth_header: 'Authorization: Bearer N8N_INGEST_SECRET',
      required_fields: ['workflow_id', 'stage', 'status'],
      progress_statuses: ['running', 'in_progress', 'started'],
      completion_statuses: ['completed', 'complete', 'success'],
      failure_statuses: ['failed', 'error', 'failure'],
      final_completion_payload: {
        workflow_id: 'WF-PROV',
        stage: '<final-stage-name>',
        status: 'completed',
        final: true,
      },
      failure_payload: {
        workflow_id: 'WF-PROV',
        stage: '<failed-stage-name>',
        status: 'failed',
        error_message: '<required failure summary>',
      },
    })
  })

  it('wraps run identity, callback URL, and workflow trace metadata in one payload', () => {
    expect(buildN8nAgentCallbackEnvelope({
      agentRunId: 'agent-run-1',
      eventsUrl: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
      workflowId: 'client-progress-update-router',
      trace: {
        log_id: 'progress-log-1',
        channel: 'slack',
      },
    })).toMatchObject({
      agent_run_id: 'agent-run-1',
      agent_event_callback_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
      agent_callback_contract: {
        events_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
        required_fields: ['workflow_id', 'stage', 'status'],
        final_completion_payload: {
          workflow_id: 'client-progress-update-router',
          final: true,
        },
      },
      agent_trace: {
        version: 1,
        runtime: 'n8n',
        agent_run_id: 'agent-run-1',
        workflow_id: 'client-progress-update-router',
        events_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
        auth: 'Bearer N8N_INGEST_SECRET',
        log_id: 'progress-log-1',
        channel: 'slack',
      },
    })
  })
})
