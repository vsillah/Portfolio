/**
 * YouTube Publishing Module
 *
 * Uploads a final video asset to YouTube Data API after the human submission
 * gate. This module does not render, generate media, schedule, or publish
 * without an active social_content_config row and a final video URL.
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { PublishStatus, SocialPlatform } from '@/lib/social-content'

export interface YouTubePublishPayload {
  contentId: string
  postText: string
  ctaText?: string | null
  ctaUrl?: string | null
  hashtags?: string[] | null
  videoUrl?: string | null
  youtubeTitle?: string | null
  youtubeDescription?: string | null
}

export interface YouTubePublishResult {
  success: boolean
  platformPostId?: string
  platformPostUrl?: string
  status?: PublishStatus
  error?: string
}

interface YouTubeCredentials {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_obtained_at?: string
}

interface YouTubeSettings {
  default_privacy?: 'private' | 'unlisted' | 'public'
  category_id?: string
  made_for_kids?: boolean
  notify_subscribers?: boolean
  max_download_bytes?: number
}

async function getYouTubeConfig(): Promise<{
  credentials: YouTubeCredentials
  settings: YouTubeSettings
} | null> {
  const admin = supabaseAdmin
  if (!admin) return null

  const { data } = await admin
    .from('social_content_config')
    .select('credentials, settings, is_active')
    .eq('platform', 'youtube')
    .single()

  if (!data || !data.is_active) return null

  return {
    credentials: data.credentials as YouTubeCredentials,
    settings: data.settings as YouTubeSettings,
  }
}

async function updateYouTubeCredentials(credentials: YouTubeCredentials) {
  const admin = supabaseAdmin
  if (!admin) return

  await admin
    .from('social_content_config')
    .update({ credentials })
    .eq('platform', 'youtube')
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

function isTokenExpired(credentials: YouTubeCredentials, bufferMs = 10 * 60 * 1000) {
  if (!credentials.token_obtained_at || !credentials.expires_in) return false
  const obtainedAt = new Date(credentials.token_obtained_at).getTime()
  const expiresAt = obtainedAt + credentials.expires_in * 1000
  return Date.now() + bufferMs >= expiresAt
}

async function refreshYouTubeToken(credentials: YouTubeCredentials): Promise<{
  success: boolean
  credentials?: YouTubeCredentials
  error?: string
}> {
  if (!credentials.refresh_token) {
    return { success: false, error: 'YouTube token expired — reconnect YouTube before publishing' }
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return { success: false, error: 'YouTube OAuth client credentials are not configured' }
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json() as {
    access_token?: string
    expires_in?: number
    error_description?: string
  }

  if (!response.ok || !data.access_token) {
    return {
      success: false,
      error: data.error_description || 'YouTube token refresh failed — reconnect YouTube before publishing',
    }
  }

  const updated = {
    ...credentials,
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_obtained_at: new Date().toISOString(),
  }
  await updateYouTubeCredentials(updated)
  return { success: true, credentials: updated }
}

function buildTitle(payload: YouTubePublishPayload) {
  const source = payload.youtubeTitle || payload.ctaText || payload.postText
  return source.replace(/\s+/g, ' ').trim().slice(0, 100) || 'AmaduTown video'
}

function buildDescription(payload: YouTubePublishPayload) {
  const parts = [
    payload.youtubeDescription || payload.postText,
    payload.ctaText,
    payload.ctaUrl,
    payload.hashtags?.length
      ? payload.hashtags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' ')
      : null,
  ]
  return parts.filter(Boolean).join('\n\n')
}

async function downloadVideo(videoUrl: string, maxBytes: number) {
  const response = await fetch(videoUrl)
  if (!response.ok) throw new Error(`Failed to download YouTube video asset (${response.status})`)

  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength && contentLength > maxBytes) {
    throw new Error(`YouTube video asset exceeds configured upload limit (${maxBytes} bytes)`)
  }

  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength > maxBytes) {
    throw new Error(`YouTube video asset exceeds configured upload limit (${maxBytes} bytes)`)
  }

  return {
    arrayBuffer,
    contentType: response.headers.get('content-type') || 'video/mp4',
  }
}

async function uploadVideo({
  accessToken,
  payload,
  settings,
}: {
  accessToken: string
  payload: YouTubePublishPayload
  settings: YouTubeSettings
}) {
  if (!payload.videoUrl) throw new Error('YouTube publishing requires a final video URL')

  const maxBytes = settings.max_download_bytes ?? 512 * 1024 * 1024
  const video = await downloadVideo(payload.videoUrl, maxBytes)
  const metadata = {
    snippet: {
      title: buildTitle(payload),
      description: buildDescription(payload),
      categoryId: settings.category_id || '22',
      tags: payload.hashtags?.map((tag) => tag.replace(/^#/, '')).filter(Boolean) ?? [],
    },
    status: {
      privacyStatus: settings.default_privacy || 'private',
      selfDeclaredMadeForKids: settings.made_for_kids ?? false,
    },
  }

  const formData = new FormData()
  formData.set('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  formData.set('media', new Blob([video.arrayBuffer], { type: video.contentType }), 'video.mp4')

  const notifySubscribers = settings.notify_subscribers ?? false
  const response = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status&notifySubscribers=${notifySubscribers}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    },
  )

  const data = await response.json() as { id?: string; error?: { message?: string } }
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || `YouTube upload failed (${response.status})`)
  }

  return data.id
}

export async function publishToYouTube(payload: YouTubePublishPayload): Promise<YouTubePublishResult> {
  const config = await getYouTubeConfig()
  if (!config) {
    const error = 'YouTube is not connected or inactive'
    await updatePublishStatus(payload.contentId, 'youtube', 'failed', { error_message: error })
    return { success: false, error }
  }

  let { credentials } = config
  const { settings } = config

  if (!credentials.access_token) {
    const error = 'YouTube credentials incomplete — missing access token'
    await updatePublishStatus(payload.contentId, 'youtube', 'failed', { error_message: error })
    return { success: false, error }
  }

  if (isTokenExpired(credentials)) {
    const refresh = await refreshYouTubeToken(credentials)
    if (!refresh.success || !refresh.credentials) {
      await updatePublishStatus(payload.contentId, 'youtube', 'failed', { error_message: refresh.error })
      return { success: false, error: refresh.error }
    }
    credentials = refresh.credentials
  }

  const accessToken = credentials.access_token
  if (!accessToken) {
    const error = 'YouTube credentials incomplete — missing refreshed access token'
    await updatePublishStatus(payload.contentId, 'youtube', 'failed', { error_message: error })
    return { success: false, error }
  }

  await updatePublishStatus(payload.contentId, 'youtube', 'publishing')

  try {
    const platformPostId = await uploadVideo({
      accessToken,
      payload,
      settings,
    })
    const platformPostUrl = `https://www.youtube.com/watch?v=${platformPostId}`

    await updatePublishStatus(payload.contentId, 'youtube', 'published', {
      platform_post_id: platformPostId,
      platform_post_url: platformPostUrl,
    })

    return {
      success: true,
      status: 'published',
      platformPostId,
      platformPostUrl,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error during YouTube publish'
    console.error('[YouTube] Publish error:', err)
    await updatePublishStatus(payload.contentId, 'youtube', 'failed', { error_message: error })
    return { success: false, error }
  }
}
