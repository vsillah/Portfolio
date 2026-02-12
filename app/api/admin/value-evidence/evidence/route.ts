import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/evidence?contact_id=<id>
 * Returns pain point evidence and value reports for a contact (for the evidence drawer).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const contactIdParam = searchParams.get('contact_id')
  if (!contactIdParam) {
    return NextResponse.json(
      { error: 'contact_id query parameter is required' },
      { status: 400 }
    )
  }

  const contactId = parseInt(contactIdParam, 10)
  if (!Number.isInteger(contactId) || contactId <= 0) {
    return NextResponse.json(
      { error: 'contact_id must be a positive integer' },
      { status: 400 }
    )
  }

  const [
    { data: evidenceRows, error: evidenceError },
    { count: evidenceCount },
    { data: reports, error: reportsError },
  ] = await Promise.all([
    supabaseAdmin
      .from('pain_point_evidence')
      .select(`
        id,
        source_type,
        source_id,
        source_excerpt,
        confidence_score,
        monetary_indicator,
        monetary_context,
        created_at,
        pain_point_categories(display_name)
      `)
      .eq('contact_submission_id', contactId)
      .order('confidence_score', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('pain_point_evidence')
      .select('id', { count: 'exact', head: true })
      .eq('contact_submission_id', contactId),
    supabaseAdmin
      .from('value_reports')
      .select('id, title, total_annual_value, created_at')
      .eq('contact_submission_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (evidenceError) {
    console.error('Evidence fetch error:', evidenceError)
    return NextResponse.json(
      { error: 'Failed to fetch evidence' },
      { status: 500 }
    )
  }
  if (reportsError) {
    console.error('Reports fetch error:', reportsError)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }

  const evidence = (evidenceRows || []).map((row: {
    id: string
    source_type: string
    source_id: string
    source_excerpt: string
    confidence_score: number
    monetary_indicator: number | null
    monetary_context: string | null
    created_at: string
    pain_point_categories: { display_name: string } | null
  }) => ({
    id: row.id,
    source_type: row.source_type,
    source_id: row.source_id,
    source_excerpt: row.source_excerpt,
    confidence_score: row.confidence_score,
    monetary_indicator: row.monetary_indicator,
    monetary_context: row.monetary_context,
    created_at: row.created_at,
    display_name: row.pain_point_categories?.display_name ?? null,
  }))

  return NextResponse.json({
    evidence,
    reports: reports || [],
    totalEvidenceCount: evidenceCount ?? 0,
  })
}

/**
 * DELETE /api/admin/value-evidence/evidence?contact_id=<id>
 * Clears all pain point evidence for a contact and resets VEP status.
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const contactIdParam = searchParams.get('contact_id')
  if (!contactIdParam) {
    return NextResponse.json(
      { error: 'contact_id query parameter is required' },
      { status: 400 }
    )
  }

  const contactId = parseInt(contactIdParam, 10)
  if (!Number.isInteger(contactId) || contactId <= 0) {
    return NextResponse.json(
      { error: 'contact_id must be a positive integer' },
      { status: 400 }
    )
  }

  const { error: deleteError, count } = await supabaseAdmin
    .from('pain_point_evidence')
    .delete()
    .eq('contact_submission_id', contactId)
    .select('id', { count: 'exact', head: true })

  if (deleteError) {
    console.error('Evidence delete error:', deleteError)
    return NextResponse.json(
      { error: 'Failed to delete evidence' },
      { status: 500 }
    )
  }

  // Reset VEP status so the lead can be re-pushed
  await supabaseAdmin
    .from('contact_submissions')
    .update({ last_vep_status: null, last_vep_triggered_at: null })
    .eq('id', contactId)

  return NextResponse.json({ deleted: count ?? 0 })
}
