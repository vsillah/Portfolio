/**
 * LinkedIn Publishing Module
 *
 * Handles publishing text and image posts to LinkedIn via the UGC Post API.
 * Reads credentials from social_content_config. Supports:
 * - Text-only posts
 * - Text + image posts (2-step: register upload → binary upload → create post)
 * - Token expiry checking and refresh
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { SocialPlatform, PublishStatus } from '@/lib/social-content'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PublishPayload {
  contentId: string
  postText: string
  ctaText?: string | null
  ctaUrl?: string | null
  hashtags?: string[]
  imageUrl?: string | null
}

export interface PublishResult {
  success: boolean
  platformPostId?: string
  platformPostUrl?: string
  error?: string
}

interface LinkedInCredentials {
  access_token: string
  expires_in: number
  token_obtained_at: string
  person_urn: string
}

interface LinkedInSettings {
  author_urn: string
  post_visibility: string
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

async function getLinkedInConfig(): Promise<{
  credentials: LinkedInCredentials
  settings: LinkedInSettings
} | null> {
  const admin = supabaseAdmin
  if (!admin) return null

  const { data } = await admin
    .from('social_content_config')
    .select('credentials, settings, is_active')
    .eq('platform', 'linkedin')
    .single()

  if (!data || !data.is_active) return null
  return {
    credentials: data.credentials as unknown as LinkedInCredentials,
    settings: data.settings as unknown as LinkedInSettings,
  }
}

/**
 * Check if the LinkedIn token is expired or will expire within `bufferMs`.
 * LinkedIn tokens typically expire in 60 days.
 */
function isTokenExpired(credentials: LinkedInCredentials, bufferMs = 7 * 24 * 60 * 60 * 1000): boolean {
  if (!credentials.token_obtained_at || !credentials.expires_in) return true
  const obtainedAt = new Date(credentials.token_obtained_at).getTime()
  const expiresAt = obtainedAt + credentials.expires_in * 1000
  return Date.now() + bufferMs >= expiresAt
}

/**
 * Attempt to refresh the LinkedIn access token.
 * LinkedIn's refresh token flow requires the original refresh_token (if available)
 * or re-authorization. Since LinkedIn's v2 OAuth doesn't always provide refresh tokens,
 * this returns a clear error message when the token can't be refreshed automatically.
 */
async function refreshLinkedInToken(credentials: LinkedInCredentials): Promise<{
  success: boolean
  newToken?: string
  error?: string
}> {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return { success: false, error: 'LinkedIn client credentials not configured' }
  }

  // LinkedIn's token refresh uses the same endpoint with grant_type=refresh_token
  // but only works if the original auth included refresh_token scope
  const refreshToken = (credentials as unknown as Record<string, string>).refresh_token
  if (!refreshToken) {
    return {
      success: false,
      error: 'LinkedIn token expired — reconnect via Admin → Social Content (no refresh token available)',
    }
  }

  try {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[LinkedIn] Token refresh failed:', errText)
      return {
        success: false,
        error: 'LinkedIn token refresh failed — reconnect via Admin → Social Content',
      }
    }

    const data = await res.json()
    const admin = supabaseAdmin
    if (admin) {
      await admin
        .from('social_content_config')
        .update({
          credentials: {
            ...credentials,
            access_token: data.access_token,
            expires_in: data.expires_in,
            token_obtained_at: new Date().toISOString(),
            ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
          },
        })
        .eq('platform', 'linkedin')
    }

    return { success: true, newToken: data.access_token }
  } catch (err) {
    console.error('[LinkedIn] Token refresh error:', err)
    return { success: false, error: 'LinkedIn token refresh network error' }
  }
}

// ---------------------------------------------------------------------------
// Image upload (LinkedIn's 2-step flow)
// ---------------------------------------------------------------------------

async function registerImageUpload(
  accessToken: string,
  authorUrn: string
): Promise<{ uploadUrl: string; asset: string } | null> {
  const res = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: authorUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    }),
  })

  if (!res.ok) {
    console.error('[LinkedIn] Register upload failed:', await res.text())
    return null
  }

  const data = await res.json()
  const uploadUrl =
    data.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl
  const asset = data.value?.asset

  if (!uploadUrl || !asset) {
    console.error('[LinkedIn] Register upload response missing uploadUrl or asset')
    return null
  }

  return { uploadUrl, asset }
}

