import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { updateDraft, sendDraft } from '@/lib/client-update-drafts'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client-update-drafts/[id]
 *
 * Fetch a single draft by ID.
 * Auth: admin only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = await params

    const { data: draft, error } = await supabaseAdmin
      .from('client_update_drafts')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('[Draft GET] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/client-update-drafts/[id]
 *
 * Update subject / body of an unsent draft.
 * Body: { subject?: string, body?: string }
 *
 * Auth: admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { subject, body: emailBody } = body

    const draft = await updateDraft(id, {
      ...(subject !== undefined && { subject }),
      ...(emailBody !== undefined && { body: emailBody }),
    })

    return NextResponse.json({ success: true, draft })
  } catch (error) {
    console.error('[Draft PATCH] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/client-update-drafts/[id]
 *
 * Send a draft. Body: { action: 'send', channel?: 'email' | 'slack' }
 *
 * Auth: admin only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = await params
    const body = await request.json()

    if (body.action !== 'send') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const result = await sendDraft({
      draftId: id,
      channel: body.channel || 'email',
    })

    if (!result.sent) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, message: result.message })
  } catch (error) {
    console.error('[Draft send] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
