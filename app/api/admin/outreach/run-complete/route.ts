import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const VALID_SOURCES = ['facebook', 'google_contacts', 'linkedin'] as const

/**
 * POST /api/admin/outreach/run-complete
 * Called by n8n at the end of a warm lead workflow after a successful run (API call + ingest).
 * Records success so the next run will see "last run within 24h" and skip.
 * Auth: Bearer N8N_INGEST_SECRET (same as ingest).
 * Body: { source: "facebook" | "google_contacts" | "linkedin" }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}))
    const { source } = body as { source?: string }

    if (!source || !VALID_SOURCES.includes(source as (typeof VALID_SOURCES)[number])) {
      return NextResponse.json(
        { error: `source is required and must be one of: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      )
    }

    const completedAt = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('warm_lead_trigger_audit')
      .insert({
        source,
        triggered_by: null,
        triggered_at: completedAt,
        options: {},
        status: 'success',
        completed_at: completedAt
      })

    if (error) {
      console.error('run-complete insert error:', error)
      return NextResponse.json(
        { error: 'Failed to record run complete' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Run complete recorded for source: ${source}`
    })
  } catch (err) {
    console.error('run-complete error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
