import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  class SocialTopicCoverageError extends Error {
    coverageReport: { status: string; blockers: string[] }

    constructor(coverageReport: { status: string; blockers: string[] }) {
      super('relation secret_catalog is missing')
      this.name = 'SocialTopicCoverageError'
      this.coverageReport = coverageReport
    }
  }

  return {
    verifyAdmin: vi.fn(),
    isAuthError: vi.fn(),
    from: vi.fn(),
    selectLimit: vi.fn(),
    projectionSelectSingle: vi.fn(),
    updateSingle: vi.fn(),
    getAgentWorkItem: vi.fn(),
    listAgentWorkItems: vi.fn(),
    updateAgentWorkItemMetadata: vi.fn(),
    runSocialTopicBacklogDiscovery: vi.fn(),
    SocialTopicCoverageError,
  }
})

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
  SocialTopicCoverageError: mocks.SocialTopicCoverageError,
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
    source_receipts: [{ receipt_id: 'receipt-1', approval_status: 'approved' }],
    coverage_report: { status: 'ready', blockers: [] },
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
    mocks.projectionSelectSingle.mockResolvedValue({
      data: {
        id: 'topic-1',
        metadata: {
          source_receipts: [{ receipt_id: 'receipt-1', approval_status: 'approved' }],
          coverage_report: { status: 'ready', blockers: [] },
        },
      },
      error: null,
    })
    mocks.runSocialTopicBacklogDiscovery.mockResolvedValue({
      backlogItems: [{ id: 'topic-1' }],
      sourceCounts: { meeting: 1 },
      coverageReport: { status: 'ready', products: [] },
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
          single: mocks.projectionSelectSingle,
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

  it('blocks selection when source receipts or required product coverage are missing', async () => {
    mocks.getAgentWorkItem.mockResolvedValueOnce({
      ...centralWorkItem,
      metadata: {
        ...centralWorkItem.metadata,
        source_receipts: [],
        coverage_report: {
          status: 'blocked',
          blockers: ['[product_coverage_receipt_missing:agentified] Approve an Agentified summary.'],
        },
      },
    })

    const response = await PATCH(new NextRequest('http://localhost/api/admin/social-content/topic-backlog', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'work-topic-1', content_id: 'social-1', status: 'selected' }),
    }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('approved source receipts'),
      blockers: [expect.stringContaining('agentified')],
    })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('also blocks the legacy projection fallback when receipt evidence is missing', async () => {
    mocks.getAgentWorkItem.mockResolvedValueOnce(null)
    mocks.projectionSelectSingle.mockResolvedValueOnce({
      data: {
        id: 'topic-1',
        metadata: {
          source_receipts: [],
          coverage_report: {
            status: 'blocked',
            blockers: ['[approved_source_receipts_missing] Approve one sanitized source summary.'],
          },
        },
      },
      error: null,
    })

    const response = await PATCH(new NextRequest('http://localhost/api/admin/social-content/topic-backlog', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'topic-1', content_id: 'social-1', status: 'selected' }),
    }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      blockers: [expect.stringContaining('approved_source_receipts_missing')],
    })
    expect(mocks.updateSingle).not.toHaveBeenCalled()
  })

  it('returns the closed coverage gate for a manual refresh', async () => {
    mocks.runSocialTopicBacklogDiscovery.mockRejectedValueOnce(new mocks.SocialTopicCoverageError({
      status: 'blocked',
      blockers: ['[approved_source_receipts_missing] Approve one sanitized source summary.'],
    }))

    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/topic-backlog', {
      method: 'POST',
    }))

    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.error).toBe('Topic backlog refresh is blocked until the required approved source receipts are available.')
    expect(body.coverage_report.status).toBe('blocked')
    expect(JSON.stringify(body)).not.toContain('secret_catalog')
  })

  it.each([
    [{}, 'Topic backlog id is required'],
    [{ id: 'work-topic-1', status: 'published' }, 'Invalid topic backlog status'],
  ])('rejects an invalid topic selection before reading the work item %#', async (body, error) => {
    const response = await PATCH(new NextRequest('http://localhost/api/admin/social-content/topic-backlog', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error })
    expect(mocks.getAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('keeps a topic closed when the coverage report says ready but no receipt is attached', async () => {
    mocks.getAgentWorkItem.mockResolvedValueOnce({
      ...centralWorkItem,
      source_type: 'manual',
      metadata: {
        ...centralWorkItem.metadata,
        social_topic_trigger: true,
        source_receipts: [],
        coverage_report: { status: 'ready' },
      },
    })

    const response = await PATCH(new NextRequest('http://localhost/api/admin/social-content/topic-backlog', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'work-topic-1', content_id: 'social-1', status: 'selected' }),
    }))

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      blockers: ['Approved source receipts are missing.'],
    })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('does not mark a dismissed topic as a selected LinkedIn lane', async () => {
    const response = await PATCH(new NextRequest('http://localhost/api/admin/social-content/topic-backlog', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'work-topic-1', status: 'dismissed' }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        social_topic_backlog_status: 'dismissed',
        channel_lanes: expect.objectContaining({
          linkedin: expect.objectContaining({ status: 'not_started' }),
        }),
      }),
    }))
  })

  it('returns every lane status and the stored coverage report when the filter is all', async () => {
    const selected = {
      ...centralWorkItem,
      id: 'work-topic-2',
      metadata: {
        ...centralWorkItem.metadata,
        coverage_report: { status: 'ready', blockers: [] },
        channel_lanes: {
          linkedin: { status: 'selected', label: 'LinkedIn', required_inputs: ['post text'] },
        },
      },
    }
    mocks.listAgentWorkItems.mockResolvedValueOnce([centralWorkItem, selected])

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/topic-backlog?status=all&limit=0'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.items.map((item: { id: string; status: string }) => [item.id, item.status])).toEqual([
      ['work-topic-1', 'available'],
      ['work-topic-2', 'selected'],
    ])
    expect(body.coverage_report).toMatchObject({ status: 'ready' })
    expect(mocks.listAgentWorkItems).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }))
  })

  it('caps an oversized backlog page and reports a missing projection table without the database text', async () => {
    mocks.listAgentWorkItems.mockResolvedValueOnce([])
    mocks.selectLimit.mockResolvedValueOnce({
      data: null,
      error: { message: "Could not find the table 'public.social_topic_backlog' in the schema cache: secret_schema_detail" },
    })

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/topic-backlog?limit=100'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      items: [],
      unavailable: true,
      error: 'Social topic backlog migration has not been applied yet',
    })
    expect(JSON.stringify(body)).not.toContain('secret_schema_detail')
    expect(mocks.listAgentWorkItems).toHaveBeenCalledWith(expect.objectContaining({ limit: 24 }))
  })
})
