import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status, headers })
  if (!uuid.test(params.id)) return NextResponse.json({ error: 'Invalid recommendation.' }, { status: 400, headers })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid selection.' }, { status: 400, headers }) }
  const reviewedAt = typeof body.reviewedAt === 'string' ? body.reviewedAt : ''
  const variantId = body.variantId == null ? null : Number(body.variantId)
  if (!reviewedAt || !Number.isFinite(Date.parse(reviewedAt)) ||
    (variantId !== null && (!Number.isSafeInteger(variantId) || variantId <= 0))) {
    return NextResponse.json({ error: 'Invalid selection.' }, { status: 400, headers })
  }
  const { data, error } = await supabaseAdmin.rpc('accelerated_select_member_recommendation', {
    p_user_id: auth.user.id,
    p_recommendation_id: params.id,
    p_reviewed_at: reviewedAt,
    p_variant_id: variantId,
  })
  if (error) {
    const stale = error.code === 'P0001' || error.code === '23505'
    return NextResponse.json({ error: stale ? error.message : 'Selection is temporarily unavailable.' },
      { status: stale ? 409 : 503, headers })
  }
  const offer = data?.[0]
  if (!offer || !['product', 'service'].includes(offer.offer_kind)) {
    return NextResponse.json({ error: 'Selection was not recorded.' }, { status: 503, headers })
  }
  let quoteOrderId: number | null = null
  if (offer.quote_based) {
    const created = await supabaseAdmin.rpc('accelerated_create_member_quote_order', {
      p_user_id: auth.user.id,
      p_recommendation_id: params.id,
      p_reviewed_at: reviewedAt,
    })
    if (created.error) {
      const stale = created.error.code === 'P0001' || created.error.code === '23505'
      return NextResponse.json({ error: stale ? created.error.message : 'Quote request is temporarily unavailable.' },
        { status: stale ? 409 : 503, headers })
    }
    quoteOrderId = created.data?.[0]?.order_id ?? null
    if (!Number.isSafeInteger(quoteOrderId) || !quoteOrderId || quoteOrderId <= 0) {
      return NextResponse.json({ error: 'Quote order was not recorded.' }, { status: 503, headers })
    }
  }
  return NextResponse.json({
    kind: offer.offer_kind,
    offerId: offer.offer_id,
    price: offer.unit_price,
    quoteBased: offer.quote_based,
    recommendationId: params.id,
    reviewedAt,
    variantId,
    quoteOrderId,
  }, { headers })
}
