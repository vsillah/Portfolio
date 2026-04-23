import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/email-messages/[id]
 * Single email_messages row enriched with the full body resolved from the source
 * (contact_communications.body or outreach_queue.body — email_messages itself only
 * stores body_preview). Used by the Email Center preview viewer.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const id = params.id?.trim()
  if (!id) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const { data: row, error } = await supabaseAdmin
    .from('email_messages')
    .select(
      `
      id,
      email_kind,
      channel,
      contact_submission_id,
      contact_communication_id,
      recipient_email,
      subject,
      body_preview,
      direction,
      status,
      transport,
      source_system,
      source_id,
      external_id,
      sent_at,
      created_at,
      metadata,
      context_json
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[email-messages:get] select failed:', error.message)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
  if (!row) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }

  // Resolve the full body from the best source we can find.
  let fullBody: string | null = null
  let fullBodySource: 'contact_communications' | 'outreach_queue' | null = null

  if (row.contact_communication_id) {
    const { data: cc } = await supabaseAdmin
      .from('contact_communications')
      .select('body')
      .eq('id', row.contact_communication_id)
      .maybeSingle()
    if (cc?.body) {
      fullBody = cc.body as string
      fullBodySource = 'contact_communications'
    }
  }

  if (!fullBody && row.source_system === 'outreach_queue' && row.source_id) {
    const { data: oq } = await supabaseAdmin
      .from('outreach_queue')
      .select('body, subject')
      .eq('id', row.source_id)
      .maybeSingle()
    if (oq?.body) {
      fullBody = oq.body as string
      fullBodySource = 'outreach_queue'
    }
  }

  // Optional: lead name/email for header context
  let contact: { id: number; name: string | null; email: string | null; company: string | null } | null = null
  if (row.contact_submission_id != null) {
    const { data: c } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, name, email, company')
      .eq('id', row.contact_submission_id)
      .maybeSingle()
    if (c) contact = c as typeof contact
  }

  return NextResponse.json({
    message: row,
    full_body: fullBody,
    full_body_source: fullBodySource,
    contact,
  })
}
