import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/chat-escalations/[id]
 * Single escalation with linked contact. Admin only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = await params
  const numId = parseInt(id, 10)
  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: 'Invalid escalation id' }, { status: 400 })
  }

  const { data: row, error } = await supabaseAdmin
    .from('chat_escalations')
    .select(
      `
      id,
      session_id,
      escalated_at,
      source,
      reason,
      visitor_name,
      visitor_email,
      transcript,
      contact_submission_id,
      slack_sent_at,
      created_at,
      updated_at,
      contact_submissions(name, email)
    `
    )
    .eq('id', numId)
    .single()

  if (error || !row) {
    if (error?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Escalation not found' }, { status: 404 })
    }
    console.error('[chat-escalations] GET by id error:', error?.message)
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 500 })
  }

  return NextResponse.json(row)
}

/**
 * PATCH /api/admin/chat-escalations/[id]
 * Update escalation (link/unlink lead). Body: { contact_submission_id: number | null }
 * Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = await params
  const numId = parseInt(id, 10)
  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: 'Invalid escalation id' }, { status: 400 })
  }

  let body: { contact_submission_id?: number | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const contactSubmissionId =
    body.contact_submission_id === null || body.contact_submission_id === undefined
      ? null
      : typeof body.contact_submission_id === 'number'
        ? body.contact_submission_id
        : parseInt(String(body.contact_submission_id), 10)

  if (contactSubmissionId !== null && Number.isNaN(contactSubmissionId)) {
    return NextResponse.json({ error: 'contact_submission_id must be a number or null' }, { status: 400 })
  }

  const { data: updated, error } = await supabaseAdmin
    .from('chat_escalations')
    .update({
      contact_submission_id: contactSubmissionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', numId)
    .select(
      `
      id,
      session_id,
      contact_submission_id,
      updated_at,
      contact_submissions(name, email)
    `
    )
    .single()

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Contact not found (invalid contact_submission_id)' },
        { status: 400 }
      )
    }
    console.error('[chat-escalations] PATCH error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}
