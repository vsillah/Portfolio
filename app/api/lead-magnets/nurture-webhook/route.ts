import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET

/**
 * POST /api/lead-magnets/nurture-webhook
 * Called by n8n WF-LMN-001 after each nurture email is sent.
 * Authenticated via N8N_WEBHOOK_SECRET header.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-webhook-secret')
    if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      download_id,
      user_id,
      lead_magnet_id,
      email_number,
      status,
      n8n_execution_id,
    } = body as Record<string, unknown>

    if (!user_id || !lead_magnet_id || !email_number || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, lead_magnet_id, email_number, status' },
        { status: 400 }
      )
    }

    const emailNum = Number(email_number)
    if (!Number.isInteger(emailNum) || emailNum < 1 || emailNum > 10) {
      return NextResponse.json({ error: 'email_number must be 1-10' }, { status: 400 })
    }

    const validStatuses = ['queued', 'sent', 'failed', 'opened', 'clicked']
    if (!validStatuses.includes(status as string)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const row = {
      lead_magnet_download_id: download_id || null,
      user_id: String(user_id),
      lead_magnet_id: String(lead_magnet_id),
      email_number: emailNum,
      status: String(status),
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      n8n_execution_id: n8n_execution_id ? String(n8n_execution_id) : null,
    }

    const { error: insertError } = await supabaseAdmin
      .from('lead_magnet_nurture_emails')
      .insert([row])

    if (insertError) {
      console.error('Nurture email log insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to log nurture email' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Nurture webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
