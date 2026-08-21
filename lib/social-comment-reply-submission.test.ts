import { describe, expect, it, vi } from 'vitest'
import {
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

describe('comment reply provider submission adapter', () => {
  it('selects YouTube as the only concrete provider write adapter', () => {
    expect(createCommentReplySubmitAdapter({
      platform: 'youtube',
      provider: 'youtube_data_api',
    })).toMatchObject({
      platform: 'youtube',
      provider: 'youtube_data_api',
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
    ['facebook', 'meta_graph'],
    ['instagram', 'meta_graph'],
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
})
