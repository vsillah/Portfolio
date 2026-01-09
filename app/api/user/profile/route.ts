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
      .select('id, email, role, created_at, updated_at')
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
