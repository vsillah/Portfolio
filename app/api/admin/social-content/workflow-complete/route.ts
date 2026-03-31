import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/social-content/workflow-complete
 * Called by n8n at the end of a WF-SOC-001 run.
 * Auth: Bearer N8N_INGEST_SECRET.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET

  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { run_id, status: completionStatus, items_inserted, error_message } = body as {
      run_id?: string
      status?: string
      items_inserted?: number
      error_message?: string
    }

    const status = completionStatus === 'failed' ? 'failed' : 'success'

    let run: { id: string } | null = null
    if (run_id) {
      const { data } = await supabaseAdmin
        .from('social_content_extraction_runs')
        .select('id')
        .eq('id', run_id)
        .single()
      run = data
    }
    if (!run) {
      const { data } = await supabaseAdmin
        .from('social_content_extraction_runs')
        .select('id')
        .eq('status', 'running')
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      run = data
    }

    if (!run) {
      return NextResponse.json(
        { error: 'No matching run found', ok: false },
        { status: 404 }
      )
    }

    const completedAt = new Date().toISOString()
    const update: Record<string, unknown> = {
      status,
      completed_at: completedAt,
    }
    if (items_inserted !== undefined && items_inserted !== null) {
      update.items_inserted = items_inserted
    }
    if (error_message !== undefined && error_message !== null) {
      update.error_message = error_message
    }

    const { error } = await supabaseAdmin
      .from('social_content_extraction_runs')
      .update(update)
      .eq('id', run.id)

    if (error) {
      console.error('social-content workflow-complete update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, run_id: run.id })
  } catch (err) {
    console.error('social-content workflow-complete error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
