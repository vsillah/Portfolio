import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Anonymize IP address (remove last octet)
function anonymizeIP(ip: string | null): string | null {
  if (!ip) return null
  // For IPv4: 192.168.1.1 -> 192.168.1.0
  if (ip.includes('.')) {
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`
    }
  }
  // For IPv6: simplify (you can implement more sophisticated anonymization)
  return ip
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      event_type,
      event_name,
      section,
      metadata,
      session_id,
      user_id,
      user_agent,
      referrer,
      url,
      device_type,
      browser,
      os,
    } = body

    // Get IP address and anonymize it
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               null
    const anonymizedIP = anonymizeIP(ip)

    // Insert analytics event
    const { error: eventError } = await supabaseAdmin
      .from('analytics_events')
      .insert([
        {
          event_type,
          event_name,
          section,
          metadata: metadata || {},
          user_agent,
          referrer,
          ip_address: anonymizedIP,
          session_id,
          user_id,
        },
      ])

    if (eventError) {
      console.error('Analytics event error:', eventError)
    }

    // Update or create session
    if (session_id) {
      const { data: existingSession } = await supabaseAdmin
        .from('analytics_sessions')
        .select('*')
        .eq('session_id', session_id)
        .single()

      if (existingSession) {
        // Update session
        await supabaseAdmin
          .from('analytics_sessions')
          .update({
            page_views: (existingSession.page_views || 0) + 1,
            ended_at: new Date().toISOString(),
          })
          .eq('session_id', session_id)
      } else {
        // Create new session
        await supabaseAdmin
          .from('analytics_sessions')
          .insert([
            {
              session_id,
              user_id,
              referrer,
              user_agent,
              device_type,
              browser,
              os,
              page_views: 1,
            },
          ])
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    )
  }
}

// GET endpoint for fetching analytics (protect with auth in production)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const eventType = searchParams.get('event_type')

    let query = supabaseAdmin
      .from('analytics_events')
      .select('*')
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    const { data, error } = await query.limit(1000)

    if (error) throw error

    return NextResponse.json({ events: data })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}