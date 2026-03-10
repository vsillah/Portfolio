import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

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

    const { data, error } = await supabaseAdmin
      .from('social_content_config')
      .select('*')
      .order('platform')

    if (error) {
      console.error('Error fetching social content config:', error)
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
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
