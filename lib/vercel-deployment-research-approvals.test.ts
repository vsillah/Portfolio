import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelResearchProposal } from './vercel-deployment-research'

const mocks = vi.hoisted(() => ({
  createAgentWorkItem: vi.fn(),
  recordAgentEvent: vi.fn(),
  notify: vi.fn(),
  fingerprintOpenBrainRecord: vi.fn((parts: unknown[]) => `fingerprint:${parts.join(':')}`),
  recordOpenBrainEvent: vi.fn(),
  recordOpenBrainSource: vi.fn(),
  from: vi.fn(),
  approvalInsert: vi.fn(),
  approvalUpdate: vi.fn(),
  workItemUpdate: vi.fn(),
  runUpdate: vi.fn(),
}))

vi.mock('./agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

vi.mock('./agent-run', () => ({
  recordAgentEvent: mocks.recordAgentEvent,
}))

vi.mock('./vercel-autoresearch-notification', () => ({
  notifyVercelResearchApprovalReady: mocks.notify,
}))

vi.mock('./open-brain', () => ({
  fingerprintOpenBrainRecord: mocks.fingerprintOpenBrainRecord,
  recordOpenBrainEvent: mocks.recordOpenBrainEvent,
  recordOpenBrainSource: mocks.recordOpenBrainSource,
}))

vi.mock('./supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { createVercelResearchApproval } from './vercel-deployment-research-approvals'

const proposal: VercelResearchProposal = {
  id: 'next-build-profile',
  title: 'Profile build',
  hypothesis: 'Build profiling can find the slow path.',
  expectedImpact: 'Better deployment research focus.',
  scorecardBaseline: {
    project: 'portfolio',
    target: 'preview',
    queueSeconds: 10,
    buildSeconds: 300,
    totalSeconds: 310,
  },
  touchedFiles: ['package.json'],
  touchedSettings: [],
  riskLevel: 'low',
  approvalState: 'not_required',
  approvalQuestion: 'Approve the build-profile experiment?',
  rollbackPath: 'Discard the branch.',
  evidence: ['build=5m00s'],
}

function updateEqChain() {
  return { eq: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: null, error: null }) })) }
}

function setupNewApproval() {
  const single = vi.fn().mockResolvedValue({
    data: {
      id: 'approval-1',
      run_id: 'run-1',
      status: 'pending',
      requested_at: '2026-05-11T12:00:00.000Z',
      metadata: {
        work_item_id: 'work-1',
        proposal_id: proposal.id,
        proposal,
      },
    },
    error: null,
  })
  mocks.approvalInsert.mockReturnValue({ select: vi.fn(() => ({ single })) })
  mocks.approvalUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
  mocks.workItemUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
  mocks.runUpdate.mockReturnValue(updateEqChain())
  mocks.from.mockImplementation((table: string) => {
    if (table === 'agent_approvals') {
      return {
        insert: mocks.approvalInsert,
        update: mocks.approvalUpdate,
      }
    }
    if (table === 'agent_work_items') return { update: mocks.workItemUpdate }
    if (table === 'agent_runs') return { update: mocks.runUpdate }
    return {}
  })
}

function setupExistingApproval() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'approval-1',
      run_id: 'run-1',
      status: 'pending',
      requested_at: '2026-05-11T12:00:00.000Z',
      metadata: {
        work_item_id: 'work-1',
        proposal_id: proposal.id,
        proposal,
        notification: { slack_agent_ops_sent_at: '2026-05-11T12:01:00.000Z' },
      },
    },
    error: null,
  })
  mocks.from.mockImplementation((table: string) => {
    if (table === 'agent_approvals') {
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
      }
    }
    return {}
  })
}

describe('createVercelResearchApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.notify.mockResolvedValue(true)
    mocks.recordOpenBrainSource.mockResolvedValue({
      id: 'autoresearch:proposal:next-build-profile',
      kind: 'autoresearch_proposal',
    })
    mocks.recordOpenBrainEvent.mockResolvedValue({
      id: 'event:autoresearch-proposal-created:next-build-profile',
      kind: 'autoresearch_proposal_created',
    })
  })

  it('creates one pending approval and dispatches one notification intent', async () => {
    mocks.createAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      active_run_id: 'run-1',
      approval_id: null,
    })
    setupNewApproval()

    await expect(createVercelResearchApproval({
      proposal,
      createdByUserId: 'admin-user',
    })).resolves.toMatchObject({
      approvalId: 'approval-1',
      runId: 'run-1',
      notification: { sent: true },
    })

    expect(mocks.approvalInsert).toHaveBeenCalledWith(expect.objectContaining({
      approval_type: 'vercel_deployment_research_proposal',
      status: 'pending',
      metadata: expect.objectContaining({
        proposal_id: 'next-build-profile',
        action_payload: expect.objectContaining({ executes_action: false }),
      }),
    }))
    expect(mocks.notify).toHaveBeenCalledTimes(1)
    expect(mocks.recordOpenBrainSource).toHaveBeenCalledWith(expect.objectContaining({
      id: 'autoresearch:proposal:next-build-profile',
      kind: 'autoresearch_proposal',
      privacyTier: 'internal_ops',
    }))
    expect(mocks.recordOpenBrainEvent).toHaveBeenCalledWith(expect.objectContaining({
      id: 'event:autoresearch-proposal-created:next-build-profile',
      kind: 'autoresearch_proposal_created',
      sourceIds: ['autoresearch:proposal:next-build-profile'],
      metadata: expect.objectContaining({ executesAction: false }),
    }))
    expect(mocks.approvalUpdate).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        notification: expect.objectContaining({
          slack_agent_ops_sent_at: expect.any(String),
        }),
      }),
    }))
  })

  it('does not resend when a duplicate proposal already has notification metadata', async () => {
    mocks.createAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      active_run_id: 'run-1',
      approval_id: 'approval-1',
    })
    setupExistingApproval()

    await expect(createVercelResearchApproval({
      proposal,
      createdByUserId: 'admin-user',
    })).resolves.toMatchObject({
      approvalId: 'approval-1',
      notification: { sent: true },
    })

    expect(mocks.notify).not.toHaveBeenCalled()
  })
})