async function uploadImageBinary(uploadUrl: string, imageUrl: string, accessToken: string): Promise<boolean> {
  // Download the image first
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) {
    console.error('[LinkedIn] Failed to download image:', imageUrl)
    return false
  }

  const imageBuffer = await imageRes.arrayBuffer()
  const contentType = imageRes.headers.get('content-type') || 'image/png'

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: imageBuffer,
  })

  if (!uploadRes.ok && uploadRes.status !== 201) {
    console.error('[LinkedIn] Image binary upload failed:', uploadRes.status, await uploadRes.text())
    return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Post creation
// ---------------------------------------------------------------------------

function buildUgcPost(
  authorUrn: string,
  text: string,
  visibility: string,
  imageAsset?: string
): Record<string, unknown> {
  const shareContent: Record<string, unknown> = {
    shareCommentary: { text },
    shareMediaCategory: imageAsset ? 'IMAGE' : 'NONE',
  }

  if (imageAsset) {
    shareContent.media = [
      {
        status: 'READY',
        media: imageAsset,
      },
    ]
  }

  return {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent,
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': visibility || 'PUBLIC',
    },
  }
}

// ---------------------------------------------------------------------------
// Publish status helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main publish function
// ---------------------------------------------------------------------------

export async function publishToLinkedIn(payload: PublishPayload): Promise<PublishResult> {
  const { contentId, postText, ctaText, ctaUrl, hashtags, imageUrl } = payload

  // 1. Load credentials
  const config = await getLinkedInConfig()
  if (!config) {
    const error = 'LinkedIn is not connected or inactive'
    await updatePublishStatus(contentId, 'linkedin', 'failed', { error_message: error })
    return { success: false, error }
  }

  let { credentials } = config
  const { settings } = config

  // 2. Check token expiry
  if (isTokenExpired(credentials)) {
    const refreshResult = await refreshLinkedInToken(credentials)
    if (!refreshResult.success) {
      await updatePublishStatus(contentId, 'linkedin', 'failed', { error_message: refreshResult.error })
      return { success: false, error: refreshResult.error }
    }
    credentials = { ...credentials, access_token: refreshResult.newToken! }
  }

  const accessToken = credentials.access_token
  const authorUrn = settings.author_urn || credentials.person_urn

  if (!accessToken || !authorUrn) {
    const error = 'LinkedIn credentials incomplete — missing access token or author URN'
    await updatePublishStatus(contentId, 'linkedin', 'failed', { error_message: error })
    return { success: false, error }
  }

  // 3. Mark as publishing
  await updatePublishStatus(contentId, 'linkedin', 'publishing')

  try {
    // 4. Build full post text
    const parts = [postText]
    if (ctaText) parts.push(`\n${ctaText}`)
    if (ctaUrl) parts.push(ctaUrl)
    if (hashtags?.length) {
      const formattedTags = hashtags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ')
      parts.push(`\n${formattedTags}`)
    }
    const fullText = parts.join('\n')

    // 5. Handle image upload if present
    let imageAsset: string | undefined
    if (imageUrl) {
      const registration = await registerImageUpload(accessToken, authorUrn)
      if (registration) {
        const uploaded = await uploadImageBinary(registration.uploadUrl, imageUrl, accessToken)
        if (uploaded) {
          imageAsset = registration.asset
        } else {
          console.warn('[LinkedIn] Image upload failed, proceeding with text-only post')
        }
      }
    }

    // 6. Create the UGC post
    const ugcBody = buildUgcPost(authorUrn, fullText, settings.post_visibility, imageAsset)
    const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(ugcBody),
    })

    if (!postRes.ok) {
      const errBody = await postRes.text()
      console.error('[LinkedIn] UGC post creation failed:', postRes.status, errBody)
      const error = `LinkedIn API error (${postRes.status})`
      await updatePublishStatus(contentId, 'linkedin', 'failed', { error_message: error })
      return { success: false, error }
    }

    const postData = await postRes.json()
    const platformPostId = postData.id
    const postUrn = platformPostId?.replace('urn:li:share:', '') || ''
    const platformPostUrl = postUrn
      ? `https://www.linkedin.com/feed/update/urn:li:share:${postUrn}/`
      : undefined

    // 7. Mark as published
    await updatePublishStatus(contentId, 'linkedin', 'published', {
      platform_post_id: platformPostId,
      platform_post_url: platformPostUrl,
    })

    return {
      success: true,
      platformPostId,
      platformPostUrl,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error during LinkedIn publish'
    console.error('[LinkedIn] Publish error:', err)
    await updatePublishStatus(contentId, 'linkedin', 'failed', { error_message: error })
    return { success: false, error }
  }
}
