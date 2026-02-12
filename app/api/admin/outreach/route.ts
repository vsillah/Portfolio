import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/outreach
 * List outreach queue items with lead data for admin review
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
    const status = searchParams.get('status') || 'draft'
    const channel = searchParams.get('channel')
    const search = searchParams.get('search')
    const contactParam = searchParams.get('contact') // Filter by specific contact
    const contactId = contactParam ? parseInt(contactParam, 10) : null
    if (contactParam != null && contactParam !== '' && (contactId === null || Number.isNaN(contactId) || contactId < 1)) {
      return NextResponse.json(
        { error: 'contact must be a positive integer' },
        { status: 400 }
      )
    }
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit

    // Fetch outreach queue items with contact data
    let query = supabaseAdmin
      .from('outreach_queue')
      .select(
        `
        id,
        contact_submission_id,
        channel,
        subject,
        body,
        sequence_step,
        status,
        thread_id,
        scheduled_send_at,
        sent_at,
        replied_at,
        reply_content,
        generation_model,
        generation_prompt_summary,
        approved_at,
        created_at,
        updated_at,
        contact_submissions (
          id,
          name,
          email,
          company,
          company_domain,
          job_title,
          industry,
          lead_score,
          qualification_status,
          lead_source,
          outreach_status,
          full_report,
          quick_wins,
          ai_readiness_score,
          competitive_pressure_score,
          linkedin_url
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (channel && channel !== 'all') {
      query = query.eq('channel', channel)
    }

    if (contactId != null && contactId > 0) {
      query = query.eq('contact_submission_id', contactId)
    }

    if (search) {
      // Search by lead name, email, or company via a subquery approach
      // We'll filter in application layer since Supabase doesn't support
      // filtering on joined table fields in the same query easily
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching outreach queue:', error)
      return NextResponse.json(
        { error: 'Failed to fetch outreach queue' },
        { status: 500 }
      )
    }

    // Apply search filter in application layer if needed
    let filtered = data || []
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter((item: Record<string, unknown>) => {
        const contact = item.contact_submissions as Record<string, unknown> | null
        if (!contact) return false
        return (
          (contact.name as string || '').toLowerCase().includes(searchLower) ||
          (contact.email as string || '').toLowerCase().includes(searchLower) ||
          (contact.company as string || '').toLowerCase().includes(searchLower)
        )
      })
    }

    // Compute stats
    const { data: statsData } = await supabaseAdmin
      .from('outreach_queue')
      .select('status')

    const stats = {
      draft: 0,
      approved: 0,
      sent: 0,
      replied: 0,
      bounced: 0,
      cancelled: 0,
      rejected: 0,
      total: statsData?.length || 0,
    }

    for (const item of statsData || []) {
      const s = item.status as keyof typeof stats
      if (s in stats) stats[s]++
    }

    return NextResponse.json({
      items: filtered,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error in GET /api/admin/outreach:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/outreach
 * Bulk update outreach items (approve, reject, edit)
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const { action, ids, updates } = body as {
      action: 'approve' | 'reject' | 'edit'
      ids: string[]
      updates?: { subject?: string; body?: string }
    }

    if (!action || !ids || ids.length === 0) {
      return NextResponse.json(
        { error: 'action and ids are required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    switch (action) {
      case 'approve': {
        const { error } = await supabaseAdmin
          .from('outreach_queue')
          .update({
            status: 'approved',
            approved_by: authResult.user.id,
            approved_at: now,
            updated_at: now,
          })
          .in('id', ids)
          .eq('status', 'draft')

        if (error) {
          console.error('Error approving outreach:', error)
          return NextResponse.json(
            { error: 'Failed to approve items' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          message: `${ids.length} item(s) approved`,
          action: 'approved',
        })
      }

      case 'reject': {
        const { error } = await supabaseAdmin
          .from('outreach_queue')
          .update({
            status: 'rejected',
            updated_at: now,
          })
          .in('id', ids)
          .eq('status', 'draft')

        if (error) {
          console.error('Error rejecting outreach:', error)
          return NextResponse.json(
            { error: 'Failed to reject items' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          message: `${ids.length} item(s) rejected`,
          action: 'rejected',
        })
      }

      case 'edit': {
        if (!updates || ids.length !== 1) {
          return NextResponse.json(
            { error: 'Edit requires exactly one id and updates object' },
            { status: 400 }
          )
        }

        const updatePayload: Record<string, unknown> = { updated_at: now }
        if (updates.subject !== undefined) updatePayload.subject = updates.subject
        if (updates.body !== undefined) updatePayload.body = updates.body

        const { error } = await supabaseAdmin
          .from('outreach_queue')
          .update(updatePayload)
          .eq('id', ids[0])

        if (error) {
          console.error('Error editing outreach:', error)
          return NextResponse.json(
            { error: 'Failed to edit item' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          message: 'Item updated',
          action: 'edited',
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in PATCH /api/admin/outreach:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
