import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/** Valid cost event sources */
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

type CostEventSource = (typeof VALID_SOURCES)[number]

function isValidSource(s: string): s is CostEventSource {
  return VALID_SOURCES.includes(s as CostEventSource)
}

/**
 * GET /api/admin/cost-events
 * List cost events with optional filters (from, to, source)
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const source = searchParams.get('source')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const offset = (page - 1) * limit

  let query = supabaseAdmin
    .from('cost_events')
    .select('*', { count: 'exact' })
    .order('occurred_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (from) {
    query = query.gte('occurred_at', from)
  }
  if (to) {
    query = query.lte('occurred_at', to)
  }
  if (source && source !== 'all') {
    query = query.eq('source', source)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching cost events:', error)
    return NextResponse.json({ error: 'Failed to fetch cost events' }, { status: 500 })
  }

  return NextResponse.json({
    items: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

/**
 * POST /api/admin/cost-events
 * Create a cost event (admin only)
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()
    const { occurred_at, source, amount, currency, reference_type, reference_id, agent_run_id, metadata } = body

    if (!occurred_at || !source || amount == null || amount === '') {
      return NextResponse.json(
        { error: 'occurred_at, source, and amount are required' },
        { status: 400 }
      )
    }

    if (!isValidSource(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      )
    }

    const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
    if (isNaN(numAmount) || numAmount < 0) {
      return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('cost_events')
      .insert({
        occurred_at,
        source,
        amount: numAmount,
        currency: currency || 'usd',
        reference_type: reference_type || null,
        reference_id: reference_id || null,
        agent_run_id: agent_run_id || null,
        metadata: metadata || {},
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Duplicate cost event (idempotency: same source, reference, occurred_at)' },
          { status: 409 }
        )
      }
      if (error.code === '23514') {
        return NextResponse.json({ error: 'amount must be non-negative' }, { status: 400 })
      }
      console.error('Error creating cost event:', error)
      return NextResponse.json({ error: 'Failed to create cost event' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/admin/cost-events:', err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
