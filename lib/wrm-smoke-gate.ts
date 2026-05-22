import { buildN8nAgentCallbackEnvelope } from './n8n-agent-callback'

export type WrmSmokeSource = 'facebook' | 'google_contacts' | 'linkedin'

export interface WrmSmokeWorkflow {
  source: WrmSmokeSource
  workflowId: string
  title: string
  envVar: string
  leadSource: string
  smokeNamePrefix: string
}

export interface WrmSmokePayloadInput {
  workflow: WrmSmokeWorkflow
  runId: string
  callbackBaseUrl: string
}

export const WRM_SMOKE_WORKFLOWS: WrmSmokeWorkflow[] = [
  {
    source: 'facebook',
    workflowId: 'WF-WRM-001',
    title: 'WRM-001 production smoke gate',
    envVar: 'N8N_WRM001_WEBHOOK_URL',
    leadSource: 'warm_facebook_friends',
    smokeNamePrefix: 'ATAS Production Facebook Smoke Lead',
  },
  {
    source: 'google_contacts',
    workflowId: 'WF-WRM-002',
    title: 'WRM-002 production smoke gate',
    envVar: 'N8N_WRM002_WEBHOOK_URL',
    leadSource: 'warm_google_contacts',
    smokeNamePrefix: 'ATAS Production Google Smoke Lead',
  },
  {
    source: 'linkedin',
    workflowId: 'WF-WRM-003',
    title: 'WRM-003 production smoke gate',
    envVar: 'N8N_WRM003_WEBHOOK_URL',
    leadSource: 'warm_linkedin',
    smokeNamePrefix: 'ATAS Production LinkedIn Smoke Lead',
  },
]

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

export function agentEventCallbackUrl(callbackBaseUrl: string, runId: string): string {
  return `${normalizeBaseUrl(callbackBaseUrl)}/api/admin/agents/runs/${runId}/events`
}

export function buildWrmSmokePayload(input: WrmSmokePayloadInput): Record<string, unknown> {
  const eventsUrl = agentEventCallbackUrl(input.callbackBaseUrl, input.runId)

  return {
    mode: 'smoke',
    is_test_data: true,
    callbackBaseUrl: normalizeBaseUrl(input.callbackBaseUrl),
    ...buildN8nAgentCallbackEnvelope({
      agentRunId: input.runId,
      eventsUrl,
      workflowId: input.workflow.workflowId,
      trace: {
        mode: 'smoke',
        source: input.workflow.source,
      },
    }),
  }
}

export function assertProductionCallbackBaseUrl(callbackBaseUrl: string): void {
  const normalized = normalizeBaseUrl(callbackBaseUrl)
  if (normalized !== 'https://amadutown.com') {
    throw new Error(
      `WRM production smoke gate requires callback base URL https://amadutown.com; received ${normalized}`
    )
  }
}

export function assertProductionWebhookUrl(envVar: string, webhookUrl: string): void {
  if (!webhookUrl.trim()) {
    throw new Error(`${envVar} is required`)
  }

  const parsed = new URL(webhookUrl)
  if (parsed.protocol !== 'https:') {
    throw new Error(`${envVar} must use https`)
  }
  if (parsed.pathname.includes('/webhook-test/')) {
    throw new Error(`${envVar} points at webhook-test; production smoke gate requires production webhook URLs`)
  }
}

export function isSyntheticSmokeName(name: string, workflow: WrmSmokeWorkflow): boolean {
  return name.startsWith(workflow.smokeNamePrefix)
}
