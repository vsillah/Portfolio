import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

import { createN8nWorkflowProposal, isN8nWorkflowProposalAction } from './agent-n8n-workflow-proposals'

describe('agent n8n workflow proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createAgentWorkItem.mockResolvedValue({ id: 'work-item-1' })
  })

  it('validates proposal actions', () => {
    expect(isN8nWorkflowProposalAction('draft_workflow')).toBe(true)
    expect(isN8nWorkflowProposalAction('delete_production_workflow')).toBe(false)
  })

  it('creates approval-gated n8n proposal work items', async () => {
    const result = await createN8nWorkflowProposal({
      action: 'draft_workflow',
      title: 'Draft meeting follow-up workflow',
      objective: 'Create a staging-safe workflow proposal.',
      workflowFamily: 'meeting_follow_up',
      automationGoalSeedId: 'meeting-intake-follow-up-drafts',
      goalId: 'automation:meeting-intake-follow-up-drafts',
      goalTitle: 'Automate meeting intake to follow-up drafts',
      goalSessionHref: '/admin/agents/standup?goal=automation%3Ameeting-intake-follow-up-drafts',
      requiredEnvVars: ['N8N_INGEST_SECRET'],
      credentialNeeds: ['Supabase API'],
      nodePlan: ['Webhook trigger', 'HTTP callback'],
      ingestCallbacks: ['/api/admin/meetings/ingest'],
      rollbackPath: 'Delete inactive workflow proposal.',
      requestedByUserId: 'admin-user',
    })

    expect(result).toEqual({ id: 'work-item-1' })
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'n8n proposal: Draft meeting follow-up workflow',
      status: 'proposed',
      ownerAgentKey: 'automation-systems',
      ownerRuntime: 'n8n',
      metadata: expect.objectContaining({
        n8n_workflow_proposal: true,
        n8n_proposal_action: 'draft_workflow',
        automation_goal_seed_id: 'meeting-intake-follow-up-drafts',
        goal_id: 'automation:meeting-intake-follow-up-drafts',
        goal_title: 'Automate meeting intake to follow-up drafts',
        goal_role: 'task',
        goal_progress_weight: 1,
        approval_gate: expect.stringContaining('Production activation'),
      }),
    }))
  })

  it('rejects malformed proposals', async () => {
    await expect(createN8nWorkflowProposal({
      action: 'inspect_workflow',
      title: '',
      objective: 'Missing title.',
    })).rejects.toThrow('title and objective are required')
  })
})
