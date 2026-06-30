/**
 * Facebook Publishing Module
 *
 * Publishes to a configured Facebook Page after the human submission gate.
 * Supports text-only Page feed posts, image posts, and video URL uploads.
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { PublishStatus, SocialPlatform } from '@/lib/social-content'

export interface FacebookPublishPayload {
  contentId: string
  postText: string
  ctaText?: string | null
  ctaUrl?: string | null
  hashtags?: string[] | null
  imageUrl?: string | null
  videoUrl?: string | null
}

export interface FacebookPublishResult {
  success: boolean
  platformPostId?: string
  platformPostUrl?: string
  status?: PublishStatus
  error?: string
}

interface FacebookCredentials {
  access_token?: string
  page_access_token?: string
  page_id?: string
}

interface FacebookSettings {
  graph_api_version?: string
  default_published?: boolean
}

async function getFacebookConfig(): Promise<{
  credentials: FacebookCredentials
  settings: FacebookSettings
} | null> {
  const admin = supabaseAdmin
  if (!admin) return null

  const { data } = await admin
    .from('social_content_config')
    .select('credentials, settings, is_active')
    .eq('platform', 'facebook')
    .single()

  if (!data || !data.is_active) return null

  return {
    credentials: data.credentials as FacebookCredentials,
    settings: data.settings as FacebookSettings,
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

function buildMessage(payload: FacebookPublishPayload) {
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

function parseJson(text: string): Record<string, unknown> {
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function postGraph(apiVersion: string, path: string, params: Record<string, string | boolean>) {
  const body = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => body.set(key, String(value)))

  const response = await fetch(graphUrl(apiVersion, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = parseJson(await response.text())

  if (!response.ok) {
    const message = typeof data.error === 'object' && data.error && 'message' in data.error
      ? String((data.error as { message?: unknown }).message)
      : `Facebook API error (${response.status})`
    throw new Error(message)
  }

  return data
}

function platformPostUrl(pageId: string, postId: string) {
  return `https://www.facebook.com/${pageId}/posts/${postId}`
}

export async function publishToFacebook(payload: FacebookPublishPayload): Promise<FacebookPublishResult> {
  const config = await getFacebookConfig()
  if (!config) {
    const error = 'Facebook is not connected or inactive'
    await updatePublishStatus(payload.contentId, 'facebook', 'failed', { error_message: error })
    return { success: false, error }
  }

  const accessToken = config.credentials.page_access_token || config.credentials.access_token
  const pageId = config.credentials.page_id
  const apiVersion = config.settings.graph_api_version || 'v20.0'

  if (!accessToken || !pageId) {
    const error = 'Facebook credentials incomplete — missing Page access token or Page ID'
    await updatePublishStatus(payload.contentId, 'facebook', 'failed', { error_message: error })
    return { success: false, error }
  }

  await updatePublishStatus(payload.contentId, 'facebook', 'publishing')

  try {
    const message = buildMessage(payload)
    let data: Record<string, unknown>

    if (payload.videoUrl) {
      data = await postGraph(apiVersion, `${pageId}/videos`, {
        file_url: payload.videoUrl,
        description: message,
        published: config.settings.default_published ?? true,
        access_token: accessToken,
      })
    } else if (payload.imageUrl) {
      data = await postGraph(apiVersion, `${pageId}/photos`, {
        url: payload.imageUrl,
        caption: message,
        published: config.settings.default_published ?? true,
        access_token: accessToken,
      })
    } else {
      data = await postGraph(apiVersion, `${pageId}/feed`, {
        message,
        published: config.settings.default_published ?? true,
        access_token: accessToken,
      })
    }

    const platformPostId = typeof data.post_id === 'string'
      ? data.post_id
      : typeof data.id === 'string'
        ? data.id
        : null

    if (!platformPostId) throw new Error('Facebook publish response missing post ID')

    const url = platformPostUrl(pageId, platformPostId)
    await updatePublishStatus(payload.contentId, 'facebook', 'published', {
      platform_post_id: platformPostId,
      platform_post_url: url,
    })

    return {
      success: true,
      status: 'published',
      platformPostId,
      platformPostUrl: url,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error during Facebook publish'
    console.error('[Facebook] Publish error:', err)
    await updatePublishStatus(payload.contentId, 'facebook', 'failed', { error_message: error })
    return { success: false, error }
  }
}
