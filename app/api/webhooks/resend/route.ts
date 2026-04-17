import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { updateEmailMessageFromResendWebhook } from '@/lib/email-messages'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/resend
 * Verifies Svix-signed Resend webhook payloads and updates `email_messages` by `external_id`.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) {
    console.error('[resend webhook] RESEND_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const payload = await request.text()
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 400 })
  }

  type ResendEmailEvent = {
    type?: string
    created_at?: string
    data?: { email_id?: string }
  }

  let evt: ResendEmailEvent
  try {
    const wh = new Webhook(secret)
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendEmailEvent
  } catch (e) {
    console.warn('[resend webhook] Signature verification failed:', e)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const type = typeof evt.type === 'string' ? evt.type : ''
  if (!type.startsWith('email.')) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const emailId = evt.data?.email_id
  if (!emailId || typeof emailId !== 'string') {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const { updated, ignored } = await updateEmailMessageFromResendWebhook({
    externalId: emailId,
    resendEventType: type,
    eventCreatedAt: typeof evt.created_at === 'string' ? evt.created_at : undefined,
  })

  if (ignored) {
    return NextResponse.json({ received: true }, { status: 200 })
  }
  if (!updated) {
    return NextResponse.json({ received: true, matched: false }, { status: 200 })
  }
  return NextResponse.json({ received: true, matched: true }, { status: 200 })
}
