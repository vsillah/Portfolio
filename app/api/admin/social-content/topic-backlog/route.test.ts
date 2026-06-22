import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  selectLimit: vi.fn(),
  updateSingle: vi.fn(),
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

import { GET, PATCH, POST } from './route'

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
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: 'topic-1',
          title: 'Approval gates create trust',
          status: 'available',
        },
      ],
    })
  })

  it('requires admin auth before listing entries', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/topic-backlog'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
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
        id: 'topic-1',
        content_id: 'social-1',
        status: 'selected',
      }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      item: {
        id: 'topic-1',
        status: 'selected',
        selected_for_content_id: 'social-1',
      },
    })
  })
})
