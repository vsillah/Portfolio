import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/cost-events/ingest
 *
 * Ingest cost events from n8n, webhooks, or external systems.
 * Authenticated via N8N_INGEST_SECRET bearer token (no session).
 * Uses service role to bypass RLS.
 *
 * Idempotency: when reference_type and reference_id are provided, duplicate
 * (source, reference_type, reference_id, occurred_at) will be rejected by DB.
 * For events without reference, caller can use metadata.idempotency_key and
 * check before insert in application logic if needed.
 */

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

interface IngestCostEvent {
  occurred_at: string
  source: string
  amount: number
  currency?: string
  reference_type?: string
  reference_id?: string
  agent_run_id?: string
  metadata?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET

  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const events: IngestCostEvent[] = Array.isArray(body) ? body : body.events || [body]

    if (events.length === 0) {
      return NextResponse.json({ total: 0, inserted: 0, errors: [] })
    }

    const results = { total: events.length, inserted: 0, errors: [] as string[] }

    for (const item of events) {
      try {
        if (!item.occurred_at || !item.source || item.amount == null) {
          results.errors.push(`Missing required fields: occurred_at, source, amount`)
          continue
        }

        if (!VALID_SOURCES.includes(item.source as (typeof VALID_SOURCES)[number])) {
          results.errors.push(`Invalid source: ${item.source}`)
          continue
        }

        const numAmount = typeof item.amount === 'string' ? parseFloat(item.amount) : Number(item.amount)
        if (isNaN(numAmount) || numAmount < 0) {
          results.errors.push(`Invalid amount: ${item.amount}`)
          continue
        }

        const { error } = await supabaseAdmin.from('cost_events').insert({
          occurred_at: item.occurred_at,
          source: item.source,
          amount: numAmount,
          currency: item.currency || 'usd',
          reference_type: item.reference_type || null,
          reference_id: item.reference_id || null,
          agent_run_id: item.agent_run_id || null,
          metadata: item.metadata || {},
        })

        if (error) {
          if (error.code === '23505') {
            results.errors.push(`Duplicate (idempotent skip): ${item.source} ${item.reference_id || ''} ${item.occurred_at}`)
            continue
          }
          if (error.code === '23514') {
            results.errors.push(`amount must be non-negative: ${item.amount}`)
            continue
          }
          results.errors.push(error.message)
          continue
        }

        results.inserted++
      } catch (e) {
        results.errors.push(String(e))
      }
    }

    return NextResponse.json(results)
  } catch (err) {
    console.error('Error in POST /api/admin/cost-events/ingest:', err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
