import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest) {
  try {
    // Check admin authentication
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

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Delete old events
    const { error: eventsError } = await supabaseAdmin
      .from('analytics_events')
      .delete()
      .lt('created_at', cutoffDate)

    if (eventsError) throw eventsError

    // Delete old sessions
    const { error: sessionsError } = await supabaseAdmin
      .from('analytics_sessions')
      .delete()
      .lt('started_at', cutoffDate)

    if (sessionsError) throw sessionsError

    return NextResponse.json({ 
      success: true,
      message: `Deleted events and sessions older than ${days} days`,
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ error: 'Failed to cleanup analytics' }, { status: 500 })
  }
}
