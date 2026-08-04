import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

type YouTubeChannelsResponse = {
  items?: Array<{
    id?: string
    snippet?: {
      title?: string
      customUrl?: string
    }
  }>
  error?: {
    message?: string
  }
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  )
}

function getGoogleOAuthClientConfig() {
  return {
    clientId: process.env.YOUTUBE_CLIENT_ID
      || process.env.GOOGLE_CLIENT_ID
      || process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET
      || process.env.GOOGLE_CLIENT_SECRET
      || process.env.GOOGLE_GMAIL_OAUTH_CLIENT_SECRET,
  }
}

function redirectWith(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/admin/social-content', request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const response = NextResponse.redirect(url)
  response.cookies.delete('youtube_oauth_state')
  return response
}

async function fetchYouTubeChannel(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json() as YouTubeChannelsResponse

  if (!response.ok) {
    console.error('YouTube channel lookup failed:', data.error?.message || response.status)
    return null
  }

  const channel = data.items?.[0]
  if (!channel?.id) return null

  return {
    channel_id: channel.id,
    channel_title: channel.snippet?.title || 'Connected YouTube channel',
    channel_custom_url: channel.snippet?.customUrl || null,
  }
}

/**
 * GET /api/auth/youtube/callback
 * Exchange Google OAuth code for YouTube upload credentials and activate the
 * server-side YouTube social content config row.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const returnedState = searchParams.get('state')
    const expectedState = request.cookies.get('youtube_oauth_state')?.value

    if (error) {
      return redirectWith(request, { youtube_error: error })
    }

    if (!code) {
      return redirectWith(request, { youtube_error: 'no_code' })
    }

    if (!expectedState || returnedState !== expectedState) {
      return redirectWith(request, { youtube_error: 'invalid_state' })
    }

    const { clientId, clientSecret } = getGoogleOAuthClientConfig()
    if (!clientId || !clientSecret) {
      return redirectWith(request, { youtube_error: 'missing_config' })
    }

    const origin = new URL(request.url).origin
    const redirectUri = `${origin}/api/auth/youtube/callback`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    const tokenData = await tokenRes.json() as GoogleTokenResponse
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('YouTube token exchange failed:', tokenData.error_description || tokenData.error || tokenRes.status)
      return redirectWith(request, { youtube_error: 'token_exchange_failed' })
    }

    const channel = await fetchYouTubeChannel(tokenData.access_token)
    const credentials = compactRecord({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      token_obtained_at: new Date().toISOString(),
    })
    const settings = compactRecord({
      default_privacy: 'private',
      made_for_kids: false,
      notify_subscribers: false,
      ...(channel ?? {}),
    })

    const { error: upsertError } = await supabaseAdmin
      .from('social_content_config')
      .upsert({
        platform: 'youtube',
        credentials,
        settings,
        is_active: true,
      }, { onConflict: 'platform' })

    if (upsertError) {
      console.error('YouTube config update failed:', upsertError.message)
      return redirectWith(request, { youtube_error: 'config_update_failed' })
    }

    return redirectWith(request, {
      youtube_connected: 'true',
      ...(channel?.channel_title ? { youtube_channel: channel.channel_title } : {}),
    })
  } catch (error) {
    console.error('Error in YouTube callback:', error)
    return redirectWith(request, { youtube_error: 'internal_error' })
  }
}
