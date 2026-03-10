import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

const VALID_SOURCES = [
  'llm_openai',
  'llm_anthropic',
  'vapi_call',
  'stripe_fee',
  'printful_fulfillment',
  'replicate',
  'twilio',
  'elevenlabs',
  'other',
] as const

/**
 * GET /api/admin/cost-events/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('cost_events')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to fetch cost event' }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * PUT /api/admin/cost-events/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { occurred_at, source, amount, currency, reference_type, reference_id, metadata } = body

    const updates: Record<string, unknown> = {}
    if (occurred_at != null) updates.occurred_at = occurred_at
    if (source != null) {
      if (!VALID_SOURCES.includes(source)) {
        return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
      }
      updates.source = source
    }
    if (amount != null) {
      const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
      if (isNaN(numAmount) || numAmount < 0) {
        return NextResponse.json({ error: 'amount must be non-negative' }, { status: 400 })
      }
      updates.amount = numAmount
    }
    if (currency != null) updates.currency = currency
    if (reference_type !== undefined) updates.reference_type = reference_type
    if (reference_id !== undefined) updates.reference_id = reference_id
    if (metadata !== undefined) updates.metadata = metadata

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('cost_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23514') return NextResponse.json({ error: 'amount must be non-negative' }, { status: 400 })
      return NextResponse.json({ error: 'Failed to update cost event' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * DELETE /api/admin/cost-events/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = await params

  const { error } = await supabaseAdmin.from('cost_events').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete cost event' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
