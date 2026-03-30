import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { extractMeetingTitle } from '@/lib/social-content'
import type { ContentStatus, SocialPlatform } from '@/lib/social-content'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/social-content
 * List social content queue items with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as ContentStatus | 'all' | null
    const platform = searchParams.get('platform') as SocialPlatform | 'all' | null
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('social_content_queue')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // status === 'all' → no restriction on status
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // platform === 'all' → no restriction on platform
    if (platform && platform !== 'all') {
      query = query.eq('platform', platform)
    }

    if (search) {
      query = query.or(`post_text.ilike.%${search}%,cta_text.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching social content:', error)
      return NextResponse.json({ error: 'Failed to fetch social content' }, { status: 500 })
    }

    const meetingIds = [...new Set((data || []).map((d: { meeting_record_id: string | null }) => d.meeting_record_id).filter(Boolean))] as string[]

    const meetingTitleMap = new Map<string, string | null>()
    if (meetingIds.length > 0) {
      const { data: meetings } = await supabaseAdmin
        .from('meeting_records')
        .select('id, raw_notes, structured_notes')
        .in('id', meetingIds)

      for (const m of meetings || []) {
        const notes = m.structured_notes as Record<string, unknown> | null
        meetingTitleMap.set(m.id, extractMeetingTitle(m.raw_notes, notes))
      }
    }

    const enrichedItems = (data || []).map((item: { meeting_record_id: string | null; [key: string]: unknown }) => ({
      ...item,
      meeting_title: item.meeting_record_id ? (meetingTitleMap.get(item.meeting_record_id) || null) : null,
    }))

    // Compute stats across all items (unfiltered)
    const { data: allItems } = await supabaseAdmin
      .from('social_content_queue')
      .select('status')

    const stats = { draft: 0, approved: 0, scheduled: 0, published: 0, rejected: 0, total: 0 }
    for (const item of allItems || []) {
      const s = item.status as ContentStatus
      if (s in stats) stats[s]++
      stats.total++
    }

    // Fetch latest extraction run (mirrors value_evidence dashboard pattern)
    const { data: lastRun } = await supabaseAdmin
      .from('social_content_extraction_runs')
      .select('id, triggered_at, completed_at, status, items_inserted, error_message')
      .order('triggered_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      items: enrichedItems,
      stats,
      lastExtractionRun: lastRun ?? null,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error in GET /api/admin/social-content:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
