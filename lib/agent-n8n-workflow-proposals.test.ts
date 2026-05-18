import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

import {
  buildN8nMcpHandoffPacket,
  createN8nWorkflowProposal,
  isN8nWorkflowProposalAction,
} from './agent-n8n-workflow-proposals'

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
        mcp_handoff_packet: expect.objectContaining({
          version: 'agent-ops-n8n-mcp-handoff/v1',
          action: 'draft_workflow',
          workflowFamily: 'meeting_follow_up',
          workflow: expect.objectContaining({
            nodePlan: ['Webhook trigger', 'HTTP callback'],
          }),
          guardrails: expect.arrayContaining([
            expect.stringContaining('inactive'),
          ]),
        }),
      }),
    }))
  })

  it('prioritizes request-activation proposals and keys them to the existing workflow', async () => {
    await createN8nWorkflowProposal({
      action: 'request_activation',
      title: 'Activate staged follow-up workflow',
      objective: 'Request approval for activation after dry-run evidence is attached.',
      existingWorkflowId: 'wf_staged_123',
      proposedWorkflowName: 'Staged meeting follow-up',
      testEvidence: 'Synthetic dry run passed; workflow is still inactive.',
      rollbackPath: 'Keep the workflow inactive or delete wf_staged_123.',
      requestedByUserId: 'admin-user',
    })

    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'n8n proposal: Activate staged follow-up workflow',
      priority: 'high',
      status: 'proposed',
      ownerAgentKey: 'automation-systems',
      ownerRuntime: 'n8n',
      source: expect.objectContaining({
        type: 'n8n_workflow_proposal',
        id: 'wf_staged_123',
      }),
      metadata: expect.objectContaining({
        n8n_proposal_action: 'request_activation',
        existing_workflow_id: 'wf_staged_123',
        mcp_handoff_packet: expect.objectContaining({
          action: 'request_activation',
          workflow: expect.objectContaining({
            existingWorkflowId: 'wf_staged_123',
            proposedName: 'Staged meeting follow-up',
          }),
          approvalGate: expect.stringContaining('Production activation'),
          guardrails: expect.arrayContaining([
            expect.stringContaining('without approval'),
          ]),
        }),
      }),
      idempotencyKey: 'n8n-workflow-proposal:request_activation:wf_staged_123',
    }))
  })

  it('builds a governed MCP handoff packet for workflow builders', () => {
    const packet = buildN8nMcpHandoffPacket({
      action: 'stage_workflow',
      title: 'Stage warm lead workflow',
      objective: 'Create a staging-safe workflow.',
      workflowFamily: 'warm_lead_capture',
      automationGoalSeedId: 'warm-lead-review-ready-outreach',
      proposedWorkflowName: 'Warm lead review-ready outreach',
      trigger: 'Manual Agent Ops controller approval',
      requiredEnvVars: ['N8N_INGEST_SECRET'],
      credentialNeeds: ['Supabase API'],
      nodePlan: ['Webhook trigger', 'Dedupe lead', 'Create work item'],
      ingestCallbacks: ['/api/admin/agents/work-items'],
      testEvidence: 'Synthetic lead fixture pending.',
      rollbackPath: 'Delete inactive staging workflow.',
    })

    expect(packet).toMatchObject({
      version: 'agent-ops-n8n-mcp-handoff/v1',
      action: 'stage_workflow',
      workflowFamily: 'warm_lead_capture',
      automationGoalSeedId: 'warm-lead-review-ready-outreach',
      goalId: 'automation:warm-lead-review-ready-outreach',
      workflow: {
        proposedName: 'Warm lead review-ready outreach',
        existingWorkflowId: null,
        trigger: 'Manual Agent Ops controller approval',
        nodePlan: ['Webhook trigger', 'Dedupe lead', 'Create work item'],
      },
      requirements: {
        requiredEnvVars: ['N8N_INGEST_SECRET'],
        credentialNeeds: ['Supabase API'],
        ingestCallbacks: ['/api/admin/agents/work-items'],
        testEvidence: 'Synthetic lead fixture pending.',
      },
      rollbackPath: 'Delete inactive staging workflow.',
    })
    expect(packet.guardrails.join(' ')).toContain('Do not send outbound email')
    expect(packet.handoffInstructions.join(' ')).toContain('Return the n8n workflow id')
  })

  it('rejects malformed proposals', async () => {
    await expect(createN8nWorkflowProposal({
      action: 'inspect_workflow',
      title: '',
      objective: 'Missing title.',
    })).rejects.toThrow('title and objective are required')
  })
})
