import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get the session token from the Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the user with the token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch profile using admin client (bypasses RLS)
    // Force fresh query - create a new client instance to avoid connection pooling issues
    console.log('[API DEBUG] Fetching profile for user ID:', user.id)
    console.log('[API DEBUG] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log('[API DEBUG] Has service role key:', !!serviceRoleKey)
    
    if (!serviceRoleKey) {
      console.error('[API DEBUG] SUPABASE_SERVICE_ROLE_KEY is missing! Check your .env.local file and restart the dev server.')
      return NextResponse.json(
        { error: 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      )
    }
    
    // Create a fresh admin client to avoid any connection pooling/caching issues
    const freshAdminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    const { data: profile, error } = await freshAdminClient
      .from('user_profiles')
      .select('id, email, full_name, role, created_at, updated_at, shipping_address')
      .eq('id', user.id)
      .single()

    if (error) {
      // If profile doesn't exist, return null (it will be created by trigger)
      if (error.code === 'PGRST116') {
        console.log('[API DEBUG] Profile not found for user ID:', user.id)
        return NextResponse.json({ profile: null })
      }
      console.error('[API DEBUG] Error fetching profile:', error)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    console.log('[API DEBUG] Fetched profile from database:', {
      id: profile?.id,
      email: profile?.email,
      role: profile?.role,
      updated_at: profile?.updated_at,
    })
    
    // Verify we're getting the latest data - log the raw response
    console.log('[API DEBUG] Raw profile data:', JSON.stringify(profile))

    // Return with no-cache headers to prevent browser caching
    return NextResponse.json(
      { profile },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error: any) {
    console.error('Profile API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/** Allowed shape for shipping_address (same as order/checkout). */
const shippingAddressShape = [
  'address1', 'address2', 'city', 'state_code', 'zip', 'country_code', 'phone',
] as const

function normalizeShippingAddress(val: unknown): Record<string, string> | null {
  if (val == null) return null
  if (typeof val !== 'object' || Array.isArray(val)) return null
  const o = val as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of shippingAddressShape) {
    const v = o[key]
    if (v != null && typeof v === 'string') out[key] = v
  }
  if (!out.address1 || !out.city || !out.state_code || !out.zip || !out.country_code) return null
  return out
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const updates: { full_name?: string; shipping_address?: Record<string, string> | null; updated_at?: string } = {}

    if (body.full_name !== undefined) {
      updates.full_name = typeof body.full_name === 'string' ? body.full_name : null
    }
    if (body.shipping_address !== undefined) {
      updates.shipping_address = normalizeShippingAddress(body.shipping_address)
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: profile, error } = await admin
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Profile PATCH error:', error)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error('Profile PATCH error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
