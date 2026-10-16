import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET, PUT } from './route'
import { channelExperimentSocialContentQaFixture } from '@/lib/social-channel-experiment-qa-fixture'
import { CHANNEL_EXPERIMENT_YOUTUBE_RECORD_IDS } from '@/lib/channel-experiment-review'

function persistedItem(id: string) {
  const item = channelExperimentSocialContentQaFixture(id)
  const packet = (item.rag_context as Record<string, unknown>).channel_experiment_review as Record<string, unknown>
  return {
    ...item,
    rag_context: {
      source: 'channel_experiment_review',
      research_packet_id: packet.packet_id,
      channel_experiment_variant_id: packet.variant_id,
      review_only: true,
      provider_actions_enabled: false,
      platform_draft_enabled: false,
      external_execution_enabled: false,
      publish_gate: 'draft_only',
    },
  }
}

describe('GET /api/admin/social-content/[id] persisted YouTube experiment projection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ single: mocks.single })
    mocks.from.mockReturnValue({ select: mocks.select })
  })

  it.each(CHANNEL_EXPERIMENT_YOUTUBE_RECORD_IDS)('returns authorized persisted row %s without a fixture or downstream provider reads', async (id) => {
    const item = persistedItem(id)
    mocks.single.mockResolvedValue({ data: item, error: null })

    const response = await GET(new NextRequest(`http://localhost/api/admin/social-content/${id}`) as never, { params: { id } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      item: { id, platform: 'youtube' },
      fixture: false,
      fixture_state: 'persisted_review_only_youtube_experiment',
    })
    expect(body.item.rag_context.qa_fixture).toBeUndefined()
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('social_content_queue')
  })

  it.each(CHANNEL_EXPERIMENT_YOUTUBE_RECORD_IDS)('rejects direct edits to persisted review-only row %s', async (id) => {
    mocks.single.mockResolvedValue({ data: persistedItem(id), error: null })

    const response = await PUT(new NextRequest(`http://localhost/api/admin/social-content/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ post_text: 'Attempted edit' }),
    }) as never, { params: { id } })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: 'This channel-native YouTube experiment is review-only.',
      blocked: true,
      persisted: false,
    })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
