import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/contact-submissions
 *
 * Lightweight list of contact submissions for dropdowns (assign-to-lead, etc.).
 * Returns id, name, email only. Excludes removed/do-not-contact.
 *
 * Query params:
 *   - search: filter by name or email (case-insensitive)
 *   - limit: max results (default 100)
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
    const search = searchParams.get('search') || ''
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500)

    let query = supabaseAdmin
      .from('contact_submissions')
      .select('id, name, email')
      .is('removed_at', null)
      .eq('do_not_contact', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[admin/contact-submissions] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
    }

    return NextResponse.json({ submissions: data || [] })
  } catch (error) {
    console.error('[admin/contact-submissions] Error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
