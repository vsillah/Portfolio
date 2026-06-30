/**
 * Instagram Publishing Module
 *
 * Uses the Instagram Graph API Content Publishing flow. The module is gated by
 * social_content_config and only submits when a public media URL is present.
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { PublishStatus, SocialPlatform } from '@/lib/social-content'

export interface InstagramPublishPayload {
  contentId: string
  postText: string
  ctaText?: string | null
  ctaUrl?: string | null
  hashtags?: string[] | null
  imageUrl?: string | null
  videoUrl?: string | null
  carouselSlideUrls?: string[] | null
}

export interface InstagramPublishResult {
  success: boolean
  platformPostId?: string
  platformPostUrl?: string
  status?: PublishStatus
  error?: string
}

interface InstagramCredentials {
  access_token?: string
  ig_user_id?: string
  instagram_user_id?: string
  business_account_id?: string
}

interface InstagramSettings {
  graph_api_version?: string
  share_reels_to_feed?: boolean
  max_video_publish_poll_attempts?: number
  video_publish_poll_delay_ms?: number
}

async function getInstagramConfig(): Promise<{
  credentials: InstagramCredentials
  settings: InstagramSettings
} | null> {
  const admin = supabaseAdmin
  if (!admin) return null

  const { data } = await admin
    .from('social_content_config')
    .select('credentials, settings, is_active')
    .eq('platform', 'instagram')
    .single()

  if (!data || !data.is_active) return null

  return {
    credentials: data.credentials as InstagramCredentials,
    settings: data.settings as InstagramSettings,
  }
}

async function updatePublishStatus(
  contentId: string,
  platform: SocialPlatform,
  status: PublishStatus,
  extra?: { platform_post_id?: string; platform_post_url?: string; error_message?: string }
) {
  const admin = supabaseAdmin
  if (!admin) return

  await admin
    .from('social_content_publishes')
    .update({
      status,
      ...(status === 'published' ? { published_at: new Date().toISOString() } : {}),
      ...extra,
    })
    .eq('content_id', contentId)
    .eq('platform', platform)
}

function buildCaption(payload: InstagramPublishPayload) {
  const parts = [payload.postText]
  if (payload.ctaText) parts.push(payload.ctaText)
  if (payload.ctaUrl) parts.push(payload.ctaUrl)
  if (payload.hashtags?.length) {
    parts.push(payload.hashtags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' '))
  }
  return parts.filter(Boolean).join('\n\n')
}

function graphUrl(apiVersion: string, path: string) {
  return `https://graph.facebook.com/${apiVersion}/${path}`
}

async function postGraph(apiVersion: string, path: string, params: Record<string, string | boolean>) {
  const body = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => body.set(key, String(value)))

  const response = await fetch(graphUrl(apiVersion, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const text = await response.text()
  const data = parseJson(text)

  if (!response.ok) {
    const message = typeof data.error === 'object' && data.error && 'message' in data.error
      ? String((data.error as { message?: unknown }).message)
      : `Instagram API error (${response.status})`
    throw new Error(message)
  }

  return data
}

async function getGraph(apiVersion: string, path: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams(params)
  const response = await fetch(`${graphUrl(apiVersion, path)}?${searchParams.toString()}`)
  const text = await response.text()
  const data = parseJson(text)

  if (!response.ok) {
    const message = typeof data.error === 'object' && data.error && 'message' in data.error
      ? String((data.error as { message?: unknown }).message)
      : `Instagram API error (${response.status})`
    throw new Error(message)
  }

  return data
}

function parseJson(text: string): Record<string, unknown> {
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createImageContainer(
  apiVersion: string,
  igUserId: string,
  accessToken: string,
  imageUrl: string,
  caption: string,
  isCarouselItem = false,
) {
  const data = await postGraph(apiVersion, `${igUserId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: accessToken,
    ...(isCarouselItem ? { is_carousel_item: true } : {}),
  })
  return typeof data.id === 'string' ? data.id : null
}

async function createReelContainer(
  apiVersion: string,
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string,
  shareToFeed: boolean,
) {
  const data = await postGraph(apiVersion, `${igUserId}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    share_to_feed: shareToFeed,
    access_token: accessToken,
  })
  return typeof data.id === 'string' ? data.id : null
}

async function createCarouselContainer(
  apiVersion: string,
  igUserId: string,
  accessToken: string,
  childContainerIds: string[],
  caption: string,
) {
  const data = await postGraph(apiVersion, `${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: childContainerIds.join(','),
    caption,
    access_token: accessToken,
  })
  return typeof data.id === 'string' ? data.id : null
}

async function publishContainer(apiVersion: string, igUserId: string, accessToken: string, creationId: string) {
  const data = await postGraph(apiVersion, `${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  })
  return typeof data.id === 'string' ? data.id : null
}

async function waitForVideoContainer(
  apiVersion: string,
  accessToken: string,
  creationId: string,
  settings: InstagramSettings,
) {
  const attempts = settings.max_video_publish_poll_attempts ?? 5
  const delayMs = settings.video_publish_poll_delay_ms ?? 2000

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const data = await getGraph(apiVersion, creationId, {
      fields: 'status_code',
      access_token: accessToken,
    })
    const statusCode = typeof data.status_code === 'string' ? data.status_code : null
    if (statusCode === 'FINISHED' || statusCode === 'PUBLISHED') return
    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      throw new Error(`Instagram Reel container ${statusCode.toLowerCase()}`)
    }
    if (attempt < attempts - 1) await sleep(delayMs)
  }

  throw new Error('Instagram Reel container was not ready for publish')
}

export async function publishToInstagram(payload: InstagramPublishPayload): Promise<InstagramPublishResult> {
  const config = await getInstagramConfig()
  if (!config) {
    const error = 'Instagram is not connected or inactive'
    await updatePublishStatus(payload.contentId, 'instagram', 'failed', { error_message: error })
    return { success: false, error }
  }

  const accessToken = config.credentials.access_token
  const igUserId = config.credentials.ig_user_id
    || config.credentials.instagram_user_id
    || config.credentials.business_account_id
  const apiVersion = config.settings.graph_api_version || 'v20.0'

  if (!accessToken || !igUserId) {
    const error = 'Instagram credentials incomplete — missing access token or Instagram business user ID'
    await updatePublishStatus(payload.contentId, 'instagram', 'failed', { error_message: error })
    return { success: false, error }
  }

  const carouselUrls = payload.carouselSlideUrls?.filter(Boolean) ?? []
  const hasCarousel = carouselUrls.length > 1
  const hasMedia = hasCarousel || Boolean(payload.imageUrl || payload.videoUrl)
  if (!hasMedia) {
    const error = 'Instagram publishing requires an image, carousel images, or a Reel video URL'
    await updatePublishStatus(payload.contentId, 'instagram', 'failed', { error_message: error })
    return { success: false, error }
  }

  await updatePublishStatus(payload.contentId, 'instagram', 'publishing')

  try {
    const caption = buildCaption(payload)
    let creationId: string | null = null

    if (payload.videoUrl) {
      creationId = await createReelContainer(
        apiVersion,
        igUserId,
        accessToken,
        payload.videoUrl,
        caption,
        config.settings.share_reels_to_feed ?? true,
      )
      if (creationId) {
        await waitForVideoContainer(apiVersion, accessToken, creationId, config.settings)
      }
    } else if (hasCarousel) {
      const childContainerIds = await Promise.all(
        carouselUrls.map((url) => createImageContainer(apiVersion, igUserId, accessToken, url, caption, true))
      )
      const validChildren = childContainerIds.filter((id): id is string => Boolean(id))
      if (validChildren.length !== carouselUrls.length) {
        throw new Error('Instagram carousel media container creation failed')
      }
      creationId = await createCarouselContainer(apiVersion, igUserId, accessToken, validChildren, caption)
    } else if (payload.imageUrl) {
      creationId = await createImageContainer(apiVersion, igUserId, accessToken, payload.imageUrl, caption)
    }

    if (!creationId) throw new Error('Instagram media container creation failed')

    const platformPostId = await publishContainer(apiVersion, igUserId, accessToken, creationId)
    if (!platformPostId) throw new Error('Instagram media publish failed')

    await updatePublishStatus(payload.contentId, 'instagram', 'published', {
      platform_post_id: platformPostId,
    })

    return { success: true, status: 'published', platformPostId }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error during Instagram publish'
    console.error('[Instagram] Publish error:', err)
    await updatePublishStatus(payload.contentId, 'instagram', 'failed', { error_message: error })
    return { success: false, error }
  }
}
