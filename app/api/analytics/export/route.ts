import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Type definition for analytics event from database
type AnalyticsEventRow = {
  id: number
  event_type: string
  event_name: string
  section: string | null
  metadata: Record<string, any> | null
  user_agent: string | null
  referrer: string | null
  ip_address: string | null
  session_id: string | null
  user_id: string | null
  created_at: string
}

export async function GET(request: NextRequest) {
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
    const days = parseInt(searchParams.get('days') || '7')
    const format = searchParams.get('format') || 'json'

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Fetch events
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('analytics_events')
      .select('*')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })

    if (eventsError) throw eventsError

    // Fetch sessions
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('analytics_sessions')
      .select('*')
      .gte('started_at', startDate)
      .order('started_at', { ascending: false })

    if (sessionsError) throw sessionsError

    if (format === 'csv') {
      // Convert to CSV
      const csvHeaders = ['Event Type', 'Event Name', 'Section', 'Created At', 'Metadata']
      const csvRows = events?.map((e: AnalyticsEventRow) => [
        e.event_type,
        e.event_name,
        e.section || '',
        e.created_at,
        JSON.stringify(e.metadata || {}),
      ]) || []

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map((row: string[]) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    } else {
      // Return JSON
      return NextResponse.json({
        events: events || [],
        sessions: sessions || [],
        exportedAt: new Date().toISOString(),
        dateRange: {
          start: startDate,
          end: new Date().toISOString(),
          days,
        },
      })
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to export analytics' }, { status: 500 })
  }
}
