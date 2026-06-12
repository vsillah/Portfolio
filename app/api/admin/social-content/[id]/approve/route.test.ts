import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  createAgentWorkItem: vi.fn(),
  queueSingle: vi.fn(),
  queueUpdateSingle: vi.fn(),
  queueSelect: vi.fn(),
  queueEq: vi.fn(),
  queueUpdate: vi.fn(),
  queueUpdateEq: vi.fn(),
  queueUpdateSelect: vi.fn(),
  publishesSelect: vi.fn(),
  publishesEq: vi.fn(),
  publishesUpsert: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/approve', {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token' },
  })
}

const agentOpsRagContext = {
  source: 'agent_ops_social_outreach_goal',
  goal_id: 'goal-1',
  goal_type: 'social_outreach_linkedin_post',
  content_packet_id: 'packet-1',
  publish_gate: 'draft_only',
  pass_to_human: true,
  challenger_status: 'passed',
}

describe('POST /api/admin/social-content/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createAgentWorkItem.mockImplementation(async (input) => ({
      id: `work-${input.metadata.production_lane}-1`,
      title: input.title,
      status: input.status,
      owner_agent_key: input.ownerAgentKey,
    }))
    mocks.queueSingle.mockResolvedValue({
      data: {
        id: 'social-1',
        status: 'draft',
        scheduled_for: null,
        target_platforms: ['linkedin'],
        rag_context: agentOpsRagContext,
      },
      error: null,
    })
    mocks.queueUpdateSingle.mockResolvedValue({
      data: {
        id: 'social-1',
        status: 'approved',
        scheduled_for: null,
        target_platforms: ['linkedin'],
        rag_context: agentOpsRagContext,
      },
      error: null,
    })
    mocks.queueEq.mockReturnValue({ single: mocks.queueSingle })
    mocks.queueSelect.mockReturnValue({ eq: mocks.queueEq })
    mocks.queueUpdateSelect.mockReturnValue({ single: mocks.queueUpdateSingle })
    mocks.queueUpdateEq.mockReturnValue({ select: mocks.queueUpdateSelect })
    mocks.queueUpdate.mockReturnValue({ eq: mocks.queueUpdateEq })
    mocks.publishesEq.mockResolvedValue({ data: [], error: null })
    mocks.publishesSelect.mockReturnValue({ eq: mocks.publishesEq })
    mocks.publishesUpsert.mockResolvedValue({ error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'social_content_queue') {
        return {
          select: mocks.queueSelect,
          update: mocks.queueUpdate,
        }
      }
      if (table === 'social_content_publishes') {
        return {
          select: mocks.publishesSelect,
          upsert: mocks.publishesUpsert,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })
  })

  it('blocks draft-only Agent Ops content until challenger clearance passes', async () => {
    mocks.queueSingle.mockResolvedValueOnce({
      data: {
        id: 'social-1',
        status: 'draft',
        rag_context: {
          ...agentOpsRagContext,
          pass_to_human: false,
          current_gate: 'challenger_qa',
          challenger_status: 'pending',
        },
      },
      error: null,
    })

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Agent Ops content has not cleared challenger QA for human approval',
      current_gate: 'challenger_qa',
      challenger_status: 'pending',
    })
    expect(mocks.queueUpdate).not.toHaveBeenCalled()
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.publishesUpsert).not.toHaveBeenCalled()
  })

  it('approves cleared draft-only Agent Ops content by queuing production handoffs without publishing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.publish_triggered).toBe(false)
    expect(json.publishes).toEqual([])
    expect(json.reference_work_item).toEqual({
      id: 'work-references-1',
      title: 'Attach approved Social Content references',
      status: 'assigned',
      owner_agent_key: 'research-source-register',
      production_lane: 'references',
    })
    expect(json.production_work_items).toEqual([
      expect.objectContaining({
        title: 'Attach approved Social Content references',
        owner_agent_key: 'research-source-register',
        production_lane: 'references',
      }),
      expect.objectContaining({
        title: 'Prepare approved Social Content illustration brief',
        owner_agent_key: 'amadutown-brand',
        production_lane: 'illustration',
      }),
      expect.objectContaining({
        title: 'Prepare Social Content carousel production packet',
        owner_agent_key: 'content-repurposing',
        production_lane: 'carousel',
      }),
      expect.objectContaining({
        title: 'Run post-approval visual QA',
        owner_agent_key: 'risk-compliance-intelligence',
        production_lane: 'visual_qa',
      }),
    ])
    expect(mocks.queueUpdate).toHaveBeenCalledWith({
      status: 'approved',
      reviewed_by: 'admin-1',
    })
    expect(mocks.createAgentWorkItem).toHaveBeenCalledTimes(4)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Attach approved Social Content references',
      ownerAgentKey: 'research-source-register',
      status: 'assigned',
      idempotencyKey: 'social-content-reference-handoff:social-1',
      metadata: expect.objectContaining({
        social_content_id: 'social-1',
        publish_gate: 'draft_only',
        approval_boundary: 'post_approval_production_handoff_only',
        production_lane: 'references',
      }),
    }))
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Prepare approved Social Content illustration brief',
      ownerAgentKey: 'amadutown-brand',
      status: 'assigned',
      idempotencyKey: 'social-content-production-handoff:social-1:illustration',
      metadata: expect.objectContaining({
        social_content_id: 'social-1',
        publish_gate: 'draft_only',
        production_lane: 'illustration',
      }),
    }))
    expect(mocks.publishesUpsert).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
