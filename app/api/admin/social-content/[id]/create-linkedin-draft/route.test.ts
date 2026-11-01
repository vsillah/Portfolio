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
  rpc: vi.fn(),
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
    rpc: mocks.rpc,
  },
}))

import { POST as routePost } from './route'
import { withVersionedQueueMock, queueWriteScenario } from '@/lib/social-queue-write.test-fixtures'
const POST: typeof routePost = (...args) => withVersionedQueueMock(mocks.from, () => routePost(...args))

function request() {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/create-linkedin-draft', {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token' },
  })
}

function receiptRequest(expected = '2026-09-08T00:00:00Z', receiptId = 'e935496a-e026-494a-9ab2-c9ae78d56060') {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/create-linkedin-draft', {
    method: 'POST', headers: { authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ expected_content_updated_at: expected, privacy_decision_receipt_id: receiptId }),
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
    platform: 'linkedin',
    approval_boundary: 'human gated',
    pass_to_human: true,
    content_packet_id: 'packet-1',
    production_assets: readyProductionAssets,
    section_gate_reviews: {
      visual_assets: { status: 'approved' },
      asset_packet: { status: 'approved' },
      privacy: { status: 'approved' },
    },
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
    mocks.rpc.mockResolvedValue({ data: {
      handoff: { version: 'linkedin_draft_handoff_v2', privacy_decision_receipt_id: 'e935496a-e026-494a-9ab2-c9ae78d56060', external_account_draft_created: false },
      idempotent_replay: false,
    }, error: null })
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

  it('rejects out-of-order draft handoff when lifecycle prerequisites are missing', async () => {
    mocks.queueSingle.mockResolvedValueOnce({
      data: {
        ...baseItem,
        rag_context: {
          source: 'agent_ops_social_outreach_goal',
          publish_gate: 'draft_only',
          production_assets: readyProductionAssets,
        },
      },
      error: null,
    })

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
    const json = await response.json()
    expect(json).toEqual(expect.objectContaining({
      error: 'Social Content lifecycle prerequisite blocked.',
      lifecycle_step: 'draft',
      missing_prerequisite: 'context',
    }))
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.queueUpdate).not.toHaveBeenCalled()
  })

  it.each(['normal', 'locked', 'race'] as const)('creates an internal LinkedIn draft handoff without publishing externally (%s)', async mode => {
    queueWriteScenario.mode = mode
    const response = await POST(request(), { params: { id: 'social-1' } })

    if (mode !== 'normal') { expect(response.status).toBe(409); return }
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

  it('routes a current receipt-backed record through the atomic internal command', async () => {
    mocks.queueSingle.mockResolvedValue({ data: {
      ...baseItem, updated_at: '2026-09-08T00:00:00Z',
      rag_context: { current_gate: 'platform_submission', latest_internal_decision_receipt_id: 'e935496a-e026-494a-9ab2-c9ae78d56060' },
    }, error: null })
    const response = await POST(receiptRequest(), { params: { id: 'social-1' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, external_execution: false,
      linkedin_draft_handoff: { version: 'linkedin_draft_handoff_v2', external_account_draft_created: false } })
    expect(mocks.rpc).toHaveBeenCalledWith('create_receipt_backed_linkedin_handoff', {
      p_social_content_id: 'social-1', p_expected_content_updated_at: '2026-09-08T00:00:00Z',
      p_privacy_receipt_id: 'e935496a-e026-494a-9ab2-c9ae78d56060', p_actor_user_id: 'admin-1',
    })
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.queueUpdate).not.toHaveBeenCalled()
  })

  it('returns a conflict on a rejected immutable receipt and makes no other write', async () => {
    mocks.queueSingle.mockResolvedValue({ data: { ...baseItem, rag_context: { current_gate: 'platform_submission' } }, error: null })
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Approved visual hash or safe asset path mismatch' } })
    const response = await POST(receiptRequest(), { params: { id: 'social-1' } })
    expect(response.status).toBe(409)
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.queueUpdate).not.toHaveBeenCalled()
  })
})
