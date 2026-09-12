import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { verifySlackSignature } from '@/lib/slack-signature'
import { acceptSlackAction, processSlackReceipt } from '@/lib/slack-action-receipts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!verifySlackSignature(request, rawBody)) {
    return NextResponse.json({ error: 'Invalid Slack signature' }, { status: 401 })
  }
  const raw = new URLSearchParams(rawBody).get('payload')
  if (!raw) return NextResponse.json({ error: 'Missing Slack payload' }, { status: 400 })
  let payload
  try { payload = JSON.parse(raw) } catch {
    return NextResponse.json({ error: 'Invalid Slack payload' }, { status: 400 })
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Invalid Slack payload' }, { status: 400 })
  }
  try {
    const accepted = await acceptSlackAction(payload)
    if (accepted.receipt) {
      // A failed background dispatch leaves a durable queue for the cron worker.
      try { waitUntil(processSlackReceipt(accepted.receipt.idempotency_key).catch(() => {})) } catch { /* recovery owns queued work */ }
    }
    return NextResponse.json({ response_type: accepted.result.responseType, text: accepted.result.text })
  } catch {
    return NextResponse.json({ response_type: 'ephemeral',
      text: 'Action receipt could not be confirmed. Check Portfolio before retrying.' }, { status: 503 })
  }
}
