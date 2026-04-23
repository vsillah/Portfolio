import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/outreach/leads/:id/n8n-outreach-ack
 * Clears last_n8n_outreach_* after the user dismisses the success / failure pill (browser ack).
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
    .update({
      last_n8n_outreach_triggered_at: null,
      last_n8n_outreach_status: null,
      last_n8n_outreach_template_key: null,
    })
    .eq('id', id)

  if (error) {
    console.error('[n8n-outreach-ack]', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
