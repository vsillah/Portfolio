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
  return new NextRequest('http://localhost/api/admin/social-content/social-1/create-linkedin-draft', {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token' },
  })
}

const readyProductionAssets = {
  version: 'social_production_assets_v2',
  status: 'review_ready',
  generated_at: '2026-06-18T10:00:00.000Z',
  source: 'social_content_asset_packet',
  approval_boundary: 'Review only.',
  references: { open_brain: ['memory-1'], public_sources: [], placement_guidance: [] },
  chronicle_evidence: { ingestion_mode: 'direct_scoped_review', scope: { approved: true, source: 'test', window_label: 'test' }, proposals: [], boundary: 'Review only.' },
  illustration: { status: 'prompt_ready', image_prompt: 'Prompt', framework_visual_type: 'architecture' },
  app_screenshot_carousel: { status: 'ready', routes: [], existing_asset_count: 1 },
  broll: { status: 'missing', hints: [], assets: [] },
  video_script: { status: 'draft_ready', title: 'Video', script_text: 'Script', broll_hints: [] },
  video_redaction_manifest: {
    policy: 'hard_gate_auto_blur_first',
    status: 'ready',
    items: [],
    unresolved_count: 0,
    generated_at: '2026-06-18T10:00:00.000Z',
    reviewer_required: true,
    publish_blocker: null,
  },
  visual_qa: { status: 'required', checklist: [] },
}

const baseItem = {
  id: 'social-1',
  status: 'approved',
  post_text: 'Approved copy.',
  cta_text: 'Build with receipts.',
  cta_url: null,
  hashtags: ['AgentOps'],
  image_url: 'https://example.com/image.png',
  content_format: 'single_image',
  carousel_slide_urls: null,
  carousel_pdf_url: null,
  rag_context: {
    source: 'agent_ops_social_outreach_goal',
    publish_gate: 'draft_only',
    goal_id: 'goal-1',
    content_packet_id: 'packet-1',
    production_assets: readyProductionAssets,
  },
}

describe('POST /api/admin/social-content/[id]/create-linkedin-draft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      title: 'Create LinkedIn draft from approved Social Content packet',
      status: 'assigned',
      owner_agent_key: 'content-repurposing',
    })
    mocks.queueSingle.mockResolvedValue({ data: baseItem, error: null })
    mocks.queueUpdateSingle.mockImplementation(async () => ({
      data: {
        ...baseItem,
        rag_context: {
          ...baseItem.rag_context,
          linkedin_draft_handoff: { status: 'ready_for_linkedin_draft' },
        },
      },
      error: null,
    }))
    mocks.queueEq.mockReturnValue({ single: mocks.queueSingle })
    mocks.queueSelect.mockReturnValue({ eq: mocks.queueEq })
    mocks.queueUpdateSelect.mockReturnValue({ single: mocks.queueUpdateSingle })
    mocks.queueUpdateEq.mockReturnValue({ select: mocks.queueUpdateSelect })
    mocks.queueUpdate.mockReturnValue({ eq: mocks.queueUpdateEq })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'social_content_queue') throw new Error(`Unexpected table: ${table}`)
      return {
        select: mocks.queueSelect,
        update: mocks.queueUpdate,
      }
    })
  })

  it('blocks draft handoff until required packet inputs are ready', async () => {
    mocks.queueSingle.mockResolvedValueOnce({
      data: {
        ...baseItem,
        image_url: null,
        rag_context: {
          ...baseItem.rag_context,
          production_assets: undefined,
        },
      },
      error: null,
    })

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
    const json = await response.json()
    expect(json.blockers).toEqual([
      'Choose and generate a visual asset first.',
      'Prepare the asset packet first.',
    ])
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.queueUpdate).not.toHaveBeenCalled()
  })

  it('creates an internal LinkedIn draft handoff without publishing externally', async () => {
    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.linkedin_draft_handoff).toEqual(expect.objectContaining({
      version: 'linkedin_draft_handoff_v1',
      status: 'ready_for_linkedin_draft',
      platform: 'linkedin',
      external_account_draft_created: false,
      delivery_boundary: expect.stringContaining('does not publish'),
      full_post_text: expect.stringContaining('Approved copy.'),
      visual_asset: { type: 'single_image', image_url: 'https://example.com/image.png' },
    }))
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Create LinkedIn draft from approved Social Content packet',
      ownerAgentKey: 'content-repurposing',
      idempotencyKey: 'social-content-linkedin-draft-handoff:social-1',
      metadata: expect.objectContaining({
        approval_boundary: 'draft_handoff_only_no_external_publish',
      }),
    }))
    expect(mocks.queueUpdate).toHaveBeenCalledWith({
      rag_context: expect.objectContaining({
        linkedin_draft_handoff: expect.objectContaining({
          status: 'ready_for_linkedin_draft',
        }),
      }),
    })
  })
})
