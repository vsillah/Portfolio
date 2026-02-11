import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const VALID_SOURCES = ['facebook', 'google_contacts', 'linkedin'] as const
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/**
 * GET /api/admin/outreach/last-run?source=facebook
 * Used by n8n at the start of a warm lead workflow to decide whether to run the external API.
 * Auth: Bearer N8N_INGEST_SECRET (same as ingest).
 * Returns { lastSuccessAt: string | null, shouldRun: boolean }. shouldRun is false when
 * the last successful run was within the last 24 hours.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.N8N_INGEST_SECRET
    const token = authHeader?.replace('Bearer ', '')

    if (!expectedSecret || token !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')

    if (!source || !VALID_SOURCES.includes(source as (typeof VALID_SOURCES)[number])) {
      return NextResponse.json(
        { error: `source is required and must be one of: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('warm_lead_trigger_audit')
      .select('completed_at, triggered_at')
      .eq('source', source)
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('last-run query error:', error)
      return NextResponse.json(
        { error: 'Failed to read last run' },
        { status: 500 }
      )
    }

    const lastSuccessAt = data
      ? (data.completed_at ?? data.triggered_at)
        ? new Date(data.completed_at ?? data.triggered_at!).toISOString()
        : null
      : null

    const now = Date.now()
    const lastMs = lastSuccessAt ? new Date(lastSuccessAt).getTime() : 0
    const shouldRun = !lastSuccessAt || now - lastMs >= TWENTY_FOUR_HOURS_MS

    return NextResponse.json({
      lastSuccessAt,
      shouldRun
    })
  } catch (err) {
    console.error('last-run error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
