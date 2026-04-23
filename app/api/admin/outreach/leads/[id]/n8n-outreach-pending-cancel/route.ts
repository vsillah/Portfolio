import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/outreach/leads/:id/n8n-outreach-pending-cancel
 * User stopped "waiting" in the UI. Does not cancel n8n; sets DB status to failed
 * (same pattern as VEP extract cancel) so the pill is not still "pending" after refresh.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id: raw } = await params
  const id = parseInt(raw, 10)
  if (Number.isNaN(id) || id < 1) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const { error } = await supabaseAdmin
    .from('contact_submissions')
    .update({ last_n8n_outreach_status: 'failed' })
    .eq('id', id)
    .eq('last_n8n_outreach_status', 'pending')

  if (error) {
    console.error('[n8n-outreach-pending-cancel]', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
