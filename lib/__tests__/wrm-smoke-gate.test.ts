import { describe, expect, it } from 'vitest'
import {
  WRM_SMOKE_WORKFLOWS,
  agentEventCallbackUrl,
  assertProductionCallbackBaseUrl,
  assertProductionWebhookUrl,
  buildWrmSmokePayload,
  isSyntheticSmokeName,
} from '@/lib/wrm-smoke-gate'

describe('WRM smoke gate helpers', () => {
  it('builds a synthetic smoke payload with Agent Ops callback wiring', () => {
    const workflow = WRM_SMOKE_WORKFLOWS[0]
    const payload = buildWrmSmokePayload({
      workflow,
      runId: 'run-123',
      callbackBaseUrl: 'https://amadutown.com/',
    })

    expect(payload).toMatchObject({
      mode: 'smoke',
      is_test_data: true,
      callbackBaseUrl: 'https://amadutown.com',
      agent_run_id: 'run-123',
      agent_event_callback_url: 'https://amadutown.com/api/admin/agents/runs/run-123/events',
      agent_callback_contract: {
        version: 1,
        runtime: 'n8n',
        events_url: 'https://amadutown.com/api/admin/agents/runs/run-123/events',
        auth_header: 'Authorization: Bearer N8N_INGEST_SECRET',
        final_completion_payload: {
          workflow_id: 'WF-WRM-001',
          status: 'completed',
          final: true,
        },
        failure_payload: {
          workflow_id: 'WF-WRM-001',
          status: 'failed',
        },
      },
      agent_trace: {
        version: 1,
        runtime: 'n8n',
        agent_run_id: 'run-123',
        mode: 'smoke',
        source: 'facebook',
        workflow_id: 'WF-WRM-001',
        events_url: 'https://amadutown.com/api/admin/agents/runs/run-123/events',
        callback_contract: {
          events_url: 'https://amadutown.com/api/admin/agents/runs/run-123/events',
        },
      },
    })
  })

  it('rejects non-production callback URLs for the production gate', () => {
    expect(() => assertProductionCallbackBaseUrl('https://amadutown.com')).not.toThrow()
    expect(() => assertProductionCallbackBaseUrl('https://portfolio-staging-vsillahs-projects.vercel.app')).toThrow(
      /requires callback base URL/
    )
  })

  it('rejects webhook-test URLs for the production gate', () => {
    expect(() => assertProductionWebhookUrl('N8N_WRM001_WEBHOOK_URL', 'https://amadutown.app.n8n.cloud/webhook/wrm-001-facebook')).not.toThrow()
    expect(() => assertProductionWebhookUrl('N8N_WRM001_WEBHOOK_URL', 'https://amadutown.app.n8n.cloud/webhook-test/wrm-001-facebook')).toThrow(
      /webhook-test/
    )
  })

  it('recognizes source-specific synthetic smoke names', () => {
    const linkedin = WRM_SMOKE_WORKFLOWS.find((workflow) => workflow.workflowId === 'WF-WRM-003')
    expect(linkedin).toBeDefined()
    expect(isSyntheticSmokeName('ATAS Production LinkedIn Smoke Lead 123', linkedin!)).toBe(true)
    expect(isSyntheticSmokeName('ATAS Production Facebook Smoke Lead 123', linkedin!)).toBe(false)
  })

  it('formats Agent Ops callback URLs consistently', () => {
    expect(agentEventCallbackUrl('https://amadutown.com/', 'abc')).toBe(
      'https://amadutown.com/api/admin/agents/runs/abc/events'
    )
  })
})
