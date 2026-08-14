import { supabaseAdmin } from '@/lib/supabase'
import type { PublishStatus } from '@/lib/social-content'
import {
  isXAccessTokenStale,
  refreshXOAuthCredentials,
  type XOAuthCredentials,
} from '@/lib/x-oauth-refresh'

export interface XPublishPayload {
  contentId: string
  postText: string
  ctaText?: string | null
  ctaUrl?: string | null
  hashtags?: string[] | null
  ragContext?: Record<string, unknown> | null
}

export interface XPublishResult {
  success: boolean
  platformPostId?: string
  platformPostUrl?: string
  threadPostIds?: string[]
  threadPostUrls?: string[]
  error?: string
}

interface XSettings {
  api_base_url?: string
  profile_handle?: string
  max_post_length?: number
  thread_reply_enabled?: boolean
}

type XCreatePostResponse = {
  data?: {
    id?: string
    text?: string
  }
  title?: string
  detail?: string
  errors?: Array<{ message?: string; detail?: string }>
}

async function getXConfig(): Promise<{
  credentials: XOAuthCredentials
  settings: XSettings
} | null> {
  const admin = supabaseAdmin
  if (!admin) return null

  const { data } = await admin
    .from('social_content_config')
    .select('credentials, settings, is_active')
    .eq('platform', 'x')
    .single()

  if (!data || !data.is_active) return null

  return {
    credentials: data.credentials as XOAuthCredentials,
    settings: data.settings as XSettings,
  }
}

