import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  selectForLookup: vi.fn(),
  contains: vi.fn(),
  insert: vi.fn(),
  selectAfterInsert: vi.fn(),
  approveSocialContentItem: vi.fn(),
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

vi.mock('@/lib/social-content-approval', () => {
  class SocialContentApprovalError extends Error {
    status: number
    payload: Record<string, unknown>

    constructor(status: number, payload: Record<string, unknown>) {
      super(typeof payload.error === 'string' ? payload.error : 'Social content approval failed')
      this.status = status
      this.payload = payload
    }
  }

  return {
    approveSocialContentItem: mocks.approveSocialContentItem,
    SocialContentApprovalError,
  }
})

import { POST } from './route'

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/admin/social-content/launch-approvals', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function launchRow(id: string, assetId: string, status = 'draft') {
  return {
    id,
    status,
    rag_context: {
      source: 'agentic_sales_outreach_launch_draft',
      launch_draft_asset_id: assetId,
      publish_gate: 'draft_only',
      external_execution_enabled: false,
    },
  }
}

describe('POST /api/admin/social-content/launch-approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.contains.mockResolvedValue({ data: [], error: null })
    mocks.selectAfterInsert.mockResolvedValue({
      data: [launchRow('social-1', 'p0-linkedin-flagship-agentic-operating-system')],
      error: null,
    })
    mocks.approveSocialContentItem.mockResolvedValue({
      item: { status: 'approved' },
      publish_triggered: false,
      production_work_items: [{ id: 'work-1' }, { id: 'work-2' }],
    })
    mocks.selectForLookup.mockReturnValue({ contains: mocks.contains })
    mocks.insert.mockReturnValue({ select: mocks.selectAfterInsert })
    mocks.from.mockReturnValue({
      select: mocks.selectForLookup,
      insert: mocks.insert,
    })
  })

  it('requires admin auth before checking or writing launch drafts', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.approveSocialContentItem).not.toHaveBeenCalled()
  })

  it('seeds missing launch drafts and approves them through the internal approval helper', async () => {
    const response = await POST(makeRequest({
      asset_ids: ['p0-linkedin-flagship-agentic-operating-system'],
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      summary: { requested: 1, inserted: 1, existing: 0, approved: 1, failed: 0 },
      inserted: [{
        id: 'social-1',
        assetId: 'p0-linkedin-flagship-agentic-operating-system',
        href: '/admin/social-content/social-1',
      }],
      approved: [{
        id: 'social-1',
        assetId: 'p0-linkedin-flagship-agentic-operating-system',
        status: 'approved',
        productionWorkItemCount: 2,
        publishTriggered: false,
      }],
      remainingExternalGates: [
        'schedule',
        'publish',
        'outbound_send',
        'visual_build',
        'provider_execution',
      ],
    })
    expect(mocks.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        platform: 'linkedin',
        status: 'draft',
        post_text: expect.stringContaining('Anyone can launch an agent now.'),
        rag_context: expect.objectContaining({
          source: 'agentic_sales_outreach_launch_draft',
          launch_draft_asset_id: 'p0-linkedin-flagship-agentic-operating-system',
          publish_gate: 'draft_only',
          external_execution_enabled: false,
        }),
      }),
    ])
    expect(mocks.approveSocialContentItem).toHaveBeenCalledWith({
      admin: expect.objectContaining({ from: mocks.from }),
      id: 'social-1',
      reviewedByUserId: 'admin-user-1',
    })
  })

  it('approves existing launch drafts without inserting duplicate rows', async () => {
    mocks.contains.mockResolvedValue({
      data: [launchRow('existing-social-1', 'p0-linkedin-flagship-agentic-operating-system')],
      error: null,
    })

    const response = await POST(makeRequest({
      asset_ids: ['p0-linkedin-flagship-agentic-operating-system'],
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      summary: { requested: 1, inserted: 0, existing: 1, approved: 1, failed: 0 },
      existing: [{
        id: 'existing-social-1',
        assetId: 'p0-linkedin-flagship-agentic-operating-system',
        href: '/admin/social-content/existing-social-1',
      }],
    })
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.approveSocialContentItem).toHaveBeenCalledWith(expect.objectContaining({
      id: 'existing-social-1',
    }))
  })

  it('rejects unknown or non-review-ready asset ids before writing rows', async () => {
    const response = await POST(makeRequest({ asset_ids: ['unknown-asset'] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Unknown or non-approvable launch draft asset id',
      invalidAssetIds: ['unknown-asset'],
    })
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.approveSocialContentItem).not.toHaveBeenCalled()
  })

  it('returns a partial result when one approval fails', async () => {
    mocks.selectAfterInsert.mockResolvedValue({
      data: [
        launchRow('social-1', 'p0-linkedin-flagship-agentic-operating-system'),
        launchRow('social-2', 'p0-carousel-seven-things-after-agent-demo'),
      ],
      error: null,
    })
    mocks.approveSocialContentItem
      .mockResolvedValueOnce({
        item: { status: 'approved' },
        publish_triggered: false,
        production_work_items: [{ id: 'work-1' }],
      })
      .mockRejectedValueOnce(new Error('Approval failed'))

    const response = await POST(makeRequest({
      asset_ids: [
        'p0-linkedin-flagship-agentic-operating-system',
        'p0-carousel-seven-things-after-agent-demo',
      ],
    }))

    expect(response.status).toBe(207)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      summary: { requested: 2, inserted: 2, existing: 0, approved: 1, failed: 1 },
      approved: [{
        id: 'social-1',
        assetId: 'p0-linkedin-flagship-agentic-operating-system',
      }],
      failed: [{
        id: 'social-2',
        assetId: 'p0-carousel-seven-things-after-agent-demo',
        error: 'Failed to approve launch draft',
      }],
      remainingExternalGates: expect.arrayContaining(['publish', 'provider_execution']),
    })
  })
})
