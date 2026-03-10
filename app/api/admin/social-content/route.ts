import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
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

    return NextResponse.json({
      items: data || [],
      stats,
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
