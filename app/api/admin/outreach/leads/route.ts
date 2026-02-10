import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/outreach/leads
 * Fetch all leads with filtering, search, and pagination
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

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // 'all' | 'warm' | 'cold'
    const status = searchParams.get('status') // 'new' | 'contacted' | 'replied' | 'booked' | 'opted_out'
    const source = searchParams.get('source') // specific source like 'warm_facebook'
    const search = searchParams.get('search') // text search
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build the query
    let query = supabaseAdmin
      .from('contact_submissions')
      .select(`
        id,
        name,
        email,
        company,
        job_title,
        lead_source,
        lead_score,
        outreach_status,
        qualification_status,
        created_at,
        linkedin_url,
        ai_readiness_score,
        competitive_pressure_score,
        quick_wins
      `, { count: 'exact' })

    // Filter by temperature (warm/cold)
    if (filter === 'warm') {
      query = query.like('lead_source', 'warm_%')
    } else if (filter === 'cold') {
      query = query.like('lead_source', 'cold_%')
    } else {
      // All leads - both warm and cold
      query = query.or('lead_source.like.warm_%,lead_source.like.cold_%')
    }

    // Filter by specific source (supports partial matching)
    if (source && source !== 'all') {
      // If source doesn't end with a specific sub-type, use pattern matching
      // e.g., "warm_facebook" matches "warm_facebook_friends", "warm_facebook_engagement", etc.
      if (source.match(/^(warm|cold)_\w+$/)) {
        query = query.like('lead_source', `${source}%`)
      } else {
        query = query.eq('lead_source', source)
      }
    }

    // Filter by outreach status
    if (status && status !== 'all') {
      query = query.eq('outreach_status', status)
    }

    // Text search
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
    }

    // Pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: contacts, error, count } = await query

    if (error) {
      console.error('Error fetching leads:', error)
      throw error
    }

    // For each lead, get aggregated message and sales data
    const leadsWithMetadata = await Promise.all(
      (contacts || []).map(async (contact: {
        id: number
        name: string
        email: string
        company: string | null
        job_title: string | null
        lead_source: string
        lead_score: number | null
        outreach_status: string
        qualification_status: string | null
        created_at: string
        linkedin_url: string | null
        ai_readiness_score: number | null
        competitive_pressure_score: number | null
        quick_wins: string | null
      }) => {
        // Get message counts
        const { data: messages } = await supabaseAdmin
          .from('outreach_queue')
          .select('id, status')
          .eq('contact_submission_id', contact.id)

        const messages_count = messages?.length || 0
        const messages_sent = messages?.filter((m: { id: string; status: string }) => m.status === 'sent').length || 0
        const has_reply = messages?.some((m: { id: string; status: string }) => m.status === 'replied') || false

        // Check for sales conversation
        const { data: audits } = await supabaseAdmin
          .from('diagnostic_audits')
          .select('id')
          .eq('contact_submission_id', contact.id)
          .limit(1)

        const has_sales_conversation = (audits?.length || 0) > 0

        return {
          ...contact,
          messages_count,
          messages_sent,
          has_reply,
          has_sales_conversation,
        }
      })
    )

    return NextResponse.json({
      leads: leadsWithMetadata,
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
    })
  } catch (error) {
    console.error('Error in GET /api/admin/outreach/leads:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
