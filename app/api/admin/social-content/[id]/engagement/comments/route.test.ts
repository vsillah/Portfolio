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
  publish_id: 'publish-1',
  content_id: 'social-1',
  platform: 'linkedin',
  provider: 'linkedin_organization',
  provider_comment_id: 'urn:li:comment:1',
  provider_parent_comment_id: null,
  thread_id: 'thread-1',
  record_type: 'comment',
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
  reply_provider_comment_id: null,
  reply_submitted_at: null,
  provider_capability: {
    capability_status: 'manual',
    supports_reply_submission: false,
    external_submission_enabled: false,
    gate_notes: 'Manual LinkedIn handling required.',
  },
  captured_at: '2026-08-06T12:00:00.000Z',
  updated_at: '2026-08-06T12:00:00.000Z',
  raw_payload: {},
  metadata: {
    policy_decision: { classification: 'buying_lead_intent' },
    ui_action_history: [],
  },
}

const youtubeCommentRow = {
  ...commentRow,
  platform: 'youtube',
  provider: 'youtube_data_api',
  provider_comment_id: 'UgzcTopLevel1',
  comment_url: 'https://www.youtube.com/watch?v=abc123DEF45&lc=UgzcTopLevel1',
  provider_capability: {
    capability_status: 'verified',
    supports_reply_submission: true,
    external_submission_enabled: true,
    gate_notes: 'YouTube reply capability verified in a later smoke.',
  },
  approved_reply_text: 'Appreciate you watching. The short answer is yes.',
  raw_payload: {
    thread: {
      snippet: {
        channelId: 'channel-1',
      },
    },
  },
  metadata: {
    policy_decision: {
      classification: 'low_risk_acknowledgement',
      provenance_summary: 'No private source claims are introduced.',
      source_distance_note: 'Original public-safe reply.',
      auto_send: { blocked_reasons: [] },
    },
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

function installDbMocks(options: {
  comment?: typeof commentRow
  claimData?: Record<string, unknown> | null
} = {}) {
  const selectedComment = options.comment ?? commentRow
  const postSingle = vi.fn().mockResolvedValue({ data: postRow, error: null })
  const postEq = vi.fn().mockReturnValue({ single: postSingle })
  const postSelect = vi.fn().mockReturnValue({ eq: postEq })

  const commentsOrder = vi.fn().mockResolvedValue({ data: [selectedComment], error: null })
  const commentsByContentEq = vi.fn().mockReturnValue({ order: commentsOrder })
  const commentSingle = vi.fn().mockResolvedValue({ data: selectedComment, error: null })
  const commentByIdEq = vi.fn().mockReturnValue({ single: commentSingle })
  const commentByContentEq = vi.fn().mockReturnValue({ eq: commentByIdEq, order: commentsOrder })
  const commentsSelect = vi.fn().mockReturnValue({ eq: commentByContentEq })

  const updateSingle = vi.fn().mockResolvedValue({ data: { ...selectedComment, ...mocks.update.mock.calls.at(-1)?.[0] }, error: null })
  const claimMaybeSingle = vi.fn().mockResolvedValue({
    data: options.claimData === undefined ? { id: selectedComment.id } : options.claimData,
    error: null,
  })
  const updateBuilder: Record<string, unknown> = {
    eq: vi.fn(() => updateBuilder),
    is: vi.fn(() => updateBuilder),
    select: vi.fn(() => updateBuilder),
    single: updateSingle,
    maybeSingle: claimMaybeSingle,
  }
  mocks.update.mockReturnValue(updateBuilder)

  const configMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      is_active: true,
      credentials: {
        access_token: 'youtube-access-token',
        refresh_token: 'youtube-refresh-token',
        expires_in: 3600,
        token_obtained_at: '2099-01-01T00:00:00.000Z',
        scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
      },
      settings: { channel_id: 'channel-1' },
    },
    error: null,
  })
  const configEq = vi.fn().mockReturnValue({ maybeSingle: configMaybeSingle })
  const configSelect = vi.fn().mockReturnValue({ eq: configEq })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_queue') return { select: postSelect }
    if (table === 'social_content_comments') return { select: commentsSelect, update: mocks.update }
    if (table === 'social_content_config') return { select: configSelect }
    throw new Error(`Unexpected table ${table}`)
  })
}

describe('/api/admin/social-content/[id]/engagement/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
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

  it('blocks disabled YouTube reply readiness without external provider calls', async () => {
    installDbMocks({ comment: youtubeCommentRow })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

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
    expect(body.message).toContain('YouTube reply submission is disabled by environment')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      reply_submission_state: 'blocked',
      metadata: expect.objectContaining({
        youtube_reply_readiness: expect.objectContaining({
          status: 'blocked',
          blocked: true,
          external_submission_attempted: false,
          blocker_codes: expect.arrayContaining(['youtube_reply_submission_disabled']),
        }),
        ui_action_history: expect.arrayContaining([
          expect.objectContaining({ action: 'submit_blocked' }),
        ]),
      }),
    }))
    expect(mocks.update.mock.calls.at(-1)?.[0]).not.toHaveProperty('reply_provider_comment_id')
    expect(mocks.update.mock.calls.at(-1)?.[0]).not.toHaveProperty('reply_submitted_at')
  })

  it('blocks duplicate YouTube reply claims before provider calls', async () => {
    installDbMocks({ comment: youtubeCommentRow, claimData: null })
    vi.stubEnv('SOCIAL_COMMENT_YOUTUBE_REPLY_SUBMISSION_ENABLED', 'true')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

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
    expect(body.message).toContain('already has reply submission evidence')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      reply_submission_state: 'blocked',
      metadata: expect.objectContaining({
        youtube_reply_readiness: expect.objectContaining({
          status: 'claiming',
          blocked: false,
          external_submission_attempted: false,
        }),
      }),
    })
    expect(mocks.update.mock.calls.at(-1)?.[0]).toMatchObject({
      reply_submission_state: 'blocked',
      metadata: expect.objectContaining({
        youtube_reply_readiness: expect.objectContaining({
          status: 'blocked',
          blocker_codes: expect.arrayContaining(['reply_already_submitted']),
          external_submission_attempted: false,
        }),
      }),
    })
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
