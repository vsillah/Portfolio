import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Fetch events
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('analytics_events')
      .select('*')
      .gte('created_at', startDate)

    if (eventsError) throw eventsError

    // Fetch sessions
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('analytics_sessions')
      .select('*')
      .gte('started_at', startDate)

    if (sessionsError) throw sessionsError

    // Calculate stats
    const totalEvents = events?.length || 0
    const totalSessions = sessions?.length || 0
    const totalPageViews = events?.filter((e) => e.event_type === 'page_view').length || 0
    const totalClicks = events?.filter((e) => e.event_type === 'click').length || 0
    const totalFormSubmits = events?.filter((e) => e.event_type === 'form_submit').length || 0

    // Events by type
    const eventsByType: Record<string, number> = {}
    events?.forEach((event) => {
      eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1
    })

    // Events by section
    const eventsBySection: Record<string, number> = {}
    events?.forEach((event) => {
      if (event.section) {
        eventsBySection[event.section] = (eventsBySection[event.section] || 0) + 1
      }
    })

    // Top projects
    const projectClicks: Record<string, number> = {}
    events
      ?.filter((e) => e.event_name === 'project_click' && e.metadata?.projectTitle)
      .forEach((e) => {
        const title = e.metadata.projectTitle
        projectClicks[title] = (projectClicks[title] || 0) + 1
      })
    const topProjects = Object.entries(projectClicks)
      .map(([title, clicks]) => ({ title, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5)

    // Top videos
    const videoPlays: Record<string, number> = {}
    events
      ?.filter((e) => e.event_name === 'video_play' && e.metadata?.videoTitle)
      .forEach((e) => {
        const title = e.metadata.videoTitle
        videoPlays[title] = (videoPlays[title] || 0) + 1
      })
    const topVideos = Object.entries(videoPlays)
      .map(([title, plays]) => ({ title, plays }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5)

    // Social clicks
    const socialClicks: Record<string, number> = {}
    events
      ?.filter((e) => e.event_name === 'social_click' && e.metadata?.platform)
      .forEach((e) => {
        const platform = e.metadata.platform
        socialClicks[platform] = (socialClicks[platform] || 0) + 1
      })

    // Recent events
    const recentEvents = events
      ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50) || []

    return NextResponse.json({
      totalEvents,
      totalSessions,
      totalPageViews,
      totalClicks,
      totalFormSubmits,
      eventsByType,
      eventsBySection,
      topProjects,
      topVideos,
      socialClicks,
      recentEvents,
    })
  } catch (error) {
    console.error('Analytics stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics stats' },
      { status: 500 }
    )
  }
}
