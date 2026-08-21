import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

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
  response_approval_state: 'pending',
  reply_submission_state: 'draft',
  proposed_reply_text: 'Yes.',
  approved_reply_text: null,
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
  },
}

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

function request(url = 'http://localhost/api/admin/social-content/engagement/comments') {
  return new Request(url, {
    headers: { authorization: 'Bearer token' },
  })
}

function installDbMocks(agentRunRows: Array<Record<string, unknown>> = []) {
  const commentsLimit = vi.fn().mockResolvedValue({ data: [commentRow], error: null })
  const commentsOrder = vi.fn().mockReturnValue({ limit: commentsLimit })
  const commentsEq = vi.fn().mockReturnValue({ order: commentsOrder })
  const commentsSelect = vi.fn().mockReturnValue({ eq: commentsEq, order: commentsOrder })

  const postsIn = vi.fn().mockResolvedValue({ data: [postRow], error: null })
  const postsSelect = vi.fn().mockReturnValue({ in: postsIn })

  const runsLimit = vi.fn().mockResolvedValue({ data: agentRunRows, error: null })
  const runsOrder = vi.fn().mockReturnValue({ limit: runsLimit })
  const runsEq = vi.fn().mockReturnValue({ order: runsOrder })
  const runsSelect = vi.fn().mockReturnValue({ eq: runsEq })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_comments') return { select: commentsSelect }
    if (table === 'social_content_queue') return { select: postsSelect }
    if (table === 'agent_runs') return { select: runsSelect }
    throw new Error(`Unexpected table ${table}`)
  })
}