async function updatePublishStatus(
  contentId: string,
  status: PublishStatus,
  extra?: { platform_post_id?: string; platform_post_url?: string; error_message?: string },
) {
  const admin = supabaseAdmin
  if (!admin) return

  await admin
    .from('social_content_publishes')
    .update({
      status,
      ...(status === 'publishing' || status === 'published' ? { error_message: null } : {}),
      ...(status === 'published' ? { published_at: new Date().toISOString() } : {}),
      ...extra,
    })
    .eq('content_id', contentId)
    .eq('platform', 'x')
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeHandle(value: unknown) {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().replace(/^@/, '')
  return cleaned.length ? cleaned : null
}

function tweetUrl(handle: string | null, postId: string) {
  return handle
    ? `https://x.com/${handle}/status/${postId}`
    : `https://x.com/i/web/status/${postId}`
}

function normalizePostText(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim()
    : ''
}

function formatHashtag(value: string) {
  const tag = value.trim()
  if (!tag) return null
  return tag.startsWith('#') ? tag : `#${tag}`
}

function buildFallbackSinglePost(payload: XPublishPayload) {
  const parts = [payload.postText, payload.ctaText, payload.ctaUrl]
    .map(normalizePostText)
    .filter(Boolean)

  const hashtags = payload.hashtags
    ?.map(formatHashtag)
    .filter((tag): tag is string => Boolean(tag))
    .join(' ')

  if (hashtags) parts.push(hashtags)
  return normalizePostText(parts.join('\n\n'))
}

function threadPostsFromContext(ragContext: unknown) {
  const context = asRecord(ragContext)
  const candidates = [
    context?.x_thread_posts,
    context?.x_post_sequence,
    asRecord(context?.x_release)?.thread_posts,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const posts = candidate.map(normalizePostText).filter(Boolean)
    if (posts.length > 0) return posts
  }

  return []
}

export function buildXPostSequence(payload: XPublishPayload) {
  const threadPosts = threadPostsFromContext(payload.ragContext)
  if (threadPosts.length > 0) return threadPosts

  const single = buildFallbackSinglePost(payload)
  return single ? [single] : []
}

function validatePostSequence(posts: string[], maxPostLength: number) {
  if (!posts.length) return 'X publishing requires at least one approved post.'

  const tooLong = posts
    .map((post, index) => ({ post, index }))
    .find(({ post }) => post.length > maxPostLength)

  if (tooLong) {
    return `X post ${tooLong.index + 1} is ${tooLong.post.length} characters; maximum is ${maxPostLength}.`
  }

  return null
}

function parseXResponse(text: string): XCreatePostResponse {
  if (!text) return {}
  try {
    return JSON.parse(text) as XCreatePostResponse
  } catch {
    return {}
  }
}

function responseError(body: XCreatePostResponse, status: number) {
  return body.detail
    || body.title
    || body.errors?.find((error) => error.message || error.detail)?.message
    || body.errors?.find((error) => error.message || error.detail)?.detail
    || `X API error (${status})`
}

async function createXPost(input: {
  apiBaseUrl: string
  accessToken: string
  text: string
  replyToPostId?: string
}) {
  const response = await fetch(`${input.apiBaseUrl}/2/tweets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: input.text,
      ...(input.replyToPostId
        ? { reply: { in_reply_to_tweet_id: input.replyToPostId } }
        : {}),
    }),
  })
  const body = parseXResponse(await response.text())

  if (!response.ok) {
    return {
      ok: false as const,
      error: responseError(body, response.status),
    }
  }

  const id = body.data?.id
  if (!id) {
    return {
      ok: false as const,
      error: 'X API response missing post id.',
    }
  }

  return {
    ok: true as const,
    id,
  }
}

export async function publishToX(payload: XPublishPayload): Promise<XPublishResult> {
  const config = await getXConfig()
  if (!config) {
    const error = 'X is not connected or inactive'
    await updatePublishStatus(payload.contentId, 'failed', { error_message: error })
    return { success: false, error }
  }

  let credentials = config.credentials
  if (isXAccessTokenStale({ credentials })) {
    const admin = supabaseAdmin
    if (!admin) {
      const error = 'X token refresh requires Supabase admin access'
      await updatePublishStatus(payload.contentId, 'failed', { error_message: error })
      return { success: false, error }
    }
    const refresh = await refreshXOAuthCredentials({
      db: admin,
      credentials,
      fetchImpl: fetch,
      now: new Date(),
    })
    if (!refresh.refreshed || refresh.error) {
      const error = refresh.error?.message || 'X token refresh failed - reconnect X before publishing'
      await updatePublishStatus(payload.contentId, 'failed', { error_message: error })
      return { success: false, error }
    }
    credentials = refresh.credentials
  }

  const accessToken = credentials.access_token
  if (!accessToken) {
    const error = 'X credentials incomplete - missing user access token'
    await updatePublishStatus(payload.contentId, 'failed', { error_message: error })
    return { success: false, error }
  }

  const maxPostLength = Number.isFinite(config.settings.max_post_length)
    ? Number(config.settings.max_post_length)
    : 280
  const posts = buildXPostSequence(payload)
  const validationError = validatePostSequence(posts, maxPostLength)
  if (validationError) {
    await updatePublishStatus(payload.contentId, 'failed', { error_message: validationError })
    return { success: false, error: validationError }
  }

  if (posts.length > 1 && config.settings.thread_reply_enabled === false) {
    const error = 'X thread publishing is disabled in provider settings.'
    await updatePublishStatus(payload.contentId, 'failed', { error_message: error })
    return { success: false, error }
  }

  const apiBaseUrl = config.settings.api_base_url || 'https://api.x.com'
  const handle = normalizeHandle(config.settings.profile_handle)

  await updatePublishStatus(payload.contentId, 'publishing')

  const postedIds: string[] = []
  try {
    for (const post of posts) {
      const result = await createXPost({
        apiBaseUrl,
        accessToken,
        text: post,
        replyToPostId: postedIds.at(-1),
      })

      if (!result.ok) {
        const error = postedIds.length
          ? `${result.error} (${postedIds.length} X post(s) were already created before this failure.)`
          : result.error
        await updatePublishStatus(payload.contentId, 'failed', {
          error_message: error,
          platform_post_id: postedIds[0],
          platform_post_url: postedIds[0] ? tweetUrl(handle, postedIds[0]) : undefined,
        })
        return {
          success: false,
          error,
          threadPostIds: postedIds,
          threadPostUrls: postedIds.map((id) => tweetUrl(handle, id)),
        }
      }

      postedIds.push(result.id)
    }

    const firstPostId = postedIds[0]
    const firstPostUrl = tweetUrl(handle, firstPostId)
    await updatePublishStatus(payload.contentId, 'published', {
      platform_post_id: firstPostId,
      platform_post_url: firstPostUrl,
    })

    return {
      success: true,
      platformPostId: firstPostId,
      platformPostUrl: firstPostUrl,
      threadPostIds: postedIds,
      threadPostUrls: postedIds.map((id) => tweetUrl(handle, id)),
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error during X publish'
    console.error('[X] Publish error:', err)
    await updatePublishStatus(payload.contentId, 'failed', {
      error_message: error,
      platform_post_id: postedIds[0],
      platform_post_url: postedIds[0] ? tweetUrl(handle, postedIds[0]) : undefined,
    })
    return {
      success: false,
      error,
      threadPostIds: postedIds,
      threadPostUrls: postedIds.map((id) => tweetUrl(handle, id)),
    }
  }
}
