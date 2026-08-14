import { describe, expect, it, vi } from 'vitest'
import {
  buildYouTubeCommentInsertRequest,
  evaluateYouTubeReplyReadiness,
  refreshYouTubeReplyConfigIfNeeded,
  submitYouTubeCommentReply,
  YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV,
  YOUTUBE_COMMENTS_INSERT_URL,
} from './youtube-comment-reply-readiness'
import { YOUTUBE_FORCE_SSL_SCOPE } from './youtube-oauth'

const approvedComment = {
  id: 'comment-row-1',
  publish_id: 'publish-1',
  content_id: 'content-1',
  platform: 'youtube',
  provider: 'youtube_data_api',
  provider_comment_id: 'UgzcTopLevel1',
  provider_parent_comment_id: null,
  response_approval_state: 'approved',
  reply_submission_state: 'approved',
  approved_reply_text: 'Appreciate you watching. The short answer is yes.',
  reply_provider_comment_id: null,
  reply_submitted_at: null,
  provider_capability: {
    capability_status: 'verified',
    supports_reply_submission: true,
    external_submission_enabled: true,
  },
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
      auto_send: {
        blocked_reasons: [],
      },
    },
  },
}

const activeConfig = {
  is_active: true,
  credentials: {
    access_token: 'youtube-access-token',
    refresh_token: 'youtube-refresh-token',
    expires_in: 3600,
    token_obtained_at: '2026-08-13T12:00:00.000Z',
    scope: YOUTUBE_FORCE_SSL_SCOPE,
  },
  settings: {
    channel_id: 'channel-1',
  },
}

const activeCanonicalCapability = {
  platform: 'youtube',
  provider: 'youtube_data_api',
  capability_status: 'verified',
  supports_reply_submission: true,
  external_submission_enabled: true,
  gate_notes: 'Future verified canary capability.',
}

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

function asFetch(mock: ReturnType<typeof vi.fn>): typeof fetch {
  return mock as unknown as typeof fetch
}

