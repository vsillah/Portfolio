import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildXRedirectUri,
  clearXOAuthCookies,
  getXOAuthClientId,
  getXOAuthClientSecret,
} from '@/lib/x-oauth'

export const dynamic = 'force-dynamic'

type XTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

type XMeResponse = {
  data?: {
    id?: string
    name?: string
    username?: string
  }
  errors?: Array<{ message?: string; detail?: string }>
}

type StoredXConfig = {
  credentials?: Record<string, unknown> | null
  settings?: Record<string, unknown> | null
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
  clearXOAuthCookies(response)
  return response
}

async function fetchXMe(accessToken: string) {
  const response = await fetch('https://api.x.com/2/users/me?user.fields=username,name', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json().catch(() => ({})) as XMeResponse

  if (!response.ok || !data.data?.id) {
    console.error('X user lookup failed:', data.errors?.[0]?.message || response.status)
    return null
  }

  return {
    user_id: data.data.id,
    display_name: data.data.name || null,
    profile_handle: data.data.username || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const returnedState = searchParams.get('state')
    const expectedState = request.cookies.get('x_oauth_state')?.value
    const codeVerifier = request.cookies.get('x_oauth_code_verifier')?.value

    if (error) {
      return redirectWith(request, { x_error: error })
    }

    if (!code) {
      return redirectWith(request, { x_error: 'no_code' })
    }

    if (!expectedState || returnedState !== expectedState || !codeVerifier) {
      return redirectWith(request, { x_error: 'invalid_state' })
    }

    const clientId = getXOAuthClientId()
    const clientSecret = getXOAuthClientSecret()
    if (!clientId || !clientSecret) {
      return redirectWith(request, { x_error: 'missing_config' })
    }

    const origin = new URL(request.url).origin
    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: buildXRedirectUri(origin),
        client_id: clientId,
        code_verifier: codeVerifier,
      }),
    })

    const tokenData = await tokenRes.json().catch(() => ({})) as XTokenResponse
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('X token exchange failed:', tokenData.error_description || tokenData.error || tokenRes.status)
      return redirectWith(request, { x_error: 'token_exchange_failed' })
    }

    const { data: existingConfigData, error: existingConfigError } = await supabaseAdmin
      .from('social_content_config')
      .select('credentials, settings')
      .eq('platform', 'x')
      .maybeSingle()

    if (existingConfigError) {
      console.error('X config lookup failed:', existingConfigError.message)
      return redirectWith(request, { x_error: 'config_lookup_failed' })
    }

    const existingConfig = existingConfigData as StoredXConfig | null
    const existingCredentials = existingConfig?.credentials ?? {}
    const existingSettings = existingConfig?.settings ?? {}
    const me = await fetchXMe(tokenData.access_token)
    const profileHandle = me?.profile_handle || existingSettings.profile_handle || 'amadutown'

    const credentials = compactRecord({
      ...existingCredentials,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || existingCredentials.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      token_obtained_at: new Date().toISOString(),
      user_id: me?.user_id || existingCredentials.user_id,
    })
    const settings = compactRecord({
      ...existingSettings,
      profile_handle: profileHandle,
      connected_account: profileHandle ? `@${String(profileHandle).replace(/^@/, '')}` : undefined,
      display_name: me?.display_name || existingSettings.display_name,
      max_post_length: existingSettings.max_post_length ?? 280,
      thread_reply_enabled: existingSettings.thread_reply_enabled ?? true,
    })

    const { error: upsertError } = await supabaseAdmin
      .from('social_content_config')
      .upsert({
        platform: 'x',
        credentials,
        settings,
        is_active: true,
      }, { onConflict: 'platform' })

    if (upsertError) {
      console.error('X config update failed:', upsertError.message)
      return redirectWith(request, { x_error: 'config_update_failed' })
    }

    return redirectWith(request, {
      x_connected: 'true',
      ...(profileHandle ? { x_handle: String(profileHandle) } : {}),
    })
  } catch (error) {
    console.error('Error in X callback:', error)
    return redirectWith(request, { x_error: 'internal_error' })
  }
}
