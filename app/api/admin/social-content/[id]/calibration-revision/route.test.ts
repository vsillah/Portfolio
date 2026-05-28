import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  generateJsonCompletion: vi.fn(),
  getSocialCopywritingPrompt: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  updateSelect: vi.fn(),
  updateSingle: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/llm-dispatch', () => ({
  generateJsonCompletion: mocks.generateJsonCompletion,
}))

vi.mock('@/lib/system-prompts', () => ({
  getSocialCopywritingPrompt: mocks.getSocialCopywritingPrompt,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function request(body: unknown = {}) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/calibration-revision', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const agentOpsRagContext = {
  source: 'agent_ops_social_outreach_goal',
  goal_id: 'goal-1',
  content_packet_id: 'packet-1',
  publish_gate: 'draft_only',
  content_calibration: {
    status: 'ready_for_draft_review',
    voice_principles: ['Start from a real operational tension.'],
    prior_success_patterns: [
      {
        label: 'Dogfooding post',
        pattern: 'Show the work before naming the product claim.',
        why_it_worked: 'It felt specific.',
        reuse_guidance: 'Lead with the workflow.',
      },
    ],
    operator_feedback: {
      prior_post_excerpt: 'A previous post about practical AI adoption.',
      engagement_signal: 'Strong comments from operators.',
      audience_context: 'Small business owners carrying operational load.',
      revision_request: 'Make the hook more concrete.',
      claim_boundaries: 'No private client details.',
      updated_at: '2026-05-28T04:30:00.000Z',
    },
  },
}

describe('POST /api/admin/social-content/[id]/calibration-revision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getSocialCopywritingPrompt.mockResolvedValue('Write in Vambah voice.')
    mocks.generateJsonCompletion.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4o-mini',
      content: JSON.stringify({
        post_text: 'A small business owner does not need another AI demo. They need the work to get lighter.',
        cta_text: 'Where is AI still adding work instead of removing it?',
        hashtags: ['#AIProduct', 'ProductManagement'],
        image_prompt: 'A mission-control style operating board.',
        revision_notes: ['Reworked the hook around a concrete operator tension.'],
      }),
    })
    mocks.single.mockResolvedValue({
      data: {
        id: 'social-1',
        status: 'draft',
        post_text: 'Original draft',
        cta_text: 'Original CTA',
        hashtags: ['#AI'],
        image_prompt: 'Original image prompt',
        topic_extracted: { topic: 'AI adoption' },
        hormozi_framework: { framework_type: 'proof_stacking' },
        rag_context: agentOpsRagContext,
        admin_notes: 'Existing notes',
      },
      error: null,
    })
    mocks.updateSingle.mockResolvedValue({
      data: {
        id: 'social-1',
        status: 'draft',
        post_text: 'A small business owner does not need another AI demo. They need the work to get lighter.',
        rag_context: {
          ...agentOpsRagContext,
          content_calibration: {
            ...agentOpsRagContext.content_calibration,
            status: 'revision_generated',
          },
        },
      },
      error: null,
    })
    mocks.eq.mockReturnValue({ single: mocks.single })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.updateSelect.mockReturnValue({ single: mocks.updateSingle })
    mocks.updateEq.mockReturnValue({ select: mocks.updateSelect })
    mocks.update.mockReturnValue({ eq: mocks.updateEq })
    mocks.from.mockReturnValue({ select: mocks.select, update: mocks.update })
  })

  it('requires admin auth before reading content', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.generateJsonCompletion).not.toHaveBeenCalled()
  })

  it('generates a calibrated draft revision and keeps the item draft-only', async () => {
    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.item.id).toBe('social-1')
    expect(mocks.generateJsonCompletion).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-4o-mini',
      costContext: expect.objectContaining({
        reference: { type: 'social_content_queue', id: 'social-1' },
      }),
    }))
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'draft',
      post_text: expect.stringContaining('small business owner'),
      cta_text: 'Where is AI still adding work instead of removing it?',
      hashtags: ['#AIProduct', '#ProductManagement'],
      rag_context: expect.objectContaining({
        content_calibration: expect.objectContaining({
          status: 'revision_generated',
          revision_history: expect.any(Array),
        }),
      }),
    }))
  })

  it('accepts unsaved operator feedback in the request body', async () => {
    const response = await POST(request({
      operator_feedback: {
        prior_post_excerpt: 'A stronger sample post.',
        revision_request: 'Add more lived operator detail.',
      },
    }), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      rag_context: expect.objectContaining({
        content_calibration: expect.objectContaining({
          operator_feedback: expect.objectContaining({
            prior_post_excerpt: 'A stronger sample post.',
            revision_request: 'Add more lived operator detail.',
          }),
        }),
      }),
    }))
  })

  it('blocks revision when no operator feedback exists', async () => {
    mocks.single.mockResolvedValueOnce({
      data: {
        id: 'social-1',
        status: 'draft',
        post_text: 'Original draft',
        cta_text: null,
        hashtags: [],
        image_prompt: null,
        topic_extracted: {},
        hormozi_framework: {},
        rag_context: {
          source: 'agent_ops_social_outreach_goal',
          content_calibration: {},
        },
        admin_notes: null,
      },
      error: null,
    })

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Save operator feedback before generating a calibrated revision',
    })
    expect(mocks.generateJsonCompletion).not.toHaveBeenCalled()
  })
})
