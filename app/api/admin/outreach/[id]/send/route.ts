import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { n8nWebhookUrl } from '@/lib/n8n'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

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
