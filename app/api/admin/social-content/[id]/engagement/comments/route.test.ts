import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  configUpdate: vi.fn(),
  refreshPublishedXComments: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/x-comment-ingestion', () => ({
  refreshPublishedXComments: mocks.refreshPublishedXComments,
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

const currentCanonicalYouTubeCapability = {
  platform: 'youtube',
  provider: 'youtube_data_api',
  capability_status: 'manual',
  supports_reply_submission: false,
  external_submission_enabled: false,
  gate_notes: 'Current schema keeps external submission disabled.',
}

const futureCanonicalYouTubeCapability = {
  ...currentCanonicalYouTubeCapability,
  capability_status: 'verified',
  supports_reply_submission: true,
  external_submission_enabled: true,
}

const staleYouTubeConfig = {
  is_active: true,
  credentials: {
    access_token: 'expired-youtube-access-token',
    refresh_token: 'youtube-refresh-token',
    expires_in: 60,
    token_obtained_at: '2026-08-13T10:00:00.000Z',
    scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
  },
  settings: { channel_id: 'channel-1' },
}

const submittedYouTubeCommentRow = {
  ...youtubeCommentRow,
  reply_submission_state: 'submitted',
  reply_provider_comment_id: 'reply-existing',
  reply_submitted_at: '2026-08-13T12:10:00.000Z',
}

