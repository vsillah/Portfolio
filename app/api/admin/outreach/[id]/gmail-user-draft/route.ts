import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { decryptRefreshToken } from '@/lib/gmail-user-oauth-crypto'
import {
  createUserGmailDraft,
  isGmailUserOAuthClientConfigured,
} from '@/lib/gmail-user-api'
import { isGmailUserOauthSecretConfigured } from '@/lib/gmail-user-oauth-secret'
import { logCommunication } from '@/lib/communications'

export const dynamic = 'force-dynamic'

const MAX_BODY_CHARS = 500_000

/**
 * POST /api/admin/outreach/[id]/gmail-user-draft
 * Creates a draft in the admin's own Gmail (OAuth), addressed to the lead.
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

    if (
      !isGmailUserOAuthClientConfigured() ||
      !isGmailUserOauthSecretConfigured()
    ) {
      return NextResponse.json(
        { error: 'Gmail account connection is not configured for this site.' },
        { status: 503 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
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
      // use DB only
    }

    const { data: creds, error: credsError } = await supabaseAdmin
      .from('admin_gmail_user_credentials')
      .select(
        'refresh_token_cipher, refresh_token_iv, refresh_token_tag, google_email'
      )
      .eq('user_id', authResult.user.id)
      .maybeSingle()

    if (credsError || !creds) {
      return NextResponse.json(
        {
          error:
            'Connect your Gmail account first (Message Queue → Connect my Gmail).',
        },
        { status: 400 }
      )
    }

    let refreshToken: string
    try {
      refreshToken = decryptRefreshToken(
        creds.refresh_token_cipher as string,
        creds.refresh_token_iv as string,
        creds.refresh_token_tag as string
      )
    } catch (e) {
      console.error('[Gmail user draft] decrypt failed:', e)
      return NextResponse.json(
        { error: 'Something went wrong. Reconnect Gmail and try again.' },
        { status: 500 }
      )
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
        { error: 'Only draft or approved items can be saved to Gmail.' },
        { status: 400 }
      )
    }

    if (item.channel !== 'email') {
      return NextResponse.json(
        { error: 'Only email channel drafts can be saved to Gmail as mail drafts.' },
        { status: 400 }
      )
    }

    const contact = item.contact_submissions as
      | { id: number; name: string; email: string; company: string | null }
      | null
    const to = contact?.email?.trim()
    if (!to?.includes('@')) {
      return NextResponse.json(
        { error: 'This lead has no email address.' },
        { status: 400 }
      )
    }

    const queueSubject = (item.subject as string | null)?.trim() ?? ''
    const queueBody = String(item.body ?? '')
    const subject =
      (bodyOverrides.subject !== undefined ? bodyOverrides.subject : queueSubject).trim() ||
      '(no subject)'
    const bodyText =
      bodyOverrides.body !== undefined ? bodyOverrides.body : queueBody

    if (bodyText.length > MAX_BODY_CHARS) {
      return NextResponse.json(
        {
          error:
            'Message is too long. Shorten it or save a smaller copy from the preview.',
        },
        { status: 400 }
      )
    }

    let draft: { id: string; messageId?: string }
    try {
      draft = await createUserGmailDraft(refreshToken, {
        to,
        subject,
        body: bodyText,
      })
    } catch (e) {
      console.error('[Gmail user draft] API error:', e)
      return NextResponse.json(
        {
          error:
            'Gmail could not create the draft. Try reconnecting your Gmail account.',
        },
        { status: 502 }
      )
    }

    void logCommunication({
      contactSubmissionId: item.contact_submission_id,
      channel: 'email',
      direction: 'outbound',
      messageType: 'manual',
      subject,
      body: bodyText.slice(0, 8000),
      sourceSystem: 'outreach_queue',
      sourceId: item.id,
      status: 'draft',
      sentBy: authResult.user.id,
      emailTransport: 'logged_only',
      metadata: {
        outreach_queue_id: item.id,
        gmail_user_draft_id: draft.id,
        gmail_user_message_id: draft.messageId,
        gmail_connected_as: creds.google_email,
      },
    })

    return NextResponse.json({
      message: 'Draft saved in your Gmail. Open Gmail to review and send.',
      draftId: draft.id,
      openGmailUrl: 'https://mail.google.com/mail/#drafts',
    })
  } catch (error) {
    console.error('POST /api/admin/outreach/[id]/gmail-user-draft:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
