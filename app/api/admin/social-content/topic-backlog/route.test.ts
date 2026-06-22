import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  selectLimit: vi.fn(),
  updateSingle: vi.fn(),
  getAgentWorkItem: vi.fn(),
  listAgentWorkItems: vi.fn(),
  updateAgentWorkItemMetadata: vi.fn(),
  runSocialTopicBacklogDiscovery: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/social-topic-backlog', () => ({
  runSocialTopicBacklogDiscovery: mocks.runSocialTopicBacklogDiscovery,
}))

vi.mock('@/lib/agent-work-items', () => ({
  getAgentWorkItem: mocks.getAgentWorkItem,
  listAgentWorkItems: mocks.listAgentWorkItems,
  updateAgentWorkItemMetadata: mocks.updateAgentWorkItemMetadata,
}))

import { GET, PATCH, POST } from './route'

const centralWorkItem = {
  id: 'work-topic-1',
  title: 'Approval gates create trust',
  objective: 'Make the case for governed AI work.',
  status: 'proposed',
  priority: 'high',
  owner_agent_key: 'chief-of-staff',
  owner_runtime: 'codex',
  source_type: 'social_topic_trigger',
  source_id: 'approval-gates-create-trust',
  source_label: 'Shaka topic trigger',
  source_run_id: null,
  active_run_id: null,
  parent_work_item_id: null,
  branch_name: null,
  worktree_path: null,
  pr_number: null,
  pr_url: null,
  expected_files: [],
  touched_files: [],
  overlap_group: null,
  dependency_ids: [],
  blocker_summary: null,
  validation_summary: null,
  approval_id: null,
  metadata: {
    social_topic_trigger: true,
    channel_lanes: {
      linkedin: {
        status: 'not_started',
        label: 'LinkedIn',
        required_inputs: ['post text'],
      },
    },
    insight: {
      title: 'Approval gates create trust',
      triggering_event: 'A recent shipped feature made approval visible.',
      why_vambah_can_speak: 'Vambah shipped the feature.',
    },
  },
  idempotency_key: 'social-topic-trigger:approval-gates-create-trust',
  created_at: '2026-06-22T12:00:00.000Z',
  updated_at: '2026-06-22T12:00:00.000Z',
  completed_at: null,
}

describe('/api/admin/social-content/topic-backlog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.selectLimit.mockResolvedValue({
      data: [
        {
          id: 'topic-1',
          title: 'Approval gates create trust',
          status: 'available',
        },
      ],
      error: null,
    })
    mocks.updateSingle.mockResolvedValue({
      data: {
        id: 'topic-1',
        status: 'selected',
        selected_for_content_id: 'social-1',
      },
      error: null,
    })
    mocks.runSocialTopicBacklogDiscovery.mockResolvedValue({
      backlogItems: [{ id: 'topic-1' }],
      sourceCounts: { meeting: 1 },
      packet: { candidates: [{ id: 'topic-1' }] },
    })
    mocks.listAgentWorkItems.mockResolvedValue([centralWorkItem])
    mocks.getAgentWorkItem.mockResolvedValue(centralWorkItem)
    mocks.updateAgentWorkItemMetadata.mockResolvedValue({
      ...centralWorkItem,
      metadata: {
        ...centralWorkItem.metadata,
        channel_lanes: {
          linkedin: {
            status: 'selected',
            label: 'LinkedIn',
            selected_for_content_id: 'social-1',
            required_inputs: ['post text'],
          },
        },
      },
    })
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: mocks.selectLimit,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mocks.updateSingle,
          })),
        })),
      })),
    })
  })

  it('lists available Shaka topic backlog entries', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/topic-backlog'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      source: 'agent_work_items',
      items: [
        {
          id: 'work-topic-1',
          title: 'Approval gates create trust',
          status: 'available',
        },
      ],
    })
    expect(mocks.listAgentWorkItems).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: 'social_topic_trigger',
    }))
  })

  it('requires admin auth before listing entries', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/topic-backlog'))

    expect(response.status).toBe(401)
    expect(mocks.listAgentWorkItems).not.toHaveBeenCalled()
  })

  it('runs a manual backlog refresh without publish side effects', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/topic-backlog', {
      method: 'POST',
    }))

    expect(response.status).toBe(200)
    expect(mocks.runSocialTopicBacklogDiscovery).toHaveBeenCalledWith({
      actorId: 'admin-1',
      triggerSource: 'manual_admin_social_topic_backlog',
    })
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      candidate_count: 1,
      side_effects: {
        provider_generation: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  })

  it('marks a backlog topic selected for a Social Content draft', async () => {
    const response = await PATCH(new NextRequest('http://localhost/api/admin/social-content/topic-backlog', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'work-topic-1',
        content_id: 'social-1',
        status: 'selected',
      }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      source: 'agent_work_items',
      item: {
        id: 'work-topic-1',
        status: 'selected',
      },
    })
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-topic-1',
      metadata: expect.objectContaining({
        selected_for_social_content_id: 'social-1',
      }),
    }))
  })
})
