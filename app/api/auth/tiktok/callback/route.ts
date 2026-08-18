import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildTikTokRedirectUri,
  clearTikTokOAuthCookies,
  getTikTokOAuthClientKey,
  getTikTokOAuthClientSecret,
  TIKTOK_DIRECT_POST_SCOPE,
} from '@/lib/tiktok-oauth'

export const dynamic = 'force-dynamic'

type TikTokTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_expires_in?: number
  token_type?: string
  scope?: string
  open_id?: string
  error?: string
  error_description?: string
  log_id?: string
}

type StoredTikTokConfig = {
  credentials?: Record<string, unknown> | null
  settings?: Record<string, unknown> | null
  is_active?: boolean | null
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  )
}

function redirectWith(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/admin/social-content', request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const response = NextResponse.redirect(url)
  clearTikTokOAuthCookies(response)
  return response
}

function grantedScopes(scope?: string) {
  return new Set((scope ?? '').split(/[,\s]+/).map((value) => value.trim()).filter(Boolean))
}

/**
 * GET /api/auth/tiktok/callback
 * Exchange TikTok Login Kit code for server-side tokens. This stores provider
 * credentials but does not activate TikTok publishing unless the row was
 * already active before reconnect.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const returnedState = searchParams.get('state')
    const expectedState = request.cookies.get('tiktok_oauth_state')?.value

    if (error) {
      return redirectWith(request, { tiktok_error: error })
    }

    if (!code) {
      return redirectWith(request, { tiktok_error: 'no_code' })
    }

    if (!expectedState || returnedState !== expectedState) {
      return redirectWith(request, { tiktok_error: 'invalid_state' })
    }

    const clientKey = getTikTokOAuthClientKey()
    const clientSecret = getTikTokOAuthClientSecret()
    if (!clientKey || !clientSecret) {
      return redirectWith(request, { tiktok_error: 'missing_config' })
    }

    const origin = new URL(request.url).origin
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: buildTikTokRedirectUri(origin),
      }),
    })

    const tokenData = await tokenRes.json().catch(() => ({})) as TikTokTokenResponse
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('TikTok token exchange failed:', tokenData.error_description || tokenData.error || tokenRes.status)
      return redirectWith(request, { tiktok_error: 'token_exchange_failed' })
    }

    const { data: existingConfigData, error: existingConfigError } = await supabaseAdmin
      .from('social_content_config')
      .select('credentials, settings, is_active')
      .eq('platform', 'tiktok')
      .maybeSingle()

    if (existingConfigError) {
      console.error('TikTok config lookup failed:', existingConfigError.message)
      return redirectWith(request, { tiktok_error: 'config_lookup_failed' })
    }

    const existingConfig = existingConfigData as StoredTikTokConfig | null
    const existingCredentials = existingConfig?.credentials ?? {}
    const existingSettings = existingConfig?.settings ?? {}
    const connectedAt = new Date().toISOString()
    const scopes = grantedScopes(tokenData.scope)
    const hasDirectPostScope = scopes.has(TIKTOK_DIRECT_POST_SCOPE)
    const profileHandle = typeof existingSettings.profile_handle === 'string'
      ? existingSettings.profile_handle
      : 'amadutown'

    const credentials = compactRecord({
      ...existingCredentials,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || existingCredentials.refresh_token,
      expires_in: tokenData.expires_in,
      refresh_expires_in: tokenData.refresh_expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      open_id: tokenData.open_id || existingCredentials.open_id,
      token_obtained_at: connectedAt,
    })
    const settings = compactRecord({
      ...existingSettings,
      login_kit_connected_at: connectedAt,
      direct_post_scope_authorized: hasDirectPostScope,
      direct_post_scope_authorized_at: hasDirectPostScope ? connectedAt : existingSettings.direct_post_scope_authorized_at,
      oauth_scope: tokenData.scope,
      default_privacy: existingSettings.default_privacy ?? 'SELF_ONLY',
      privacy_level: existingSettings.privacy_level ?? 'SELF_ONLY',
      creator_info_confirmed: existingSettings.creator_info_confirmed ?? false,
      source_url_approved: existingSettings.source_url_approved ?? false,
      profile_handle: profileHandle,
      connected_account: `@${profileHandle.replace(/^@/, '')}`,
    })

    const { error: upsertError } = await supabaseAdmin
      .from('social_content_config')
      .upsert({
        platform: 'tiktok',
        credentials,
        settings,
        is_active: existingConfig?.is_active === true,
      }, { onConflict: 'platform' })

    if (upsertError) {
      console.error('TikTok config update failed:', upsertError.message)
      return redirectWith(request, { tiktok_error: 'config_update_failed' })
    }

    return redirectWith(request, {
      tiktok_connected: 'true',
      tiktok_active: existingConfig?.is_active === true ? 'true' : 'false',
    })
  } catch (error) {
    console.error('Error in TikTok callback:', error)
    return redirectWith(request, { tiktok_error: 'internal_error' })
  }
}
