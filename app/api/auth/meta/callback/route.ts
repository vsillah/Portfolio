import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildMetaRedirectUri,
  clearMetaOAuthCookies,
  getMetaOAuthClientId,
  getMetaOAuthClientSecret,
  META_GRAPH_API_VERSION,
} from '@/lib/meta-oauth'

export const dynamic = 'force-dynamic'

type MetaTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: { message?: string } | string
}

type MetaPermissionResponse = {
  data?: Array<{
    permission?: string
    status?: string
  }>
  error?: { message?: string } | string
}

type MetaPage = {
  id?: string
  name?: string
  access_token?: string
  instagram_business_account?: {
    id?: string
    username?: string
  } | null
}

type MetaPagesResponse = {
  data?: MetaPage[]
  error?: { message?: string } | string
}

type StoredConfig = {
  platform?: string
  credentials?: Record<string, unknown> | null
  settings?: Record<string, unknown> | null
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  )
}

function grantedScopeString(permissions: Set<string>) {
  const granted = [...permissions].sort()
  return granted.length ? granted.join(' ') : undefined
}

function redirectWith(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/admin/social-content', request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const response = NextResponse.redirect(url)
  clearMetaOAuthCookies(response)
  return response
}

function errorMessage(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'message' in value) return String(value.message)
  return null
}

async function fetchGrantedPermissions(accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/permissions`)
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url)
  const data = await response.json().catch(() => ({})) as MetaPermissionResponse
  if (!response.ok) {
    console.error('Meta permissions lookup failed:', errorMessage(data.error) || response.status)
    return new Set<string>()
  }

  return new Set(
    (data.data ?? [])
      .filter((permission) => permission.status === 'granted' && typeof permission.permission === 'string')
      .map((permission) => permission.permission as string),
  )
}

async function fetchPages(accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/accounts`)
  url.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id,username}')
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url)
  const data = await response.json().catch(() => ({})) as MetaPagesResponse
  if (!response.ok) {
    console.error('Meta Page lookup failed:', errorMessage(data.error) || response.status)
    return []
  }

  return Array.isArray(data.data) ? data.data : []
}

function selectMetaPage(pages: MetaPage[]) {
  const withToken = pages.filter((page) => page.id && page.access_token)
  const amadutownPages = withToken.filter((page) => (
    `${page.name ?? ''} ${page.id ?? ''}`.toLowerCase().includes('amadutown')
  ))
  return amadutownPages.find((page) => page.instagram_business_account?.id)
    || withToken.find((page) => page.instagram_business_account?.id)
    || amadutownPages[0]
    || withToken[0]
    || null
}

