import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

type PlatformConfigRow = {
  id: string
  platform: string
  credentials: unknown
  settings: Record<string, unknown> | null
  is_active: boolean | null
  created_at: string
  updated_at: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function hasString(record: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => typeof record[key] === 'string' && String(record[key]).trim().length > 0)
}

function hasTruthy(record: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => {
    const value = record[key]
    if (value === true) return true
    return typeof value === 'string' && value.trim().length > 0
  })
}

function instagramProviderSetup(config: PlatformConfigRow) {
  if (config.platform !== 'instagram') return null

  const credentials = asRecord(config.credentials)
  const settings = asRecord(config.settings)
  const accountType = typeof settings.instagram_account_type === 'string'
    ? settings.instagram_account_type.trim().toLowerCase()
    : ''
  const requirements = {
    professional_account: hasTruthy(settings, [
      'professional_account_confirmed',
      'professional_account_confirmed_at',
      'instagram_professional_account_id',
    ]) || ['business', 'creator', 'professional'].includes(accountType),
    meta_page_linked: hasTruthy({ ...credentials, ...settings }, [
      'meta_page_linked',
      'meta_page_linked_at',
      'meta_page_id',
      'page_id',
      'connected_page_id',
    ]),
    access_token: hasString(credentials, ['access_token']),
    ig_user_business_id: hasString(credentials, ['ig_user_id', 'instagram_user_id', 'business_account_id']),
    app_review_permissions: hasTruthy(settings, [
      'app_review_permissions_confirmed',
      'app_review_permissions_confirmed_at',
      'instagram_content_publish_permission',
      'instagram_basic_permission',
    ]),
  }

  return {
    provider: 'meta_instagram_graph',
    requirements,
    ready: Object.values(requirements).every(Boolean),
    human_gate: 'Store credentials through the approved secret/config path only. Final Instagram publish remains separately human-submitted.',
  }
}

function facebookProviderSetup(config: PlatformConfigRow) {
  if (config.platform !== 'facebook') return null

  const credentials = asRecord(config.credentials)
  const settings = asRecord(config.settings)
  const requirements = {
    page_access_token: hasString(credentials, ['page_access_token', 'access_token']),
    page_id: hasString({ ...credentials, ...settings }, ['page_id', 'connected_page_id']),
  }

  return {
    provider: 'meta_facebook_graph',
    requirements,
    ready: Object.values(requirements).every(Boolean),
    human_gate: 'Store credentials through the approved secret/config path only. Final Facebook publish remains separately human-submitted.',
  }
}

/**
 * GET /api/admin/social-content/config
 * Get all platform configurations
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const safeResponse = searchParams.get('safe') === 'true'
    const platform = searchParams.get('platform')

    let query = supabaseAdmin
      .from('social_content_config')
      .select('*')
      .order('platform')

    if (platform) {
      query = query.eq('platform', platform)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching social content config:', error)
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
    }

    if (safeResponse) {
      const safeConfigs = ((data || []) as PlatformConfigRow[]).map((config) => ({
        id: config.id,
        platform: config.platform,
        settings: config.settings || {},
        is_active: Boolean(config.is_active),
        credentials_configured: Boolean(
          config.credentials
          && typeof config.credentials === 'object'
          && Object.keys(config.credentials).length > 0,
        ),
        provider_setup: instagramProviderSetup(config) ?? facebookProviderSetup(config),
        created_at: config.created_at,
        updated_at: config.updated_at,
      }))

      return NextResponse.json({ configs: safeConfigs })
    }

    return NextResponse.json({ configs: data || [] })
  } catch (error) {
    console.error('Error in GET /api/admin/social-content/config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/social-content/config
 * Update a platform configuration (credentials, settings, active status)
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { platform, credentials, settings, is_active } = body

    if (!platform) {
      return NextResponse.json({ error: 'platform is required' }, { status: 400 })
    }

    const updateFields: Record<string, unknown> = {}
    if (credentials !== undefined) updateFields.credentials = credentials
    if (settings !== undefined) updateFields.settings = settings
    if (is_active !== undefined) updateFields.is_active = is_active

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('social_content_config')
      .update(updateFields)
      .eq('platform', platform)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating social content config:', error)
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
    }

    return NextResponse.json({ config: data })
  } catch (error) {
    console.error('Error in PUT /api/admin/social-content/config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
