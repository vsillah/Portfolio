import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildRefinement, loadQuoteContext, QuoteContextError } from '@/lib/accelerated-quote-server'

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
  const refinementId = typeof body.refinementId === 'string' ? body.refinementId : ''
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !/^[0-9a-f-]{36}$/.test(refinementId) || !auth.user.email)
    return NextResponse.json({ error: 'A saved quote context is required.' }, { status: 400, headers })
  try {
    const context = await loadQuoteContext(auth.user.id, orderId)
    if (context.latest?.id !== refinementId) return NextResponse.json({ error: 'Quote context changed. Reload before sending.' }, { status: 409, headers })
    const requestedOfferId = (context.latest.context_package as { requestedOffer?: { id?: string } } | null)?.requestedOffer?.id
    const rebuilt = buildRefinement(context, context.latest.answers as Record<string, string>, requestedOfferId)
    if (rebuilt.payloadSha256 !== context.latest.payload_sha256 || rebuilt.projection.status === 'no_match')
      return NextResponse.json({ error: 'Quote context is stale or has no matching candidate. Reload before sending.' }, { status: 409, headers })
    const { data, error } = await supabaseAdmin.rpc('accelerated_submit_contextual_quote', {
      p_user_id: auth.user.id, p_order_id: orderId, p_refinement_id: refinementId, p_email: auth.user.email,
    })
    if (error) return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Quote request is temporarily unavailable.' },
      { status: error.code === 'P0001' ? 409 : 503, headers })
    const result = data?.[0]
    if (!result?.contact_id) return NextResponse.json({ error: 'Quote request was not recorded.' }, { status: 503, headers })
    return NextResponse.json({ orderId, contactId: result.contact_id, replay: result.replay === true },
      { status: result.replay ? 200 : 201, headers })
  } catch (error) {
    return NextResponse.json({ error: error instanceof QuoteContextError ? error.message : 'Quote request is temporarily unavailable.' },
      { status: error instanceof QuoteContextError ? error.status : 503, headers })
  }
}
