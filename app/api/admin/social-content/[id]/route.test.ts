import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
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

import { PUT } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/admin/social-content/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.single.mockResolvedValue({
      data: { id: 'social-1', rag_context: { source: 'agent_ops_social_outreach_goal' } },
      error: null,
    })
    mocks.select.mockReturnValue({ single: mocks.single })
    mocks.eq.mockReturnValue({ select: mocks.select })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ update: mocks.update })
  })

  it('allows Agent Ops calibration feedback to be saved in rag_context', async () => {
    const ragContext = {
      source: 'agent_ops_social_outreach_goal',
      content_calibration: {
        status: 'ready_for_draft_review',
        operator_feedback: {
          prior_post_excerpt: 'A prior post about practical AI adoption.',
          success_examples: [
            {
              source_label: 'LinkedIn post about practical AI adoption',
              post_excerpt: 'A small business owner does not need another dashboard.',
              engagement_signal: 'Strong comments from operators.',
              why_it_worked: 'It opened with a concrete operating burden.',
            },
          ],
          engagement_signal: 'Strong comments from operators.',
          audience_context: 'Small business owners carrying operational load.',
          revision_request: 'Make the hook more concrete.',
          claim_boundaries: 'Do not mention private client data.',
          updated_at: '2026-05-28T04:30:00.000Z',
        },
      },
    }

    const response = await PUT(request({ rag_context: ragContext, unknown: 'ignored' }) as never, {
      params: { id: 'social-1' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      item: { id: 'social-1', rag_context: { source: 'agent_ops_social_outreach_goal' } },
    })
    expect(mocks.from).toHaveBeenCalledWith('social_content_queue')
    expect(mocks.update).toHaveBeenCalledWith({ rag_context: ragContext })
    expect(mocks.eq).toHaveBeenCalledWith('id', 'social-1')
  })

  it('still rejects empty update payloads', async () => {
    const response = await PUT(request({ unknown: 'ignored' }) as never, {
      params: { id: 'social-1' },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No valid fields to update' })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
