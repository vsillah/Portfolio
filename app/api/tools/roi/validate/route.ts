import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Validates a private link token for the ROI Calculator.
 * GET /api/tools/roi/validate?token=...
 * Returns 200 { allowed: true, contactName?: string } or 404.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Invalid or missing token' }, { status: 400 })
    }

    const { data: row, error } = await supabaseAdmin
      .from('lead_magnets')
      .select('id, title, private_link_token')
      .eq('private_link_token', token)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('ROI validate error:', error)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }

    if (!row) {
      return NextResponse.json({ error: 'Link invalid or expired' }, { status: 404 })
    }

    return NextResponse.json({
      allowed: true,
      contactName: row.title ?? undefined,
    })
  } catch (err) {
    console.error('ROI validate:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
