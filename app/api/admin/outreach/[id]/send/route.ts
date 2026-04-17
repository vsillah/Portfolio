import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { n8nWebhookUrl, isN8nOutboundDisabled } from '@/lib/n8n'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { logCommunication } from '@/lib/communications'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/outreach/[id]/send
 * Trigger sending of an approved outreach item via n8n webhook
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
      .select(`
        *,
        contact_submissions (
          id,
          name,
          email,
          company,
          linkedin_url,
          lead_score,
          qualification_status
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'Outreach item not found' },
        { status: 404 }
      )
    }

    if (item.status !== 'approved') {
      return NextResponse.json(
        { error: `Item must be approved before sending. Current status: ${item.status}` },
        { status: 400 }
      )
    }

    // Trigger the WF-CLG-003 send workflow via n8n webhook
    const webhookUrl = process.env.N8N_CLG003_WEBHOOK_URL
      || n8nWebhookUrl('clg-send')

        if (isN8nOutboundDisabled()) {
      console.log(`[N8N_DISABLED] outreach/[id]/send → ${webhookUrl}`)
      return NextResponse.json({
        message: 'Send workflow skipped (N8N_DISABLE_OUTBOUND)',
        outreach_id: id,
        channel: item.channel,
      })
    }

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Send workflow webhook URL not configured (N8N_CLG003_WEBHOOK_URL)' },
        { status: 500 }
      )
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outreach_id: item.id,
          contact_submission_id: item.contact_submission_id,
          channel: item.channel,
          subject: item.subject,
          body: item.body,
          sequence_step: item.sequence_step,
          contact: item.contact_submissions,
        }),
      })

      if (!response.ok) {
        console.error('n8n webhook failed:', response.status, await response.text())
        return NextResponse.json(
          { error: 'Failed to trigger send workflow' },
          { status: 502 }
        )
      }
    } catch (webhookError) {
      console.error('n8n webhook error:', webhookError)
      // Fire-and-forget is acceptable -- the workflow will handle retries
    }

    const contactRow = item.contact_submissions as
      | { id: number; email?: string }
      | null
      | undefined

    logCommunication({
      contactSubmissionId: item.contact_submission_id,
      channel: item.channel as 'email' | 'linkedin',
      direction: 'outbound',
      messageType: 'cold_outreach',
      subject: item.subject,
      body: item.body,
      sourceSystem: 'outreach_queue',
      sourceId: item.id,
      status: 'queued',
      sentBy: authResult.user.id,
      recipientEmail: contactRow?.email ?? null,
      emailTransport: 'n8n',
      metadata: {
        sequence_step: item.sequence_step,
        outreach_queue_id: item.id,
      },
    })

    return NextResponse.json({
      message: 'Send workflow triggered',
      outreach_id: id,
      channel: item.channel,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/outreach/[id]/send:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
