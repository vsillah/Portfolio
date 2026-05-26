import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: null }))

import { buildSyntheticClientAiOpsPilot } from './client-ai-ops-synthetic-pilot'

describe('buildSyntheticClientAiOpsPilot', () => {
  it('proves audit-to-roadmap-to-client-view connector readiness with synthetic data only', () => {
    const pilot = buildSyntheticClientAiOpsPilot()
    const connectorKeys = pilot.clientView.connectorReadiness.items.map((item) => item.key)

    expect(pilot.context.auditSignals?.[0]?.tech_stack).toMatchObject({
      crm: 'hubspot',
      email: 'gmail',
      marketing: 'mailchimp',
    })
    expect(connectorKeys).toEqual(expect.arrayContaining([
      'webflow',
      'hubspot',
      'google_workspace',
      'slack',
      'pinecone',
      'google_analytics',
    ]))
    expect(pilot.clientView.connectorReadiness.requiredConnectorCount).toBeGreaterThanOrEqual(6)
    expect(pilot.clientView.connectorReadiness.connectorNextAction).toContain('do not connect until approved')
    expect(JSON.stringify(pilot)).not.toContain('access_token')
    expect(JSON.stringify(pilot)).not.toContain('api_secret')
  })

  it('keeps discovery, tech decision, provisioning, and QA handoffs autonomous only for read-only work', () => {
    const pilot = buildSyntheticClientAiOpsPilot()

    expect(pilot.autonomousHandoffPath.map((step) => step.stage)).toEqual([
      'discovery',
      'technology_decision',
      'provisioning_plan',
      'qa_isolation',
    ])
    for (const step of pilot.autonomousHandoffPath) {
      expect(step.decision).toMatchObject({
        autonomousAllowed: true,
        requiresApproval: false,
      })
    }
  })

  it('routes credential sync and outbound sends to approval boundaries', () => {
    const pilot = buildSyntheticClientAiOpsPilot()

    expect(pilot.approvalBoundary.credentialSync).toMatchObject({
      autonomousAllowed: false,
      requiresApproval: true,
      nextColumn: 'waiting_approval',
    })
    expect(pilot.approvalBoundary.credentialSync.approvalActions).toEqual(expect.arrayContaining([
      'client_data_access',
      'production_config_change',
    ]))
    expect(pilot.approvalBoundary.outboundSend).toMatchObject({
      autonomousAllowed: false,
      requiresApproval: true,
      nextColumn: 'waiting_approval',
      approvalActions: ['send_email'],
    })
  })

  it('projects the synthetic pilot into the swarm board without pending approvals or failed runs', () => {
    const pilot = buildSyntheticClientAiOpsPilot()
    const cards = pilot.swarmSnapshot.columns.flatMap((column) => column.cards)
    const card = cards.find((item) => item.clientProjectId === 'synthetic-client-ai-ops-project')

    expect(card).toBeTruthy()
    expect(card).toMatchObject({
      moduleHealth: 'green',
      approvalState: 'none',
      failedOrStaleRuns: 0,
      pendingApprovals: 0,
    })
    expect(card?.requiredConnectorCount).toBeGreaterThanOrEqual(6)
    expect(['provisioning_plan', 'qa_isolation', 'active_monitoring']).toContain(card?.column)
    expect(pilot.swarmSnapshot.summary).toMatchObject({
      clients: 1,
      failed_or_stale: 0,
      pending_approvals: 0,
      isolation_failures: 0,
      autonomous_ready: 1,
    })
  })
})
