import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COMMENT_INBOX_PLATFORM_CAPABILITIES,
  buildSocialCommentIdempotencyKey,
  buildSocialCommentIngestionRunInsert,
  buildSocialCommentUpsertPayload,
  createBlockedCommentProviderAdapter,
  getCommentProviderCapability,
  prepareSocialCommentUpserts,
  upsertSocialContentComments,
} from './social-comment-inbox'
import type { SocialPlatform } from './social-content'

const ALL_PLATFORMS: SocialPlatform[] = ['linkedin', 'youtube', 'instagram', 'facebook', 'x', 'tiktok']

describe('social comment inbox foundation', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('represents every supported social platform while keeping external submission disabled', () => {
    expect(Object.keys(COMMENT_INBOX_PLATFORM_CAPABILITIES).sort()).toEqual([...ALL_PLATFORMS].sort())

    for (const platform of ALL_PLATFORMS) {
      const capability = getCommentProviderCapability(platform)
      expect(capability.platform).toBe(platform)
      expect(capability.provider).toEqual(expect.any(String))
      expect(capability.supportsReplyDraft).toBe(true)
      expect(capability.supportsReplySubmission).toBe(false)
      expect(capability.externalSubmissionEnabled).toBe(false)
      expect(['manual', 'blocked']).toContain(capability.capabilityStatus)
    }

    expect(getCommentProviderCapability('tiktok').capabilityStatus).toBe('blocked')
  })

  it('builds idempotent comment upsert payloads with provider capability metadata', () => {
    vi.setSystemTime(new Date('2026-08-06T16:40:00.000Z'))

    const payload = buildSocialCommentUpsertPayload({
      publishId: 'publish-1',
      contentId: 'content-1',
      platform: 'linkedin',
      providerCommentId: ' comment-1 ',
      authorPublicHandle: ' @operator ',
      authorDisplayName: ' Operator One ',
      body: ' This needs a response. ',
      commentUrl: ' https://www.linkedin.com/feed/update/comment-1 ',
      classificationStatus: 'needs_response',
      responseApprovalState: 'pending',
      rawPayload: { id: 'comment-1' },
    })

    expect(payload).toMatchObject({
      publish_id: 'publish-1',
      content_id: 'content-1',
      platform: 'linkedin',
      provider: 'linkedin_organization',
      provider_comment_id: 'comment-1',
      author_public_handle: '@operator',
      author_display_name: 'Operator One',
      body: 'This needs a response.',
      captured_at: '2026-08-06T16:40:00.000Z',
      classification_status: 'needs_response',
      response_approval_state: 'pending',
      reply_submission_state: 'not_applicable',
      raw_payload: { id: 'comment-1' },
      provider_capability: {
        capability_status: 'manual',
        supports_comment_ingestion: false,
        supports_reply_submission: false,
        external_submission_enabled: false,
      },
    })
  })

  it('deduplicates repeated provider comments before database upsert', () => {
    const comments = prepareSocialCommentUpserts([
      {
        publishId: 'publish-1',
        contentId: 'content-1',
        platform: 'youtube',
        providerCommentId: 'comment-1',
        body: 'First version',
      },
      {
        publishId: 'publish-1',
        contentId: 'content-1',
        platform: 'youtube',
        providerCommentId: 'comment-1',
        body: 'Updated version',
        sentiment: 'positive',
      },
      {
        publishId: 'publish-1',
        contentId: 'content-1',
        platform: 'youtube',
        providerCommentId: 'comment-2',
        body: 'Second comment',
      },
    ])

    expect(comments).toHaveLength(2)
    expect(comments[0]).toMatchObject({
      provider_comment_id: 'comment-1',
      body: 'Updated version',
      sentiment: 'positive',
    })
    expect(comments[1]).toMatchObject({ provider_comment_id: 'comment-2' })
  })

  it('uses publish, provider, and provider comment id as the idempotency key', () => {
    expect(buildSocialCommentIdempotencyKey({
      publishId: 'publish-1',
      platform: 'facebook',
      provider: 'meta_graph',
      providerCommentId: 'comment-1',
    })).toBe('publish-1:meta_graph:comment-1')
  })

  it('tracks unsupported ingestion as manual blocked instead of hiding the platform', () => {
    const run = buildSocialCommentIngestionRunInsert({
      platform: 'x',
      publishId: 'publish-1',
      contentId: 'content-1',
      errors: [{ code: 'provider_not_enabled' }],
    })

    expect(run).toMatchObject({
      platform: 'x',
      provider: 'x_api',
      publish_id: 'publish-1',
      content_id: 'content-1',
      status: 'manual_blocked',
      error_count: 1,
      errors: [{ code: 'provider_not_enabled' }],
    })
  })

  it('exposes blocked provider adapters that cannot call live providers or submit replies', async () => {
    const adapter = createBlockedCommentProviderAdapter('instagram')

    await expect(adapter.fetchComments()).rejects.toThrow('live comment ingestion and reply submission are not enabled')
    await expect(adapter.submitReply()).rejects.toThrow('live comment ingestion and reply submission are not enabled')
  })

  it('inserts new comments through the canonical table without provider calls', async () => {
    const upsertSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'comment-row-1',
          publish_id: 'publish-1',
          provider: 'linkedin_organization',
          provider_comment_id: 'comment-1',
        },
      ],
      error: null,
    })
    const upsert = vi.fn(() => ({ select: upsertSelect }))
    const updateSelect = vi.fn().mockResolvedValue({ data: [{ id: 'comment-row-1' }], error: null })
    const updateBuilder: Record<string, unknown> = {
      eq: vi.fn(() => updateBuilder),
      select: updateSelect,
    }
    const update = vi.fn((_: Record<string, unknown>) => updateBuilder)
    const db = {
      from: vi.fn(() => ({ upsert, update })),
    }

    const result = await upsertSocialContentComments({
      db,
      comments: [
        {
          publishId: 'publish-1',
          contentId: 'content-1',
          platform: 'linkedin',
          providerCommentId: 'comment-1',
          body: 'Useful comment',
        },
      ],
    })

    expect(db.from).toHaveBeenCalledWith('social_content_comments')
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({
        publish_id: 'publish-1',
        provider: 'linkedin_organization',
        provider_comment_id: 'comment-1',
      })],
      {
        onConflict: 'publish_id,provider,provider_comment_id',
        ignoreDuplicates: true,
      },
    )
    expect(upsertSelect).toHaveBeenCalledWith('*')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Useful comment',
      provider_capability: expect.objectContaining({
        external_submission_enabled: false,
      }),
    }))
    expect(result.data).toHaveLength(1)
    expect(result).toMatchObject({ upserted: 1 })
  })

  it('preserves workflow and omitted provider fields when a partial refresh repeats an existing comment', async () => {
    const upsertSelect = vi.fn().mockResolvedValue({ data: [], error: null })
    const upsert = vi.fn(() => ({ select: upsertSelect }))
    const preservedRow = {
      id: 'comment-row-1',
      publish_id: 'publish-1',
      provider: 'linkedin_organization',
      provider_comment_id: 'comment-1',
      parent_comment_id: 'resolved-parent-row',
      body: 'Provider-corrected text',
      status: 'held_for_review',
      author_public_handle: '@original',
      author_display_name: 'Original Author',
      author_profile_url: 'https://www.linkedin.com/in/original',
      comment_url: 'https://www.linkedin.com/feed/update/original-comment',
      provider_created_at: '2026-08-01T10:00:00.000Z',
      provider_updated_at: '2026-08-02T10:00:00.000Z',
      raw_payload: { provider_version: 1, retained: true },
      classification_status: 'needs_response',
      classification_reason: 'High-intent buyer question',
      sentiment: 'positive',
      priority: 'urgent',
      response_approval_state: 'approved',
      reply_submission_state: 'submitted',
      proposed_reply_text: 'Draft from inbox workroom',
      approved_reply_text: 'Approved human response',
      reply_provider_comment_id: 'reply-123',
      reply_submitted_at: '2026-08-10T10:00:00.000Z',
      metadata: {
        lead: { status: 'qualified' },
        escalation: { owner: 'Shaka' },
        policy_decision: { allow_reply: true },
      },
    }
    const updateSelect = vi.fn().mockResolvedValue({ data: [preservedRow], error: null })
    const updateBuilder: Record<string, unknown> = {
      eq: vi.fn(() => updateBuilder),
      select: updateSelect,
    }
    const update = vi.fn((_: Record<string, unknown>) => updateBuilder)
    const db = {
      from: vi.fn(() => ({ upsert, update })),
    }

    const result = await upsertSocialContentComments({
      db,
      comments: [
        {
          publishId: 'publish-1',
          contentId: 'content-1',
          platform: 'linkedin',
          providerCommentId: 'comment-1',
          body: 'Provider-corrected text',
          parentCommentId: undefined,
          authorPublicHandle: undefined,
          authorDisplayName: undefined,
          authorProfileUrl: undefined,
          commentUrl: undefined,
          providerCreatedAt: undefined,
          providerUpdatedAt: undefined,
          classificationStatus: 'unreviewed',
          classificationReason: null,
          sentiment: 'unknown',
          priority: 'normal',
          responseApprovalState: 'not_required',
          replySubmissionState: 'not_applicable',
          proposedReplyText: null,
          approvedReplyText: null,
          replyProviderCommentId: null,
          replySubmittedAt: null,
          metadata: {
            lead: { status: 'reset' },
            escalation: { owner: 'reset' },
            policy_decision: { allow_reply: false },
          },
        },
      ],
    })

    const updatePayload = update.mock.calls[0][0]
    expect(updatePayload).toMatchObject({
      body: 'Provider-corrected text',
    })
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ provider_comment_id: 'comment-1' })],
      expect.objectContaining({ ignoreDuplicates: true }),
    )
    expect(updatePayload).not.toHaveProperty('provider')
    expect(updatePayload).not.toHaveProperty('provider_comment_id')
    expect(updatePayload).not.toHaveProperty('parent_comment_id')
    expect(updatePayload).not.toHaveProperty('status')
    expect(updatePayload).not.toHaveProperty('author_public_handle')
    expect(updatePayload).not.toHaveProperty('author_display_name')
    expect(updatePayload).not.toHaveProperty('author_profile_url')
    expect(updatePayload).not.toHaveProperty('comment_url')
    expect(updatePayload).not.toHaveProperty('provider_created_at')
    expect(updatePayload).not.toHaveProperty('provider_updated_at')
    expect(updatePayload).not.toHaveProperty('raw_payload')
    expect(updatePayload).not.toHaveProperty('classification_status')
    expect(updatePayload).not.toHaveProperty('classification_reason')
    expect(updatePayload).not.toHaveProperty('sentiment')
    expect(updatePayload).not.toHaveProperty('priority')
    expect(updatePayload).not.toHaveProperty('response_approval_state')
    expect(updatePayload).not.toHaveProperty('reply_submission_state')
    expect(updatePayload).not.toHaveProperty('proposed_reply_text')
    expect(updatePayload).not.toHaveProperty('approved_reply_text')
    expect(updatePayload).not.toHaveProperty('reply_provider_comment_id')
    expect(updatePayload).not.toHaveProperty('reply_submitted_at')
    expect(updatePayload).not.toHaveProperty('metadata')
    expect(result).toEqual({ data: [preservedRow], upserted: 1 })
  })

  it('updates deliberately provided provider fields without touching local parent or workflow state', async () => {
    const upsertSelect = vi.fn().mockResolvedValue({ data: [], error: null })
    const upsert = vi.fn(() => ({ select: upsertSelect }))
    const updateSelect = vi.fn().mockResolvedValue({ data: [{ id: 'comment-row-1' }], error: null })
    const updateBuilder: Record<string, unknown> = {
      eq: vi.fn(() => updateBuilder),
      select: updateSelect,
    }
    const update = vi.fn((_: Record<string, unknown>) => updateBuilder)
    const db = {
      from: vi.fn(() => ({ upsert, update })),
    }

    await upsertSocialContentComments({
      db,
      comments: [
        {
          publishId: 'publish-1',
          contentId: 'content-1',
          platform: 'youtube',
          providerCommentId: 'comment-1',
          providerParentCommentId: 'provider-parent-1',
          parentCommentId: 'local-parent-should-not-patch',
          threadId: 'thread-1',
          authorPublicHandle: '@refreshed',
          authorDisplayName: 'Refreshed Author',
          authorProfileUrl: 'https://youtube.com/@refreshed',
          authorIsChannelOwner: false,
          body: 'Refreshed body',
          commentUrl: 'https://youtube.com/comment-1',
          providerCreatedAt: '2026-08-01T10:00:00.000Z',
          providerUpdatedAt: '2026-08-11T10:00:00.000Z',
          status: 'blocked',
          rawPayload: { provider_version: 2 },
          metadata: { policy_decision: { should_not_patch: true } },
        },
      ],
    })

    const updatePayload = update.mock.calls[0][0]
    expect(updatePayload).toMatchObject({
      provider_parent_comment_id: 'provider-parent-1',
      thread_id: 'thread-1',
      author_public_handle: '@refreshed',
      author_display_name: 'Refreshed Author',
      author_profile_url: 'https://youtube.com/@refreshed',
      author_is_channel_owner: false,
      comment_url: 'https://youtube.com/comment-1',
      provider_created_at: '2026-08-01T10:00:00.000Z',
      provider_updated_at: '2026-08-11T10:00:00.000Z',
      raw_payload: { provider_version: 2 },
    })
    expect(updatePayload).not.toHaveProperty('parent_comment_id')
    expect(updatePayload).not.toHaveProperty('status')
    expect(updatePayload).not.toHaveProperty('metadata')
  })
})
