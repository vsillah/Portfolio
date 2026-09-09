import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/outreach/[id]/send
 * Legacy dispatcher is blocked: internal copy approval is not send authority.
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

    // Fetch the outreach item
    const { data: item, error: fetchError } = await supabaseAdmin
      .from('outreach_queue')
      .select('id, contact_submission_id, channel')
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'Outreach item not found' },
        { status: 404 }
      )
    }

    const reviewUrl = `/admin/outreach?tab=leads&filter=warm&id=${encodeURIComponent(item.contact_submission_id)}&contactId=${encodeURIComponent(item.contact_submission_id)}&queueId=${encodeURIComponent(item.id)}`
    return NextResponse.json({
      error: 'Legacy outreach dispatch is blocked because its execution contract does not verify exact-copy send authorization. Open the reviewed Gmail execution or manual handoff path.',
      code: 'legacy_outreach_dispatch_blocked',
      outreach_id: item.id,
      channel: item.channel,
      dispatched: false,
      communicationQueued: false,
      externalSendPerformed: false,
      recovery: {
        reviewUrl: `${reviewUrl}#${item.channel === 'email' ? 'warm-gmail-operating-loop' : 'warm-manual-social-handoff'}`,
        gmailReviewedExecutionRoute: `/api/admin/outreach/${encodeURIComponent(item.id)}/gmail-user-send`,
        manualHandoffUrl: `${reviewUrl}#warm-manual-social-handoff`,
        nextAction: item.channel === 'email'
          ? 'Review the exact mailbox draft and obtain per-recipient send authorization in the Gmail workroom.'
          : 'Review final copy in the manual handoff panel. Manual completion is self-reported, not provider-confirmed.',
      },
    }, { status: 409 })

  } catch (error) {
    console.error('Error in POST /api/admin/outreach/[id]/send:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
