/**
 * TikTok Publishing Module
 *
 * Uses TikTok Content Posting API Direct Post with PULL_FROM_URL. The module
 * requires explicit creator-info confirmation and approved media URL settings
 * before it will submit anything to TikTok.
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { PublishStatus, SocialPlatform } from '@/lib/social-content'

export interface TikTokPublishPayload {
  contentId: string
  postText: string
  ctaText?: string | null
  ctaUrl?: string | null
  hashtags?: string[] | null
  videoUrl?: string | null
}

export interface TikTokPublishResult {
  success: boolean
  platformPostId?: string
  platformPostUrl?: string
  status?: PublishStatus
  error?: string
}

interface TikTokCredentials {
  access_token?: string
}

interface TikTokSettings {
  privacy_level?: string
  creator_info_confirmed?: boolean
  creator_info_confirmed_at?: string
  source_url_approved?: boolean
  approved_media_domains?: string[]
  disable_duet?: boolean
  disable_comment?: boolean
  disable_stitch?: boolean
  brand_content_toggle?: boolean
  brand_organic_toggle?: boolean
  is_aigc?: boolean
}

async function getTikTokConfig(): Promise<{
  credentials: TikTokCredentials
  settings: TikTokSettings
} | null> {
  const admin = supabaseAdmin
  if (!admin) return null

  const { data } = await admin
    .from('social_content_config')
    .select('credentials, settings, is_active')
    .eq('platform', 'tiktok')
    .single()

  if (!data || !data.is_active) return null

  return {
    credentials: data.credentials as TikTokCredentials,
    settings: data.settings as TikTokSettings,
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

function buildTitle(payload: TikTokPublishPayload) {
  const text = [payload.postText, payload.ctaText, payload.ctaUrl]
    .filter(Boolean)
    .join('\n\n')
  const tags = payload.hashtags?.length
    ? `\n\n${payload.hashtags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' ')}`
    : ''
  return `${text}${tags}`.trim().slice(0, 2200)
}

function mediaUrlApproved(videoUrl: string, settings: TikTokSettings) {
  if (settings.source_url_approved) return true
  if (!settings.approved_media_domains?.length) return false

  try {
    const hostname = new URL(videoUrl).hostname.toLowerCase()
    return settings.approved_media_domains.some((domain) => (
      hostname === domain.toLowerCase() || hostname.endsWith(`.${domain.toLowerCase()}`)
    ))
  } catch {
    return false
  }
}

function parseTikTokResponse(text: string): {
  data?: { publish_id?: string }
  error?: { message?: string }
} {
  if (!text) return {}
  try {
    return JSON.parse(text) as {
      data?: { publish_id?: string }
      error?: { message?: string }
    }
  } catch {
    return {}
  }
}

export async function publishToTikTok(payload: TikTokPublishPayload): Promise<TikTokPublishResult> {
  const config = await getTikTokConfig()
  if (!config) {
    const error = 'TikTok is not connected or inactive'
    await updatePublishStatus(payload.contentId, 'tiktok', 'failed', { error_message: error })
    return { success: false, error }
  }

  const accessToken = config.credentials.access_token
  if (!accessToken) {
    const error = 'TikTok credentials incomplete — missing access token'
    await updatePublishStatus(payload.contentId, 'tiktok', 'failed', { error_message: error })
    return { success: false, error }
  }

  if (!payload.videoUrl) {
    const error = 'TikTok publishing requires a final video URL'
    await updatePublishStatus(payload.contentId, 'tiktok', 'failed', { error_message: error })
    return { success: false, error }
  }

  if (!config.settings.creator_info_confirmed && !config.settings.creator_info_confirmed_at) {
    const error = 'TikTok creator info must be reviewed before Direct Post submission'
    await updatePublishStatus(payload.contentId, 'tiktok', 'failed', { error_message: error })
    return { success: false, error }
  }

  if (!mediaUrlApproved(payload.videoUrl, config.settings)) {
    const error = 'TikTok media URL domain is not approved for Direct Post URL ingestion'
    await updatePublishStatus(payload.contentId, 'tiktok', 'failed', { error_message: error })
    return { success: false, error }
  }

  await updatePublishStatus(payload.contentId, 'tiktok', 'publishing')

  try {
    const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: buildTitle(payload),
          privacy_level: config.settings.privacy_level || 'SELF_ONLY',
          disable_duet: config.settings.disable_duet ?? false,
          disable_comment: config.settings.disable_comment ?? false,
          disable_stitch: config.settings.disable_stitch ?? false,
          brand_content_toggle: config.settings.brand_content_toggle ?? false,
          brand_organic_toggle: config.settings.brand_organic_toggle ?? false,
          is_aigc: config.settings.is_aigc ?? true,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: payload.videoUrl,
        },
      }),
    })

    const body = parseTikTokResponse(await response.text())

    if (!response.ok) {
      const error = body.error?.message || `TikTok API error (${response.status})`
      await updatePublishStatus(payload.contentId, 'tiktok', 'failed', { error_message: error })
      return { success: false, error }
    }

    const platformPostId = body.data?.publish_id
    if (!platformPostId) {
      const error = 'TikTok publish response missing publish_id'
      await updatePublishStatus(payload.contentId, 'tiktok', 'failed', { error_message: error })
      return { success: false, error }
    }

    await updatePublishStatus(payload.contentId, 'tiktok', 'publishing', {
      platform_post_id: platformPostId,
    })

    return { success: true, status: 'publishing', platformPostId }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error during TikTok publish'
    console.error('[TikTok] Publish error:', err)
    await updatePublishStatus(payload.contentId, 'tiktok', 'failed', { error_message: error })
    return { success: false, error }
  }
}