async function loadExistingConfigs() {
  const { data, error } = await supabaseAdmin
    .from('social_content_config')
    .select('platform, credentials, settings')
    .in('platform', ['facebook', 'instagram'])

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as StoredConfig[]
  return {
    facebook: rows.find((row) => row.platform === 'facebook') ?? null,
    instagram: rows.find((row) => row.platform === 'instagram') ?? null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const returnedState = searchParams.get('state')
    const expectedState = request.cookies.get('meta_oauth_state')?.value

    if (error) {
      return redirectWith(request, { meta_error: error })
    }

    if (!code) {
      return redirectWith(request, { meta_error: 'no_code' })
    }

    if (!expectedState || returnedState !== expectedState) {
      return redirectWith(request, { meta_error: 'invalid_state' })
    }

    const clientId = getMetaOAuthClientId()
    const clientSecret = getMetaOAuthClientSecret()
    if (!clientId || !clientSecret) {
      return redirectWith(request, { meta_error: 'missing_config' })
    }

    const origin = new URL(request.url).origin
    const tokenUrl = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', clientId)
    tokenUrl.searchParams.set('client_secret', clientSecret)
    tokenUrl.searchParams.set('redirect_uri', buildMetaRedirectUri(origin))
    tokenUrl.searchParams.set('code', code)

    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json().catch(() => ({})) as MetaTokenResponse
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Meta token exchange failed:', errorMessage(tokenData.error) || tokenRes.status)
      return redirectWith(request, { meta_error: 'token_exchange_failed' })
    }

    const [permissions, pages, existingConfigs] = await Promise.all([
      fetchGrantedPermissions(tokenData.access_token),
      fetchPages(tokenData.access_token),
      loadExistingConfigs(),
    ])
    const page = selectMetaPage(pages)
    if (!page?.id || !page.access_token) {
      return redirectWith(request, { meta_error: 'no_page_token' })
    }

    const instagramAccount = page.instagram_business_account ?? null
    const connectedAt = new Date().toISOString()
    const existingFacebookCredentials = existingConfigs.facebook?.credentials ?? {}
    const existingFacebookSettings = existingConfigs.facebook?.settings ?? {}
    const existingInstagramCredentials = existingConfigs.instagram?.credentials ?? {}
    const existingInstagramSettings = existingConfigs.instagram?.settings ?? {}
    const scope = grantedScopeString(permissions)
    const grantedPermissions = [...permissions].sort()
    const hasFacebookPageRead = permissions.has('pages_read_engagement')
    const hasFacebookUserContentRead = permissions.has('pages_read_user_content')
    const hasInstagramPublishing = permissions.has('instagram_content_publish')
    const hasInstagramBasic = permissions.has('instagram_basic')
    const hasInstagramManageComments = permissions.has('instagram_manage_comments')

    const facebookCredentials = compactRecord({
      ...existingFacebookCredentials,
      access_token: tokenData.access_token,
      page_access_token: page.access_token,
      page_id: page.id,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      token_obtained_at: connectedAt,
      scope,
    })
    const facebookSettings = compactRecord({
      ...existingFacebookSettings,
      graph_api_version: META_GRAPH_API_VERSION,
      default_published: existingFacebookSettings.default_published ?? true,
      page_id: page.id,
      page_name: page.name,
      connected_page_id: page.id,
      connected_page_name: page.name,
      connected_at: connectedAt,
      pages_read_engagement_permission: hasFacebookPageRead,
      pages_read_user_content_permission: hasFacebookUserContentRead,
      facebook_comment_read_permissions_confirmed: hasFacebookPageRead && hasFacebookUserContentRead,
      meta_granted_permissions: grantedPermissions,
    })

    const instagramCredentials = compactRecord({
      ...existingInstagramCredentials,
      access_token: page.access_token,
      user_access_token: tokenData.access_token,
      ig_user_id: instagramAccount?.id,
      instagram_user_id: instagramAccount?.id,
      business_account_id: instagramAccount?.id,
      page_id: page.id,
      page_access_token: page.access_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      token_obtained_at: connectedAt,
      scope,
    })
    const instagramSettings = compactRecord({
      ...existingInstagramSettings,
      graph_api_version: META_GRAPH_API_VERSION,
      instagram_account_type: 'business',
      professional_account_confirmed: Boolean(instagramAccount?.id),
      professional_account_confirmed_at: instagramAccount?.id ? connectedAt : undefined,
      meta_page_linked: true,
      meta_page_linked_at: connectedAt,
      meta_page_id: page.id,
      page_id: page.id,
      connected_page_id: page.id,
      connected_page_name: page.name,
      instagram_username: instagramAccount?.username,
      instagram_content_publish_permission: hasInstagramPublishing,
      instagram_basic_permission: hasInstagramBasic,
      instagram_manage_comments_permission: hasInstagramManageComments,
      meta_granted_permissions: grantedPermissions,
      app_review_permissions_confirmed: hasInstagramPublishing && hasInstagramBasic,
      app_review_permissions_confirmed_at: hasInstagramPublishing && hasInstagramBasic ? connectedAt : undefined,
    })

    const { error: upsertError } = await supabaseAdmin
      .from('social_content_config')
      .upsert([
        {
          platform: 'facebook',
          credentials: facebookCredentials,
          settings: facebookSettings,
          is_active: true,
        },
        {
          platform: 'instagram',
          credentials: instagramCredentials,
          settings: instagramSettings,
          is_active: Boolean(instagramAccount?.id),
        },
      ], { onConflict: 'platform' })

    if (upsertError) {
      console.error('Meta config update failed:', upsertError.message)
      return redirectWith(request, { meta_error: 'config_update_failed' })
    }

    return redirectWith(request, {
      meta_connected: 'true',
      facebook_page: page.name || page.id,
      ...(instagramAccount?.username ? { instagram_handle: instagramAccount.username } : {}),
      ...(instagramAccount?.id ? { instagram_connected: 'true' } : { meta_warning: 'no_instagram_business_account' }),
    })
  } catch (error) {
    console.error('Error in Meta callback:', error)
    return redirectWith(request, { meta_error: 'internal_error' })
  }
}
