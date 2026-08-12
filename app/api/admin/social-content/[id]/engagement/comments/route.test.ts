import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET, POST } from './route'

const postRow = {
  id: 'social-1',
  platform: 'linkedin',
  post_text: 'Original post copy',
  cta_text: null,
  youtube_title: null,
  rag_context: {
    campaign_id: 'campaign-1',
    campaign_label: 'Launch campaign',
    planned_angle: 'Comment inbox launch',
  },
}

const commentRow = {
  id: 'comment-1',
  content_id: 'social-1',
  platform: 'linkedin',
  provider: 'linkedin_organization',
  provider_comment_id: 'urn:li:comment:1',
  author_display_name: 'Potential Client',
  author_public_handle: null,
  body: 'Can this help intake?',
  comment_url: 'https://linkedin.example/comment/1',
  classification_status: 'needs_response',
  classification_reason: 'Direct service question',
  priority: 'high',
  response_approval_state: 'approved',
  reply_submission_state: 'approved',
  proposed_reply_text: 'Yes.',
  approved_reply_text: 'Yes.',
  provider_capability: {
    capability_status: 'manual',
    supports_reply_submission: false,
    external_submission_enabled: false,
    gate_notes: 'Manual LinkedIn handling required.',
  },
  captured_at: '2026-08-06T12:00:00.000Z',
  updated_at: '2026-08-06T12:00:00.000Z',
  metadata: {
    policy_decision: { classification: 'buying_lead_intent' },
    ui_action_history: [],
  },
}

function request(body?: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/social-content/social-1/engagement/comments', {
    method: body ? 'POST' : 'GET',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function installDbMocks() {
  const postSingle = vi.fn().mockResolvedValue({ data: postRow, error: null })
  const postEq = vi.fn().mockReturnValue({ single: postSingle })
  const postSelect = vi.fn().mockReturnValue({ eq: postEq })

  const commentsOrder = vi.fn().mockResolvedValue({ data: [commentRow], error: null })
  const commentsByContentEq = vi.fn().mockReturnValue({ order: commentsOrder })
  const commentSingle = vi.fn().mockResolvedValue({ data: commentRow, error: null })
  const commentByIdEq = vi.fn().mockReturnValue({ single: commentSingle })
  const commentByContentEq = vi.fn().mockReturnValue({ eq: commentByIdEq, order: commentsOrder })
  const commentsSelect = vi.fn().mockReturnValue({ eq: commentByContentEq })

  const updateSingle = vi.fn().mockResolvedValue({ data: { ...commentRow, ...mocks.update.mock.calls.at(-1)?.[0] }, error: null })
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle })
  const updateContentEq = vi.fn().mockReturnValue({ select: updateSelect })
  const updateIdEq = vi.fn().mockReturnValue({ eq: updateContentEq })
  mocks.update.mockReturnValue({ eq: updateIdEq })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_queue') return { select: postSelect }
    if (table === 'social_content_comments') return { select: commentsSelect, update: mocks.update }
    throw new Error(`Unexpected table ${table}`)
  })
}

describe('/api/admin/social-content/[id]/engagement/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    installDbMocks()
  })

  it('returns the per-post canonical comment projection', async () => {
    const response = await GET(request() as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.comments[0]).toMatchObject({
      id: 'comment-1',
      socialContentId: 'social-1',
      authorDisplayName: 'Potential Client',
      approvalState: 'approved',
      providerCapability: {
        verified: false,
        automaticReply: false,
      },
    })
  })

  it('returns a blocked unavailable state when canonical storage is not migrated', async () => {
    const postSingle = vi.fn().mockResolvedValue({ data: postRow, error: null })
    const postEq = vi.fn().mockReturnValue({ single: postSingle })
    const postSelect = vi.fn().mockReturnValue({ eq: postEq })

    const commentsOrder = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST205',
        message: 'Could not find the table public.social_content_comments in the schema cache',
      },
    })
    const commentsEq = vi.fn().mockReturnValue({ order: commentsOrder })
    const commentsSelect = vi.fn().mockReturnValue({ eq: commentsEq })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'social_content_queue') return { select: postSelect }
      if (table === 'social_content_comments') return { select: commentsSelect, update: mocks.update }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await GET(request() as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      unavailable: true,
      blocked: true,
      comments: [],
      message: 'Comment inbox storage is not available in this environment.',
    })
    expect(body.recovery).toContain('migration 20260806163011')
  })

  it('blocks submit when provider capability and fail-closed policy are not satisfied', async () => {
    const response = await POST(request({
      action: 'submit',
      comment_id: 'comment-1',
    }) as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      ok: false,
      blocked: true,
    })
    expect(body.message).toContain('Provider capability is manual')
    expect(body.integration_note).toContain('No external comment reply was submitted')
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      reply_submission_state: 'blocked',
      metadata: expect.objectContaining({
        ui_action_history: expect.arrayContaining([
          expect.objectContaining({ action: 'submit_blocked' }),
        ]),
      }),
    }))
    expect(mocks.update.mock.calls.at(-1)?.[0]).not.toHaveProperty('reply_provider_comment_id')
    expect(mocks.update.mock.calls.at(-1)?.[0]).not.toHaveProperty('reply_submitted_at')
  })

  it('records approve decisions locally on workflow-owned fields', async () => {
    const response = await POST(request({
      action: 'approve',
      comment_id: 'comment-1',
      draft_reply: 'Reviewed reply.',
    }) as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.comments[0]).toMatchObject({
      approvalState: 'approved',
      status: 'lead',
    })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      proposed_reply_text: 'Reviewed reply.',
      approved_reply_text: 'Reviewed reply.',
      response_approval_state: 'approved',
      reply_submission_state: 'approved',
    }))
  })
})
