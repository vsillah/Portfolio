import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status, headers })
  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid quote request.' }, { status: 400, headers })
  }
  const orderId = Number(body.orderId)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !name || name.length > 200 ||
    !message || message.length > 10000 || !auth.user.email) {
    return NextResponse.json({ error: 'Order reference, name, and message are required.' }, { status: 400, headers })
  }
  const { data, error } = await supabaseAdmin.rpc('accelerated_submit_member_quote', {
    p_user_id: auth.user.id,
    p_order_id: orderId,
    p_name: name,
    p_email: auth.user.email,
    p_message: message,
  })
  if (error) {
    const invalid = error.code === 'P0001'
    return NextResponse.json({ error: invalid ? error.message : 'Quote request is temporarily unavailable.' },
      { status: invalid ? 409 : 503, headers })
  }
  const result = data?.[0]
  if (!result?.contact_id) {
    return NextResponse.json({ error: 'Quote request was not recorded.' }, { status: 503, headers })
  }
  return NextResponse.json({ orderId, contactId: result.contact_id, replay: result.replay === true },
    { status: result.replay ? 200 : 201, headers })
}
