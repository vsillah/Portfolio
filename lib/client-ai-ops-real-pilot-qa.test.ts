import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: null }))

import { buildClientAiOpsRealPilotQaPlan } from './client-ai-ops-real-pilot-qa'

describe('buildClientAiOpsRealPilotQaPlan', () => {
  it('builds a real-pilot QA plan from synthetic/test-owned data only', () => {
    const plan = buildClientAiOpsRealPilotQaPlan()

    expect(plan).toMatchObject({
      fixture: 'synthetic_client_ai_ops_pilot',
      projectId: 'synthetic-client-ai-ops-project',
      summary: {
        total: 7,
        blocked: 0,
      },
    })
    expect(plan.summary.passed).toBeGreaterThanOrEqual(5)
    expect(plan.summary.waitingApproval).toBe(1)
    expect(plan.summary.manualSmoke).toBe(1)
    expect(plan.checks.map((check) => check.key)).toEqual([
      'audit_to_connector_readiness',
      'admin_readiness_contract',
      'client_dashboard_setup_readiness',
      'monitor_readiness_summary',
      'meeting_task_projection',
      'approval_boundaries',
      'authenticated_ui_smoke',
    ])
  })

  it('keeps risky setup work behind approval boundaries', () => {
    const plan = buildClientAiOpsRealPilotQaPlan()
    const approvalCheck = plan.checks.find((check) => check.key === 'approval_boundaries')

    expect(approvalCheck).toMatchObject({
      status: 'waiting_approval',
      sideEffectFree: true,
      clientSafe: true,
    })
    expect(approvalCheck?.evidence).toContain('credentialSync=waiting_approval')
    expect(plan.forbiddenActions).toEqual(expect.arrayContaining([
      'OAuth connection',
      'credential sync',
      'provider write',
      'workflow activation',
      'outbound send',
      'client-data mutation',
    ]))
  })

  it('separates manual authenticated smoke from automated synthetic proof', () => {
    const plan = buildClientAiOpsRealPilotQaPlan()

    expect(plan.manualSmokeTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        surface: 'Admin project detail',
        expectedEvidence: expect.arrayContaining([
          'Readiness Contract panel shows side effects disabled.',
        ]),
      }),
      expect.objectContaining({
        surface: 'Client dashboard',
        expectedEvidence: expect.arrayContaining([
          'No internal swarm columns, agent traces, credentials, or provider internals are visible.',
        ]),
      }),
      expect.objectContaining({
        surface: 'Monitor report and meeting task projection',
        expectedEvidence: expect.arrayContaining([
          'Readiness blockers create an internal follow-up only.',
        ]),
      }),
    ]))
    expect(plan.checks.find((check) => check.key === 'authenticated_ui_smoke')).toMatchObject({
      status: 'needs_manual_smoke',
      sideEffectFree: true,
    })
  })
})
