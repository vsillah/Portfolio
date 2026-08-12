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

function installDbMocks() {
  const commentsLimit = vi.fn().mockResolvedValue({ data: [commentRow], error: null })
  const commentsOrder = vi.fn().mockReturnValue({ limit: commentsLimit })
  const commentsEq = vi.fn().mockReturnValue({ order: commentsOrder })
  const commentsSelect = vi.fn().mockReturnValue({ eq: commentsEq, order: commentsOrder })

  const postsIn = vi.fn().mockResolvedValue({ data: [postRow], error: null })
  const postsSelect = vi.fn().mockReturnValue({ in: postsIn })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_comments') return { select: commentsSelect }
    if (table === 'social_content_queue') return { select: postsSelect }
    throw new Error(`Unexpected table ${table}`)
  })
}

describe('GET /api/admin/social-content/engagement/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    installDbMocks()
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
    })
    expect(body.recovery).toContain('migration 20260806163011')
    expect(body.integration_note).toContain('No provider ingestion or external comment replies')
  })
})
