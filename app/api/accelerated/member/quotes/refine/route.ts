import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildRefinement, loadQuoteContext, QuoteContextError } from '@/lib/accelerated-quote-server'
import { projectQuoteOffers, quoteQuestions, type QuoteAnswers } from '@/lib/accelerated-quote-refinement'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })
const orderIdOf = (value: unknown) => {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
const errorResponse = (error: unknown) => error instanceof QuoteContextError
  ? fail(error.message, error.status) : fail('Quote context is temporarily unavailable.', 503)

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (isAuthError(auth)) return fail(auth.error, auth.status)
  const orderId = orderIdOf(request.nextUrl.searchParams.get('orderId'))
  if (!orderId) return fail('Open a reviewed quote request from your dashboard.', 400)
  try {
    const context = await loadQuoteContext(auth.user.id, orderId)
    const answers = (context.latest?.answers ?? {}) as QuoteAnswers
    return NextResponse.json({ orderId, title: context.rec.title, summary: context.derived.summary,
      derivedFacts: context.derived.facts, questions: quoteQuestions.filter((q) => context.questions.includes(q.id)),
      offers: context.offers, answers, revision: context.latest?.revision ?? 0,
      refinementId: context.latest?.id ?? null, submitted: context.submitted,
      requestedOfferId: (context.latest?.context_package as { requestedOffer?: { id?: string } } | null)?.requestedOffer?.id ?? context.rec.offer_id,
      reviewedOfferId: context.rec.offer_id,
      projection: projectQuoteOffers(context.offers, context.derived, answers, context.questions) }, { headers })
  } catch (error) { return errorResponse(error) }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (isAuthError(auth)) return fail(auth.error, auth.status)
  if (Number(request.headers.get('content-length') || 0) > 10000) return fail('Quote answers are too large.', 413)
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail('Invalid quote answers.', 400) }
  const orderId = orderIdOf(body.orderId)
  const expectedRevision = Number(body.expectedRevision)
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : ''
  if (!orderId || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(idempotencyKey) ||
    !body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers) ||
    Object.keys(body.answers).length > 6) return fail('Invalid quote receipt. Reload and try again.', 400)
  try {
    const context = await loadQuoteContext(auth.user.id, orderId)
    if (context.submitted) return fail('This quote request was already sent for operator review.', 409)
    const { projection, packageData, payloadSha256 } = buildRefinement(context, body.answers as QuoteAnswers,
      typeof body.requestedOfferId === 'string' ? body.requestedOfferId : null)
    const { data, error } = await supabaseAdmin.rpc('accelerated_save_quote_refinement', {
      p_user_id: auth.user.id, p_order_id: orderId, p_expected_revision: expectedRevision,
      p_idempotency_key: idempotencyKey, p_payload_sha256: payloadSha256, p_context_package: packageData,
    })
    if (error) return fail(error.code === 'P0001' ? error.message : 'Quote context could not be saved.', error.code === 'P0001' ? 409 : 503)
    const saved = data?.[0]
    if (!saved?.refinement_id) return fail('Quote context receipt was not recorded.', 503)
    return NextResponse.json({ orderId, refinementId: saved.refinement_id, revision: saved.revision,
      replay: saved.replay, projection }, { headers })
  } catch (error) { return errorResponse(error) }
}
