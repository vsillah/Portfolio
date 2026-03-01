import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

interface SocialShareDiscountSetting {
  type: 'fixed' | 'percentage'
  value: number
}

/**
 * GET /api/admin/store-settings
 * Admin: returns all store settings for the settings page.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data: rows, error } = await supabaseAdmin
      .from('store_settings')
      .select('key, value, updated_at')

    if (error) throw error

    const settings: Record<string, unknown> = {}
    for (const row of rows || []) {
      settings[row.key] = row.value
    }

    return NextResponse.json({ settings })
  } catch (err) {
    console.error('GET /api/admin/store-settings:', err)
    return NextResponse.json(
      { error: 'Failed to load store settings' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/store-settings
 * Admin: update store settings (e.g. social_share_discount).
 * Body: { social_share_discount?: { type: 'fixed' | 'percentage', value: number } }
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()

    if (body.social_share_discount != null) {
      const s = body.social_share_discount as SocialShareDiscountSetting
      const type = s.type === 'percentage' ? 'percentage' : 'fixed'
      const value = typeof s.value === 'number' && s.value >= 0 ? s.value : 5

      const { error: upsertError } = await supabaseAdmin
        .from('store_settings')
        .upsert(
          {
            key: 'social_share_discount',
            value: { type, value },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        )

      if (upsertError) throw upsertError
    }

    const { data: rows, error } = await supabaseAdmin
      .from('store_settings')
      .select('key, value, updated_at')

    if (error) throw error

    const settings: Record<string, unknown> = {}
    for (const row of rows || []) {
      settings[row.key] = row.value
    }

    return NextResponse.json({ settings })
  } catch (err) {
    console.error('PUT /api/admin/store-settings:', err)
    return NextResponse.json(
      { error: 'Failed to update store settings' },
      { status: 500 }
    )
  }
}