describe('GET /api/admin/social-content/engagement/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SOCIAL_COMMENT_SLACK_ATTENTION_ENABLED
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    installDbMocks()
  })

  it('does not apply a platform condition when filter is all or omitted', async () => {
    const commentsLimit = vi.fn().mockResolvedValue({ data: [commentRow], error: null })
    const commentsOrder = vi.fn().mockReturnValue({ limit: commentsLimit })
    const commentsEq = vi.fn().mockReturnValue({ order: commentsOrder })
    const commentsSelect = vi.fn().mockReturnValue({ eq: commentsEq, order: commentsOrder })
    const postsIn = vi.fn().mockResolvedValue({ data: [postRow], error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'social_content_comments') return { select: commentsSelect }
      if (table === 'social_content_queue') return { select: vi.fn().mockReturnValue({ in: postsIn }) }
      throw new Error(`Unexpected table ${table}`)
    })

    const allResponse = await GET(request('http://localhost/api/admin/social-content/engagement/comments?status=all&platform=all') as never)
    const omittedResponse = await GET(request() as never)

    expect(allResponse.status).toBe(200)
    expect(omittedResponse.status).toBe(200)
    expect((await allResponse.json()).items).toHaveLength(1)
    expect((await omittedResponse.json()).items).toHaveLength(1)
    expect(commentsEq).not.toHaveBeenCalled()
  })

  it('filters canonical comments by status and returns counts', async () => {
    const response = await GET(request('http://localhost/api/admin/social-content/engagement/comments?status=lead') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({
      id: 'comment-1',
      status: 'lead',
      socialContentId: 'social-1',
      providerCapability: {
        automaticReply: false,
        verified: false,
      },
    })
    expect(body.summary).toMatchObject({ total: 1, lead: 1 })
    expect(body.alertReliability).toMatchObject({
      state: 'disabled',
      deliveryMode: 'disabled',
      activation: {
        enabled: false,
      },
      counts: {
        itemCount: 1,
        sent: 0,
        deduped: 0,
        skipped: 0,
        errors: 0,
      },
    })
    expect(body.integration_note).toContain('No external comment replies')
  })

  it('keeps manual providers visible as empty filtered results instead of failing', async () => {
    const response = await GET(request('http://localhost/api/admin/social-content/engagement/comments?status=ignored') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items).toEqual([])
    expect(body.summary.total).toBe(1)
    expect(body.filteredSummary.total).toBe(0)
  })

  it.each([
    {
      name: 'sent',
      run: {
        id: 'run-sent',
        status: 'completed',
        current_step: 'Slack notification sent',
        metadata: {
          notification_kind: 'social_comment_attention_due',
          item_count: 3,
          text: 'Do not expose Slack payload text',
          blocks: [{ text: 'Do not expose Slack blocks' }],
        },
        outcome: { sent: true, item_count: 3 },
        started_at: '2026-08-14T12:00:00.000Z',
        completed_at: '2026-08-14T12:01:00.000Z',
      },
      expected: {
        state: 'sent',
        counts: { itemCount: 3, sent: 1, deduped: 0, skipped: 0, errors: 0 },
      },
    },
    {
      name: 'deduped',
      run: {
        id: 'run-deduped',
        status: 'completed',
        current_step: 'Slack notification deduped',
        metadata: {
          notification_kind: 'social_comment_attention_due',
          item_count: 2,
          text: 'Do not expose deduped payload text',
        },
        outcome: {
          skipped: true,
          reason: 'A matching Slack mobile notification was already prepared in this hourly window.',
        },
        started_at: '2026-08-14T13:00:00.000Z',
        completed_at: '2026-08-14T13:01:00.000Z',
      },
      expected: {
        state: 'deduped',
        counts: { itemCount: 2, sent: 0, deduped: 1, skipped: 0, errors: 0 },
      },
    },
    {
      name: 'skipped',
      run: {
        id: 'run-skipped',
        status: 'cancelled',
        current_step: 'Slack notification skipped',
        metadata: {
          notification_kind: 'social_comment_attention_due',
          item_count: 4,
        },
        outcome: {
          skipped: true,
          item_count: 4,
          reason: 'Slack bot channel and webhook are not configured.',
        },
        started_at: '2026-08-14T14:00:00.000Z',
        completed_at: '2026-08-14T14:01:00.000Z',
      },
      expected: {
        state: 'skipped',
        counts: { itemCount: 4, sent: 0, deduped: 0, skipped: 1, errors: 0 },
      },
    },
    {
      name: 'errored',
      run: {
        id: 'run-errored',
        status: 'failed',
        current_step: 'Slack notification failed',
        metadata: {
          notification_kind: 'social_comment_attention_due',
          item_count: 5,
        },
        outcome: {
          error: 'database unavailable',
          item_count: 5,
        },
        started_at: '2026-08-14T15:00:00.000Z',
        updated_at: '2026-08-14T15:01:00.000Z',
      },
      expected: {
        state: 'errored',
        counts: { itemCount: 5, sent: 0, deduped: 0, skipped: 0, errors: 1 },
      },
    },
  ])('hydrates coherent alert reliability counts from the last $name run', async ({ run, expected }) => {
    process.env.SOCIAL_COMMENT_SLACK_ATTENTION_ENABLED = 'true'
    installDbMocks([run])

    const response = await GET(request() as never)
    const body = await response.json()
    const serialized = JSON.stringify(body.alertReliability)

    expect(response.status).toBe(200)
    expect(body.alertReliability).toMatchObject({
      state: expected.state,
      deliveryMode: 'live',
      counts: expected.counts,
      lastRun: {
        id: run.id,
        itemCount: expected.counts.itemCount,
      },
    })
    expect(serialized).not.toContain('blocks')
    expect(serialized).not.toContain('Do not expose')

    delete process.env.SOCIAL_COMMENT_SLACK_ATTENTION_ENABLED
  })

  it('returns a blocked unavailable state when canonical storage is not migrated', async () => {
    const commentsLimit = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42P01',
        message: 'relation "public.social_content_comments" does not exist',
      },
    })
    const commentsOrder = vi.fn().mockReturnValue({ limit: commentsLimit })
    const commentsSelect = vi.fn().mockReturnValue({ order: commentsOrder })
    mocks.from.mockReturnValue({ select: commentsSelect })

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      unavailable: true,
      blocked: true,
      items: [],
      message: 'Comment inbox storage is not available in this environment.',
      alertReliability: {
        state: 'disabled',
        deliveryMode: 'disabled',
        counts: {
          itemCount: 0,
        },
      },
    })
    expect(body.recovery).toContain('migration 20260806163011')
    expect(body.integration_note).toContain('No provider ingestion or external comment replies')
  })
})
