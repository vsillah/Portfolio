import type { SocialPlatform } from './social-content'
import {
  submitYouTubeCommentReply,
  YOUTUBE_REPLY_PROVIDER,
  type YouTubeReplyCanonicalCapability,
  type YouTubeReplyCommentRow,
  type YouTubeReplyConfig,
  type YouTubeReplyRequest,
} from './youtube-comment-reply-readiness'

type FetchLike = typeof fetch

export type CommentReplySubmissionBlocker = {
  code: string
  message: string
  recoveryAction: string
}

export type CommentReplySubmissionProviderError = {
  code: string
  message: string
  status?: number
  reason?: string
}

export type CommentReplySubmissionRequest = YouTubeReplyRequest

export type CommentReplySubmissionResult = {
  ok: boolean
  blocked: boolean
  status: 'blocked' | 'submitted' | 'failed'
  providerReplyId: string | null
  submittedAt: string | null
  blockers: CommentReplySubmissionBlocker[]
  error: CommentReplySubmissionProviderError | null
  request: CommentReplySubmissionRequest | null
}

export type CommentReplySubmissionContext = {
  comment: Record<string, unknown>
  youtube?: {
    config?: YouTubeReplyConfig | null
    canonicalCapability?: YouTubeReplyCanonicalCapability | null
  }
  fetchImpl?: FetchLike
  env?: Partial<NodeJS.ProcessEnv>
  now?: () => Date
}

export type CommentReplySubmitAdapter = {
  platform: SocialPlatform | string
  provider: string
  concreteProviderWrite: boolean
  submitReply: (context: CommentReplySubmissionContext) => Promise<CommentReplySubmissionResult>
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function unsupportedProviderResult(platform: string): CommentReplySubmissionResult {
  const label = platform === 'tiktok'
    ? 'TikTok'
    : platform === 'x'
      ? 'X'
      : platform.charAt(0).toUpperCase() + platform.slice(1)

  return {
    ok: false,
    blocked: true,
    status: 'blocked',
    providerReplyId: null,
    submittedAt: null,
    blockers: [{
      code: `${platform || 'unknown'}_reply_submission_unsupported`,
      message: `${label} provider reply submission is not available from Portfolio.`,
      recoveryAction: 'Use the provider permalink or manual channel workflow, then return to Portfolio to record the local decision.',
    }],
    error: null,
    request: null,
  }
}

function createUnsupportedAdapter(platform: string, provider: string): CommentReplySubmitAdapter {
  return {
    platform,
    provider,
    concreteProviderWrite: false,
    submitReply: async () => unsupportedProviderResult(platform),
  }
}

export function createCommentReplySubmitAdapter(input: {
  platform?: string | null
  provider?: string | null
}): CommentReplySubmitAdapter {
  const platform = asString(input.platform) ?? 'unknown'
  const provider = asString(input.provider) ?? 'manual'

  if (platform === 'youtube' && provider === YOUTUBE_REPLY_PROVIDER) {
    return {
      platform,
      provider,
      concreteProviderWrite: true,
      submitReply: async (context) => submitYouTubeCommentReply({
        comment: context.comment as YouTubeReplyCommentRow,
        config: context.youtube?.config,
        canonicalCapability: context.youtube?.canonicalCapability,
        fetchImpl: context.fetchImpl,
        env: context.env,
        now: context.now,
      }),
    }
  }

  return createUnsupportedAdapter(platform, provider)
}

export async function submitCommentProviderReply(context: CommentReplySubmissionContext): Promise<CommentReplySubmissionResult> {
  const adapter = createCommentReplySubmitAdapter({
    platform: asString(context.comment.platform),
    provider: asString(context.comment.provider),
  })
  return adapter.submitReply(context)
}
