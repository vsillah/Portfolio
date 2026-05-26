import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: null }))

import { buildClientAiOpsReadinessContract } from './client-ai-ops-readiness-contract'
import { buildSyntheticClientAiOpsPilot } from './client-ai-ops-synthetic-pilot'

describe('buildClientAiOpsReadinessContract', () => {
  it('summarizes the synthetic pilot into a stable approval-gated contract', () => {
    const pilot = buildSyntheticClientAiOpsPilot()
    const contract = buildClientAiOpsReadinessContract(pilot.clientView, {
      swarmSnapshot: pilot.swarmSnapshot,
      clientProjectId: 'synthetic-client-ai-ops-project',
    })

    expect(contract).toMatchObject({
      status: 'waiting_approval',
      sideEffectsEnabled: false,
      connector: {
        required: expect.any(Number),
        approvalBlocked: 0,
        missingCritical: 0,
      },
      projection: {
        approvals: expect.any(Number),
        monitorFlags: 0,
      },
      swarm: {
        moduleHealth: 'green',
        approvalState: 'none',
        autonomousReady: true,
      },
      approvalBoundaries: {
        credentialSync: 'waiting_approval',
        providerSetup: 'waiting_approval',
        outboundSend: 'waiting_approval',
        productionDeploy: 'waiting_approval',
        clientDataMutation: 'waiting_approval',
      },
    })
    expect(contract.projection.approvals).toBeGreaterThan(0)
    expect(contract.connector.required).toBeGreaterThanOrEqual(6)
  })

  it('routes approval-heavy roadmap state to waiting approval', () => {
    const pilot = buildSyntheticClientAiOpsPilot()
    const contract = buildClientAiOpsReadinessContract({
      ...pilot.clientView,
      projectionStatus: {
        ...pilot.clientView.projectionStatus,
        approvalNeededCount: 2,
      },
    })

    expect(contract).toMatchObject({
      status: 'waiting_approval',
      nextAction: 'Review approval-gated AI Ops work before any live setup or outbound action.',
      sideEffectsEnabled: false,
    })
  })

  it('handles missing roadmap state without inventing setup readiness', () => {
    const contract = buildClientAiOpsReadinessContract(null)

    expect(contract).toMatchObject({
      status: 'needs_roadmap',
      sideEffectsEnabled: false,
      connector: {
        required: 0,
        nextAction: 'Create the Client AI Ops roadmap first.',
      },
      swarm: {
        column: null,
        autonomousReady: false,
      },
    })
  })
})
