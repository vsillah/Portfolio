import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { sendEmailWithOutcome } from '@/lib/notifications'
import { logCommunication } from '@/lib/communications'

export const dynamic = 'force-dynamic'

const MAX_BODY_CHARS = 500_000

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * POST /api/admin/outreach/[id]/email-draft-to-inbox
 * Emails a copy of the queue item (subject + body + lead context) to the admin's Supabase account email.
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

    const to = authResult.user.email?.trim()
    if (!to?.includes('@')) {
      return NextResponse.json(
        {
          error:
            'Your account has no email on file. Add an email to your profile, then try again.',
        },
        { status: 400 }
      )
    }

    const gmailConfigured = Boolean(
      process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()
    )
    if (!gmailConfigured) {
      return NextResponse.json(
        { error: 'Email delivery is not configured for this site.' },
        { status: 503 }
      )
    }

    const { id } = await params

    let bodyOverrides: { subject?: string; body?: string } = {}
    try {
      const raw = await request.json()
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const o = raw as Record<string, unknown>
        if (typeof o.subject === 'string') bodyOverrides.subject = o.subject
        if (typeof o.body === 'string') bodyOverrides.body = o.body
      }
    } catch {
      // no JSON body — use DB fields only
    }

    const { data: item, error: fetchError } = await supabaseAdmin
      .from('outreach_queue')
      .select(
        `
        *,
        contact_submissions (
          id,
          name,
          email,
          company
        )
      `
      )
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'Outreach item not found.' },
        { status: 404 }
      )
    }

    if (item.status !== 'draft' && item.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only draft or approved items can be copied to your inbox.' },
        { status: 400 }
      )
    }

    const contact = item.contact_submissions as
      | { id: number; name: string; email: string; company: string | null }
      | null
    const leadName = contact?.name ?? 'Unknown lead'
    const leadCompany = contact?.company ?? '—'
    const leadEmail = contact?.email ?? '—'
    const channel = item.channel as string
    const queueSubject = (item.subject as string | null)?.trim() || ''
    const queueBody = String(item.body ?? '')
    const origSubject =
      (bodyOverrides.subject !== undefined ? bodyOverrides.subject : queueSubject).trim() ||
      '(no subject)'
    const bodyText =
      bodyOverrides.body !== undefined ? bodyOverrides.body : queueBody

    if (bodyText.length > MAX_BODY_CHARS) {
      return NextResponse.json(
        { error: 'Message is too long to email. Save a shorter version or copy from the preview.' },
        { status: 400 }
      )
    }

    const mailSubject = `[Email center copy] ${origSubject} — ${leadName}`

    const plainBody = [
      `Lead: ${leadName}`,
      `Company: ${leadCompany}`,
      `Lead email: ${leadEmail}`,
      `Channel: ${channel}`,
      `Queue status: ${item.status}`,
      `Outreach ID: ${item.id}`,
      '',
      '--- Subject (as in queue) ---',
      origSubject,
      '',
      '--- Body ---',
      bodyText,
    ].join('\n')

    const htmlBody = `
      <p><strong>Lead:</strong> ${escapeHtml(leadName)}<br/>
      <strong>Company:</strong> ${escapeHtml(leadCompany)}<br/>
      <strong>Lead email:</strong> ${escapeHtml(leadEmail)}<br/>
      <strong>Channel:</strong> ${escapeHtml(channel)}<br/>
      <strong>Queue status:</strong> ${escapeHtml(String(item.status))}<br/>
      <strong>Outreach ID:</strong> ${escapeHtml(String(item.id))}</p>
      <hr/>
      <p><strong>Subject (as in queue)</strong></p>
      <p>${escapeHtml(origSubject)}</p>
      <hr/>
      <p><strong>Body</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(bodyText)}</pre>
    `

    const { ok, transport: sendTransport } = await sendEmailWithOutcome({
      to,
      subject: mailSubject,
      html: htmlBody,
      text: plainBody,
    })

    if (!ok) {
      return NextResponse.json(
        { error: 'Something went wrong sending the email. Please try again.' },
        { status: 502 }
      )
    }

    void logCommunication({
      contactSubmissionId: item.contact_submission_id,
      channel: channel === 'linkedin' ? 'linkedin' : 'email',
      direction: 'outbound',
      messageType: 'manual',
      subject: mailSubject,
      body: plainBody.slice(0, 8000),
      sourceSystem: 'outreach_queue',
      sourceId: item.id,
      status: 'sent',
      sentBy: authResult.user.id,
      emailTransport:
        sendTransport === 'resend' ? 'resend' : sendTransport === 'logged_only' ? 'logged_only' : 'gmail_smtp',
      metadata: {
        outreach_queue_id: item.id,
        admin_inbox_copy: true,
        copy_recipient_masked: true,
      },
    })

    return NextResponse.json({
      message: 'A copy was sent to your account email.',
    })
  } catch (error) {
    console.error('Error in POST /api/admin/outreach/[id]/email-draft-to-inbox:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
