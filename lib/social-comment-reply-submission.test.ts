import { describe, expect, it, vi } from 'vitest'
import {
  META_COMMENT_REPLY_SUBMISSION_ENV,
  META_FACEBOOK_GRAPH_BASE_URL,
  META_INSTAGRAM_GRAPH_BASE_URL,
  META_REPLY_PROVIDER,
  createCommentReplySubmitAdapter,
  submitCommentProviderReply,
} from './social-comment-reply-submission'
import { YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV } from './youtube-comment-reply-readiness'
import { YOUTUBE_FORCE_SSL_SCOPE } from './youtube-oauth'

const approvedYouTubeComment = {
  id: 'comment-row-1',
  publish_id: 'publish-1',
  content_id: 'content-1',
  platform: 'youtube',
  provider: 'youtube_data_api',
  provider_comment_id: 'UgzcTopLevel1',
  provider_parent_comment_id: null,
  response_approval_state: 'approved',
  reply_submission_state: 'approved',
  approved_reply_text: 'Appreciate you watching.',
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

const youtubeConfig = {
  is_active: true,
  credentials: {
    access_token: 'youtube-access-token',
    refresh_token: 'youtube-refresh-token',
    expires_in: 3600,
    token_obtained_at: '2026-08-21T12:00:00.000Z',
    scope: YOUTUBE_FORCE_SSL_SCOPE,
  },
  settings: {
    channel_id: 'channel-1',
  },
}

const youtubeCapability = {
  platform: 'youtube',
  provider: 'youtube_data_api',
  capability_status: 'verified',
  supports_reply_submission: true,
  external_submission_enabled: true,
  gate_notes: 'YouTube replies can be submitted after approval.',
}

const approvedMetaComment = {
  id: 'meta-comment-row-1',
  publish_id: 'meta-publish-1',
  content_id: 'content-1',
  platform: 'facebook',
  provider: META_REPLY_PROVIDER,
  provider_comment_id: '123456789_987654321',
  response_approval_state: 'approved',
  reply_submission_state: 'approved',
  approved_reply_text: 'Thanks for reaching out.',
  reply_provider_comment_id: null,
  reply_submitted_at: null,
  provider_capability: {
    capability_status: 'verified',
    supports_reply_submission: true,
    external_submission_enabled: true,
  },
}

const facebookMetaConfig = {
  is_active: true,
  credentials: {
    page_access_token: 'facebook-page-token',
    expires_in: 3600,
    token_obtained_at: '2026-08-21T12:00:00.000Z',
    scope: 'pages_manage_engagement pages_read_user_content',
    tasks: ['PROFILE_PLUS_MODERATE'],
  },
  settings: {
    graph_api_version: 'v20.0',
    page_id: '123456789',
    facebook_comment_reply_capability_verified: true,
  },
}

const instagramMetaConfig = {
  is_active: true,
  credentials: {
    access_token: 'instagram-access-token',
    expires_in: 3600,
    token_obtained_at: '2026-08-21T12:00:00.000Z',
    scope: 'instagram_basic instagram_manage_comments pages_read_engagement',
  },
  settings: {
    graph_api_version: 'v20.0',
    instagram_business_account_id: '17841400000000000',
    instagram_comment_reply_capability_verified: true,
  },
}

const facebookMetaCapability = {
  platform: 'facebook',
  provider: META_REPLY_PROVIDER,
  capability_status: 'verified',
  supports_reply_submission: true,
  external_submission_enabled: true,
  gate_notes: 'Facebook replies can be submitted after Meta approval.',
}

const instagramMetaCapability = {
  ...facebookMetaCapability,
  platform: 'instagram',
  gate_notes: 'Instagram replies can be submitted after Meta approval.',
}

describe('comment reply provider submission adapter', () => {
  it('selects YouTube and gated Meta providers as concrete provider write adapters', () => {
    expect(createCommentReplySubmitAdapter({
      platform: 'youtube',
      provider: 'youtube_data_api',
    })).toMatchObject({
      platform: 'youtube',
      provider: 'youtube_data_api',
      concreteProviderWrite: true,
    })

    expect(createCommentReplySubmitAdapter({
      platform: 'facebook',
      provider: META_REPLY_PROVIDER,
    })).toMatchObject({
      platform: 'facebook',
      provider: META_REPLY_PROVIDER,
      concreteProviderWrite: true,
    })

    expect(createCommentReplySubmitAdapter({
      platform: 'instagram',
      provider: META_REPLY_PROVIDER,
    })).toMatchObject({
      platform: 'instagram',
      provider: META_REPLY_PROVIDER,
      concreteProviderWrite: true,
    })

    expect(createCommentReplySubmitAdapter({
      platform: 'linkedin',
      provider: 'linkedin_organization',
    })).toMatchObject({
      platform: 'linkedin',
      provider: 'linkedin_organization',
      concreteProviderWrite: false,
    })
  })

  it('submits a mocked YouTube reply only when all provider gates pass', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ id: 'reply-1' }), { status: 200 })))

    const result = await submitCommentProviderReply({
      comment: approvedYouTubeComment,
      youtube: {
        config: youtubeConfig,
        canonicalCapability: youtubeCapability,
      },
      fetchImpl,
      env: {
        [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true',
      },
      now: () => new Date('2026-08-21T12:05:00.000Z'),
    })

    expect(result).toMatchObject({
      ok: true,
      blocked: false,
      status: 'submitted',
      providerReplyId: 'reply-1',
      submittedAt: '2026-08-21T12:05:00.000Z',
      blockers: [],
      error: null,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://www.googleapis.com/youtube/v3/comments?part=snippet')
  })

  it.each([
    ['linkedin', 'linkedin_organization'],
    ['x', 'x_api'],
    ['tiktok', 'tiktok_api'],
  ])('keeps %s reply submission explicit unsupported/manual with no provider call', async (platform, provider) => {
    const fetchImpl = vi.fn<typeof fetch>()

    const result = await submitCommentProviderReply({
      comment: {
        id: `${platform}-comment-1`,
        platform,
        provider,
        response_approval_state: 'approved',
        reply_submission_state: 'approved',
        approved_reply_text: 'Approved reply.',
      },
      fetchImpl,
      env: {
        [YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV]: 'true',
      },
    })

    expect(result).toMatchObject({
      ok: false,
      blocked: true,
      status: 'blocked',
      providerReplyId: null,
      submittedAt: null,
      request: null,
      error: null,
      blockers: [expect.objectContaining({
        code: `${platform}_reply_submission_unsupported`,
      })],
    })
    expect(result.blockers[0].message).toContain('provider reply submission is not available')
    expect(result.blockers[0].recoveryAction).toContain('manual channel workflow')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['facebook', facebookMetaConfig, facebookMetaCapability],
    ['instagram', instagramMetaConfig, instagramMetaCapability],
  ] as const)('keeps %s blocked when canonical capabilities are false', async (platform, config, canonicalCapability) => {
    const fetchImpl = vi.fn<typeof fetch>()

    const result = await submitCommentProviderReply({
      comment: {
        ...approvedMetaComment,
        platform,
        provider_capability: {
          capability_status: 'verified',
          supports_reply_submission: false,
          external_submission_enabled: false,
        },
      },
      meta: {
        config,
        canonicalCapability: {
          ...canonicalCapability,
          supports_reply_submission: false,
          external_submission_enabled: false,
        },
      },
      fetchImpl,
      env: {
        [META_COMMENT_REPLY_SUBMISSION_ENV]: 'true',
      },
    })

    expect(result).toMatchObject({
      ok: false,
      blocked: true,
      status: 'blocked',
      providerReplyId: null,
      submittedAt: null,
      request: null,
      error: null,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'provider_reply_submission_unsupported' }),
        expect.objectContaining({ code: 'provider_external_submission_disabled' }),
        expect.objectContaining({ code: 'canonical_reply_submission_unsupported' }),
        expect.objectContaining({ code: 'canonical_external_submission_disabled' }),
      ]),
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['facebook', facebookMetaConfig, facebookMetaCapability],
    ['instagram', instagramMetaConfig, instagramMetaCapability],
  ] as const)('does not call %s provider unless every fail-closed gate passes', async (platform, config, canonicalCapability) => {
    const fetchImpl = vi.fn<typeof fetch>()
    const baseComment = { ...approvedMetaComment, platform }

    for (const context of [
      {
        comment: baseComment,
        meta: { config, canonicalCapability },
        env: {},
      },
      {
        comment: {
          ...baseComment,
          provider_capability: {
            capability_status: 'manual',
            supports_reply_submission: true,
            external_submission_enabled: true,
          },
        },
        meta: { config, canonicalCapability },
        env: { [META_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      },
      {
        comment: baseComment,
        meta: { config, canonicalCapability: { ...canonicalCapability, capability_status: 'manual' } },
        env: { [META_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      },
      {
        comment: { ...baseComment, response_approval_state: 'pending' },
        meta: { config, canonicalCapability },
        env: { [META_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      },
      {
        comment: { ...baseComment, provider_comment_id: null },
        meta: { config, canonicalCapability },
        env: { [META_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      },
      {
        comment: baseComment,
        meta: { config: { ...config, credentials: null }, canonicalCapability },
        env: { [META_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      },
      {
        comment: baseComment,
        meta: { config: { ...config, credentials: { ...config.credentials, scope: '' } }, canonicalCapability },
        env: { [META_COMMENT_REPLY_SUBMISSION_ENV]: 'true' },
      },
    ]) {
      const result = await submitCommentProviderReply({
        ...context,
        fetchImpl,
      })

      expect(result).toMatchObject({
        ok: false,
        blocked: true,
        status: 'blocked',
        request: null,
      })
    }

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['facebook', facebookMetaConfig, facebookMetaCapability, META_FACEBOOK_GRAPH_BASE_URL, '/comments'],
    ['instagram', instagramMetaConfig, instagramMetaCapability, META_INSTAGRAM_GRAPH_BASE_URL, '/replies'],
  ] as const)('constructs the intended mocked %s Graph reply request when all gates pass', async (platform, config, canonicalCapability, baseUrl, edge) => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ id: `${platform}-reply-1` }), { status: 200 })))

    const result = await submitCommentProviderReply({
      comment: { ...approvedMetaComment, platform },
      meta: {
        config,
        canonicalCapability,
      },
      fetchImpl,
      env: {
        [META_COMMENT_REPLY_SUBMISSION_ENV]: 'true',
      },
      now: () => new Date('2026-08-21T12:05:00.000Z'),
    })

    expect(result).toMatchObject({
      ok: true,
      blocked: false,
      status: 'submitted',
      providerReplyId: `${platform}-reply-1`,
      submittedAt: '2026-08-21T12:05:00.000Z',
      blockers: [],
      error: null,
      request: expect.objectContaining({
        platform,
        parentId: approvedMetaComment.provider_comment_id,
        message: approvedMetaComment.approved_reply_text,
      }),
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0][0])).toBe(`${baseUrl}/v20.0/${encodeURIComponent(approvedMetaComment.provider_comment_id)}${edge}`)
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: `Bearer ${platform === 'facebook' ? 'facebook-page-token' : 'instagram-access-token'}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }),
    })
    expect(String(fetchImpl.mock.calls[0][1]?.body)).toBe('message=Thanks+for+reaching+out.')
  })
})