type TestCommentRow = Record<string, unknown> & { id: string; content_id: string }

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
  post?: Record<string, unknown>
  comment?: TestCommentRow
  config?: Record<string, unknown> | null
  configUpdateError?: Record<string, unknown> | null
  claimData?: Record<string, unknown> | null
  persistenceData?: Record<string, unknown> | null
  persistenceError?: Record<string, unknown> | null
  canonicalCapability?: Record<string, unknown> | null
} = {}) {
  const selectedComment = options.comment ?? commentRow
  const selectedPost = options.post ?? postRow
  const postSingle = vi.fn().mockResolvedValue({ data: selectedPost, error: null })
  const postEq = vi.fn().mockReturnValue({ single: postSingle })
  const postSelect = vi.fn().mockReturnValue({ eq: postEq })

  const commentsOrder = vi.fn().mockResolvedValue({ data: [selectedComment], error: null })
  const commentsByContentEq = vi.fn().mockReturnValue({ order: commentsOrder })
  const commentSingle = vi.fn().mockResolvedValue({ data: selectedComment, error: null })
  const commentByIdEq = vi.fn().mockReturnValue({ single: commentSingle })
  const commentByContentEq = vi.fn().mockReturnValue({ eq: commentByIdEq, order: commentsOrder })
  const commentsSelect = vi.fn().mockReturnValue({ eq: commentByContentEq })

  const updateSingle = vi.fn().mockResolvedValue({ data: { ...selectedComment, ...mocks.update.mock.calls.at(-1)?.[0] }, error: null })
  let hasContains = false
  const claimMaybeSingle = vi.fn().mockImplementation(() => {
    if (hasContains) {
      return Promise.resolve({
        data: options.persistenceData === undefined ? { id: selectedComment.id } : options.persistenceData,
        error: options.persistenceError ?? null,
      })
    }
    return Promise.resolve({
      data: options.claimData === undefined ? { id: selectedComment.id } : options.claimData,
      error: null,
    })
  })
  const updateBuilder: Record<string, unknown> = {
    eq: vi.fn(() => updateBuilder),
    is: vi.fn(() => updateBuilder),
    contains: vi.fn(() => {
      hasContains = true
      return updateBuilder
    }),
    select: vi.fn(() => updateBuilder),
    single: updateSingle,
    maybeSingle: claimMaybeSingle,
  }
  mocks.update.mockReturnValue(updateBuilder)

  const configMaybeSingle = vi.fn().mockResolvedValue({
    data: options.config === undefined ? {
      is_active: true,
      credentials: {
        access_token: 'youtube-access-token',
        refresh_token: 'youtube-refresh-token',
        expires_in: 3600,
        token_obtained_at: '2099-01-01T00:00:00.000Z',
        scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
      },
      settings: { channel_id: 'channel-1' },
    } : options.config,
    error: null,
  })
  const configEq = vi.fn().mockReturnValue({ maybeSingle: configMaybeSingle })
  const configSelect = vi.fn().mockReturnValue({ eq: configEq })
  const configUpdateEq = vi.fn().mockResolvedValue({ data: null, error: options.configUpdateError ?? null })
  mocks.configUpdate.mockReturnValue({ eq: configUpdateEq })

  const capabilityMaybeSingle = vi.fn().mockResolvedValue({
    data: options.canonicalCapability === undefined ? currentCanonicalYouTubeCapability : options.canonicalCapability,
    error: null,
  })
  const capabilityEq = vi.fn().mockReturnValue({ maybeSingle: capabilityMaybeSingle })
  const capabilitySelect = vi.fn().mockReturnValue({ eq: capabilityEq })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_queue') return { select: postSelect }
    if (table === 'social_content_comments') return { select: commentsSelect, update: mocks.update }
    if (table === 'social_content_config') return { select: configSelect, update: mocks.configUpdate }
    if (table === 'social_comment_provider_capabilities') return { select: capabilitySelect }
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
    mocks.refreshPublishedXComments.mockResolvedValue({
      platform: 'x',
      provider: 'x_api',
      status: 'manual_blocked',
      publishId: '11111111-1111-4111-8111-111111111111',
      contentId: 'social-1',
      postId: '2085056671248765116',
      runId: 'run-x-1',
      fetched: 0,
      upserted: 0,
      skipped: 0,
      errors: [{
        code: 'x_comment_ingestion_capability_blocked',
        message: 'Canonical X comment ingestion capability is not verified or enabled; complete a read-only X scope smoke before refreshing comments.',
      }],
      cursor: {},
      blockedReason: 'Canonical X comment ingestion capability is not verified or enabled; complete a read-only X scope smoke before refreshing comments.',
    })
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

  it('does not run X refresh without admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({
      action: 'refresh_request',
      platform: 'x',
      publish_id: '11111111-1111-4111-8111-111111111111',
    }) as never, { params: { id: 'social-1' } })

    expect(response.status).toBe(401)
    expect(mocks.refreshPublishedXComments).not.toHaveBeenCalled()
  })

  it('requires an explicit selected X publish row before provider refresh', async () => {
    const response = await POST(request({
      action: 'refresh_request',
      platform: 'x',
    }) as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({
      ok: false,
      blocked: true,
      error: 'publish_id is required for X comment refresh',
      integration_note: 'No X provider read or external comment reply was attempted.',
    })
    expect(mocks.refreshPublishedXComments).not.toHaveBeenCalled()
  })

  it('invokes read-only X refresh only for explicit selected refresh requests', async () => {
    installDbMocks({
      post: {
        ...postRow,
        platform: 'x',
      },
    })
    mocks.refreshPublishedXComments.mockResolvedValueOnce({
      platform: 'x',
      provider: 'x_api',
      status: 'succeeded',
      publishId: '11111111-1111-4111-8111-111111111111',
      contentId: 'social-1',
      postId: '2085056671248765116',
      runId: 'run-x-1',
      fetched: 1,
      upserted: 1,
      skipped: 0,
      errors: [],
      cursor: { pages: 1 },
    })

    const response = await POST(request({
      action: 'refresh_request',
      platform: 'x',
      publish_id: '11111111-1111-4111-8111-111111111111',
    }) as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.refreshPublishedXComments).toHaveBeenCalledWith({
      db: expect.anything(),
      publishId: '11111111-1111-4111-8111-111111111111',
      contentId: 'social-1',
    })
    expect(body).toMatchObject({
      ok: true,
      blocked: false,
      message: 'X comments refreshed into the canonical Comment Inbox.',
      x_refresh: {
        status: 'succeeded',
        fetched: 1,
        upserted: 1,
      },
    })
    expect(body.integration_note).toContain('read-only recent-search GET requests only')
    expect(body.integration_note).toContain('No external comment reply')
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

  it('generates a visible local draft when draft response is requested without textarea copy', async () => {
    installDbMocks({
      comment: {
        ...commentRow,
        proposed_reply_text: null,
        approved_reply_text: null,
        response_approval_state: 'not_required',
        reply_submission_state: 'not_applicable',
      },
    })

    const response = await POST(request({
      action: 'draft_response',
      comment_id: 'comment-1',
      draft_reply: '',
    }) as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.comments[0]).toMatchObject({ id: 'comment-1' })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      proposed_reply_text: expect.stringMatching(/\S/),
      response_approval_state: 'pending',
      reply_submission_state: 'draft',
    }))
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
    expect(body.message).toContain('Canonical YouTube external submission is disabled')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      reply_submission_state: 'blocked',
      metadata: expect.objectContaining({
        youtube_reply_readiness: expect.objectContaining({
          status: 'blocked',
          blocked: true,
          external_submission_attempted: false,
          blocker_codes: expect.arrayContaining([
            'youtube_reply_submission_disabled',
            'canonical_external_submission_disabled',
          ]),
        }),
        ui_action_history: expect.arrayContaining([
          expect.objectContaining({ action: 'submit_blocked' }),
        ]),
      }),
    }))
    expect(mocks.update.mock.calls.at(-1)?.[0]).not.toHaveProperty('reply_provider_comment_id')
    expect(mocks.update.mock.calls.at(-1)?.[0]).not.toHaveProperty('reply_submitted_at')
  })

  it('lets only the claimant persist submitted evidence while a stale concurrent request exits without overwrite', async () => {
    installDbMocks({
      comment: youtubeCommentRow,
      claimData: { id: 'comment-1' },
      persistenceData: { id: 'comment-1' },
      canonicalCapability: futureCanonicalYouTubeCapability,
    })
    vi.stubEnv('SOCIAL_COMMENT_YOUTUBE_REPLY_SUBMISSION_ENABLED', 'true')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'reply-1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const winner = await POST(request({
      action: 'submit',
      comment_id: 'comment-1',
    }) as never, { params: { id: 'social-1' } })
    const winnerBody = await winner.json()

    expect(winner.status).toBe(200)
    expect(winnerBody).toMatchObject({
      ok: true,
      blocked: false,
      integration_note: 'A gated YouTube reply was submitted and canonical submitted evidence was recorded.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.update.mock.calls.at(-1)?.[0]).toMatchObject({
      reply_submission_state: 'submitted',
      reply_provider_comment_id: 'reply-1',
    })

    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    installDbMocks({
      comment: youtubeCommentRow,
      claimData: null,
      canonicalCapability: futureCanonicalYouTubeCapability,
    })
    fetchMock.mockClear()

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
    expect(mocks.update).toHaveBeenCalledTimes(1)
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
    expect(body.integration_note).toContain('did not mutate reply evidence')
  })

  it('refreshes stale YouTube credentials before a gated reply and blocks duplicate attempts before provider calls', async () => {
    installDbMocks({
      comment: youtubeCommentRow,
      config: staleYouTubeConfig,
      claimData: { id: 'comment-1' },
      persistenceData: { id: 'comment-1' },
      canonicalCapability: futureCanonicalYouTubeCapability,
    })
    vi.stubEnv('SOCIAL_COMMENT_YOUTUBE_REPLY_SUBMISSION_ENABLED', 'true')
    vi.stubEnv('YOUTUBE_CLIENT_ID', 'client-id')
    vi.stubEnv('YOUTUBE_CLIENT_SECRET', 'client-secret')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'fresh-youtube-access-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'reply-1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(request({
      action: 'submit',
      comment_id: 'comment-1',
    }) as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      blocked: false,
      integration_note: 'A gated YouTube reply was submitted and canonical submitted evidence was recorded.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://oauth2.googleapis.com/token')
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://www.googleapis.com/youtube/v3/comments?part=snippet')
    expect(mocks.configUpdate).toHaveBeenCalledWith({
      credentials: expect.objectContaining({
        access_token: 'fresh-youtube-access-token',
        refresh_token: 'youtube-refresh-token',
        expires_in: 3600,
        token_obtained_at: expect.any(String),
        scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
      }),
    })
    expect(mocks.update.mock.calls.at(-1)?.[0]).toMatchObject({
      reply_submission_state: 'submitted',
      reply_provider_comment_id: 'reply-1',
      metadata: expect.objectContaining({
        youtube_reply_readiness: expect.objectContaining({
          status: 'submitted',
          external_submission_attempted: true,
        }),
      }),
    })

    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    installDbMocks({
      comment: submittedYouTubeCommentRow,
      config: staleYouTubeConfig,
      canonicalCapability: futureCanonicalYouTubeCapability,
    })
    fetchMock.mockClear()

    const duplicate = await POST(request({
      action: 'submit',
      comment_id: 'comment-1',
    }) as never, { params: { id: 'social-1' } })
    const duplicateBody = await duplicate.json()

    expect(duplicate.status).toBe(200)
    expect(duplicateBody).toMatchObject({
      ok: true,
      blocked: false,
      already_submitted: true,
    })
    expect(duplicateBody.message).toContain('already submitted')
    expect(duplicateBody.integration_note).toContain('idempotent completed state')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.configUpdate).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('reports provider success that cannot be persisted as reconcile-before-retry', async () => {
    installDbMocks({
      comment: youtubeCommentRow,
      claimData: { id: 'comment-1' },
      persistenceData: null,
      canonicalCapability: futureCanonicalYouTubeCapability,
    })
    vi.stubEnv('SOCIAL_COMMENT_YOUTUBE_REPLY_SUBMISSION_ENABLED', 'true')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'reply-1' }), { status: 200 }))
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
      submission_may_have_succeeded: true,
      provider_reply_id: 'reply-1',
    })
    expect(body.message).toContain('may have succeeded')
    expect(body.integration_note).toContain('reconcile manually before any retry')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.update).toHaveBeenCalledTimes(2)
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      reply_submission_state: 'blocked',
      metadata: expect.objectContaining({
        youtube_reply_readiness: expect.objectContaining({ status: 'claiming' }),
      }),
    })
    expect(mocks.update.mock.calls[1][0]).toMatchObject({
      reply_submission_state: 'submitted',
      reply_provider_comment_id: 'reply-1',
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

  it('records reject revision notes and preserves the draft without external submission', async () => {
    const response = await POST(request({
      action: 'reject',
      comment_id: 'comment-1',
      draft_reply: 'Needs a sharper reply.',
      note: 'Name the human approval boundary before this can move forward.',
    }) as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.integration_note).toContain('No external comment reply was submitted')
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      proposed_reply_text: 'Needs a sharper reply.',
      response_approval_state: 'rejected',
      reply_submission_state: 'draft',
      metadata: expect.objectContaining({
        ui_action_history: expect.arrayContaining([
          expect.objectContaining({
            action: 'reject',
            note: 'Name the human approval boundary before this can move forward.',
          }),
        ]),
      }),
    }))
    expect(mocks.update.mock.calls.at(-1)?.[0]).not.toHaveProperty('reply_provider_comment_id')
    expect(mocks.update.mock.calls.at(-1)?.[0]).not.toHaveProperty('reply_submitted_at')
  })

  it('blocks repeated approve or reject decisions on a rejected reply review', async () => {
    installDbMocks({
      comment: {
        ...commentRow,
        response_approval_state: 'rejected',
        reply_submission_state: 'draft',
        proposed_reply_text: 'Needs revision.',
        approved_reply_text: null,
      },
    })

    const approve = await POST(request({
      action: 'approve',
      comment_id: 'comment-1',
      draft_reply: 'Trying to approve without revision recovery.',
    }) as never, { params: { id: 'social-1' } })
    const approveBody = await approve.json()

    expect(approve.status).toBe(409)
    expect(approveBody).toMatchObject({
      ok: false,
      blocked: true,
      message: 'Reply review is rejected. Revise the reply and return it to review before approving or rejecting again.',
    })
    expect(approveBody.integration_note).toContain('No external comment reply was submitted')
    expect(approveBody.integration_note).toContain('locked until the explicit recovery action runs')
    expect(mocks.update).not.toHaveBeenCalled()

    const reject = await POST(request({
      action: 'reject',
      comment_id: 'comment-1',
      draft_reply: 'Trying to reject again.',
    }) as never, { params: { id: 'social-1' } })
    const rejectBody = await reject.json()

    expect(reject.status).toBe(409)
    expect(rejectBody).toMatchObject({
      ok: false,
      blocked: true,
      message: 'Reply review is rejected. Revise the reply and return it to review before approving or rejecting again.',
    })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('returns a revised rejected reply to pending review without external submission', async () => {
    installDbMocks({
      comment: {
        ...commentRow,
        response_approval_state: 'rejected',
        reply_submission_state: 'draft',
        proposed_reply_text: 'Needs revision.',
        approved_reply_text: null,
      },
    })

    const response = await POST(request({
      action: 'return_to_review',
      comment_id: 'comment-1',
      draft_reply: 'Revised reply for a fresh review.',
    }) as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      blocked: false,
      message: 'Revised reply saved and returned to review. Approval is required before any provider submission.',
    })
    expect(body.integration_note).toContain('No external comment reply was submitted')
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      proposed_reply_text: 'Revised reply for a fresh review.',
      approved_reply_text: null,
      response_approval_state: 'pending',
      reply_submission_state: 'draft',
      metadata: expect.objectContaining({
        ui_action_history: expect.arrayContaining([
          expect.objectContaining({ action: 'return_to_review' }),
        ]),
      }),
    }))
  })

  it('blocks later review actions on submitted provider evidence without recording a no-op action', async () => {
    installDbMocks({ comment: submittedYouTubeCommentRow })

    const response = await POST(request({
      action: 'approve',
      comment_id: 'comment-1',
      draft_reply: 'Edited after submit.',
    }) as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      ok: false,
      blocked: true,
      already_submitted: true,
      message: expect.stringContaining('submitted provider evidence'),
    })
    expect(body.integration_note).toContain('no local no-op review action was recorded')
    expect(mocks.update).not.toHaveBeenCalled()
    expect(body.comments[0]).toMatchObject({
      status: 'responded',
    })
  })

  it('blocks return-to-review on submitted provider evidence without recording a no-op action', async () => {
    installDbMocks({
      comment: {
        ...submittedYouTubeCommentRow,
        response_approval_state: 'rejected',
      },
    })

    const response = await POST(request({
      action: 'return_to_review',
      comment_id: 'comment-1',
      draft_reply: 'Trying to revise after provider submission.',
    }) as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      ok: false,
      blocked: true,
      already_submitted: true,
      message: 'Reply already has submitted provider evidence. Local review is locked to preserve the canonical provider record.',
    })
    expect(body.integration_note).toContain('no local no-op review action was recorded')
    expect(mocks.update).not.toHaveBeenCalled()
    expect(body.comments[0]).toMatchObject({
      status: 'responded',
      approvalState: 'rejected',
      submittedReplyLocked: true,
    })
  })
})