describe('youtube reply readiness', () => {
  it('blocks by default and performs zero external calls while disabled', async () => {
    const fetchImpl = vi.fn(() => response({ id: 'reply-1' }))

    const result = await submitYouTubeCommentReply({
      comment: approvedComment,
      config: activeConfig,
      canonicalCapability: activeCanonicalCapability,
      fetchImpl: asFetch(fetchImpl),
      env: {},
      now: () => new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(result).toMatchObject({
      ok: false,
      blocked: true,
      status: 'blocked',
      blockers: [expect.objectContaining({ code: 'youtube_reply_submission_disabled' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('constructs the official comments.insert request when every gate passes', () => {
    const request = buildYouTubeCommentInsertRequest({
      accessToken: 'token-1',
      parentId: 'UgzcTopLevel1',
      textOriginal: 'Approved reply',
      idempotencyKey: 'reply-key',
    })

    expect(request).toMatchObject({
      url: `${YOUTUBE_COMMENTS_INSERT_URL}?part=snippet`,
      init: {
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-1',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          snippet: {
            parentId: 'UgzcTopLevel1',
            textOriginal: 'Approved reply',
          },
        }),
      },
      idempotencyKey: 'reply-key',
      parentId: 'UgzcTopLevel1',
      textOriginal: 'Approved reply',
    })
  })

  it('returns a ready request only with verified capability, approved reply, scope, and env enablement', () => {
    const readiness = evaluateYouTubeReplyReadiness({
      comment: approvedComment,
      config: activeConfig,
      canonicalCapability: activeCanonicalCapability,
      env: { [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      now: new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(readiness).toMatchObject({
      ready: true,
      blockers: [],
      idempotencyKey: 'youtube-comment-reply:publish-1:UgzcTopLevel1:comment-row-1',
      request: expect.objectContaining({
        parentId: 'UgzcTopLevel1',
        textOriginal: approvedComment.approved_reply_text,
      }),
    })
  })

  it('blocks against the current canonical capability table until a later migration allows external submission', () => {
    const readiness = evaluateYouTubeReplyReadiness({
      comment: approvedComment,
      config: activeConfig,
      canonicalCapability: {
        ...activeCanonicalCapability,
        capability_status: 'manual',
        supports_reply_submission: false,
        external_submission_enabled: false,
      },
      env: { [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      now: new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'canonical_capability_unverified' }),
      expect.objectContaining({ code: 'canonical_reply_submission_unsupported' }),
      expect.objectContaining({ code: 'canonical_external_submission_disabled' }),
    ]))
    expect(readiness.blockers.find((blocker) => blocker.code === 'canonical_external_submission_disabled')?.recoveryAction)
      .toContain('later authorized migration')
    expect(readiness.request).toBeNull()
  })

  it('blocks duplicate submissions with existing reply evidence', () => {
    const readiness = evaluateYouTubeReplyReadiness({
      comment: {
        ...approvedComment,
        reply_submission_state: 'submitted',
        reply_provider_comment_id: 'reply-existing',
        reply_submitted_at: '2026-08-13T12:10:00.000Z',
      },
      config: activeConfig,
      canonicalCapability: activeCanonicalCapability,
      env: { [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      now: new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'reply_already_submitted' }),
    ]))
    expect(readiness.request).toBeNull()
  })

  it('blocks unapproved or empty replies before request construction', () => {
    const readiness = evaluateYouTubeReplyReadiness({
      comment: {
        ...approvedComment,
        response_approval_state: 'pending',
        reply_submission_state: 'draft',
        approved_reply_text: '',
      },
      config: activeConfig,
      canonicalCapability: activeCanonicalCapability,
      env: { [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      now: new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'human_approval_required' }),
      expect.objectContaining({ code: 'approved_reply_required' }),
    ]))
  })

  it('normalizes missing scope and expired token readiness blockers', () => {
    const readiness = evaluateYouTubeReplyReadiness({
      comment: approvedComment,
      config: {
        ...activeConfig,
        credentials: {
          ...activeConfig.credentials,
          scope: 'https://www.googleapis.com/auth/youtube.readonly',
          token_obtained_at: '2026-08-13T10:00:00.000Z',
          expires_in: 60,
        },
      },
      canonicalCapability: activeCanonicalCapability,
      env: { [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      now: new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'youtube_insufficient_scope' }),
      expect.objectContaining({ code: 'youtube_token_expired' }),
    ]))
    expect(readiness.request).toBeNull()
  })

  it('blocks unverifiable token freshness metadata', () => {
    const readiness = evaluateYouTubeReplyReadiness({
      comment: approvedComment,
      config: {
        ...activeConfig,
        credentials: {
          ...activeConfig.credentials,
          token_obtained_at: 'not-a-date',
          expires_in: null,
        },
      },
      canonicalCapability: activeCanonicalCapability,
      env: { [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      now: new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'youtube_token_expired' }),
    ]))
    expect(readiness.request).toBeNull()
  })

  it('refreshes stale reply credentials without exposing the refresh token', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => response({
      access_token: 'fresh-access-token',
      expires_in: 3600,
      scope: YOUTUBE_FORCE_SSL_SCOPE,
    }))

    const result = await refreshYouTubeReplyConfigIfNeeded({
      config: {
        ...activeConfig,
        credentials: {
          ...activeConfig.credentials,
          access_token: 'expired-access-token',
          token_obtained_at: '2026-08-13T10:00:00.000Z',
          expires_in: 60,
        },
      },
      fetchImpl: asFetch(fetchImpl),
      env: {
        YOUTUBE_CLIENT_ID: 'client-id',
        YOUTUBE_CLIENT_SECRET: 'client-secret',
      },
      now: new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(result).toMatchObject({
      refreshed: true,
      blocker: null,
      config: {
        credentials: expect.objectContaining({
          access_token: 'fresh-access-token',
          refresh_token: 'youtube-refresh-token',
          expires_in: 3600,
          token_obtained_at: '2026-08-13T12:05:00.000Z',
          scope: YOUTUBE_FORCE_SSL_SCOPE,
        }),
      },
    })
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://oauth2.googleapis.com/token')
    expect(String((fetchImpl.mock.calls[0][1]?.body as URLSearchParams).get('refresh_token'))).toBe('youtube-refresh-token')
  })

  it('blocks stale reply credentials when refresh fails without calling comments.insert', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => response({ error_description: 'invalid_grant' }, 400))

    const result = await refreshYouTubeReplyConfigIfNeeded({
      config: {
        ...activeConfig,
        credentials: {
          ...activeConfig.credentials,
          token_obtained_at: 'not-a-date',
          expires_in: null,
        },
      },
      fetchImpl: asFetch(fetchImpl),
      env: {
        YOUTUBE_CLIENT_ID: 'client-id',
        YOUTUBE_CLIENT_SECRET: 'client-secret',
      },
      now: new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(result).toMatchObject({
      refreshed: false,
      blocker: expect.objectContaining({
        code: 'youtube_token_refresh_failed',
        message: 'YouTube token refresh failed (400).',
      }),
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://oauth2.googleapis.com/token')
  })

  it('inherits policy provenance and source-distance public reply blockers', () => {
    const readiness = evaluateYouTubeReplyReadiness({
      comment: {
        ...approvedComment,
        metadata: {
          policy_decision: {
            classification: 'sensitive_privacy_legal_financial',
            provenance_summary: 'Private source context was used.',
            source_distance_note: 'Private source material must not be quoted.',
            auto_send: {
              blocked_reasons: ['private_data', 'unsupported_claim'],
            },
          },
        },
      },
      config: activeConfig,
      canonicalCapability: activeCanonicalCapability,
      env: { [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      now: new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(readiness).toMatchObject({
      ready: false,
      blockers: [expect.objectContaining({ code: 'policy_public_reply_blocked' })],
      request: null,
    })
  })

  it('blocks channel/account mismatches when both identities are available', () => {
    const readiness = evaluateYouTubeReplyReadiness({
      comment: approvedComment,
      config: {
        ...activeConfig,
        settings: { channel_id: 'different-channel' },
      },
      canonicalCapability: activeCanonicalCapability,
      env: { [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      now: new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'channel_identity_mismatch' }),
    ]))
    expect(readiness.request).toBeNull()
  })

  it('normalizes quota and rate-limit provider failures without recording submitted evidence', async () => {
    const fetchImpl = vi.fn(() => response({
      error: {
        code: 403,
        message: 'Quota exceeded.',
        errors: [{ reason: 'quotaExceeded' }],
      },
    }, 403))

    const result = await submitYouTubeCommentReply({
      comment: approvedComment,
      config: activeConfig,
      canonicalCapability: activeCanonicalCapability,
      fetchImpl: asFetch(fetchImpl),
      env: { [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      now: () => new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(result).toMatchObject({
      ok: false,
      blocked: false,
      status: 'failed',
      providerReplyId: null,
      submittedAt: null,
      error: expect.objectContaining({ code: 'quota_or_rate_limited', reason: 'quotaExceeded' }),
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('normalizes provider auth and insufficient-permission failures', async () => {
    const fetchImpl = vi.fn(() => response({
      error: {
        code: 401,
        message: 'Invalid Credentials',
        errors: [{ reason: 'authError' }],
      },
    }, 401))

    const result = await submitYouTubeCommentReply({
      comment: approvedComment,
      config: activeConfig,
      canonicalCapability: activeCanonicalCapability,
      fetchImpl: asFetch(fetchImpl),
      env: { [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      now: () => new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(result.error).toMatchObject({ code: 'token_expired', reason: 'authError' })

    fetchImpl.mockResolvedValueOnce(await response({
      error: {
        code: 403,
        message: 'Request had insufficient authentication scopes.',
        errors: [{ reason: 'insufficientPermissions' }],
      },
    }, 403))

    const insufficient = await submitYouTubeCommentReply({
      comment: approvedComment,
      config: activeConfig,
      canonicalCapability: activeCanonicalCapability,
      fetchImpl: asFetch(fetchImpl),
      env: { [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      now: () => new Date('2026-08-13T12:05:00.000Z'),
    })

    expect(insufficient.error).toMatchObject({ code: 'insufficient_scope', reason: 'insufficientPermissions' })
  })
})
