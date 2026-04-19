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
        pain_point_category_id,
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

  type EvidenceRow = {
    id: string
    pain_point_category_id: string
    source_type: string
    source_id: string
    source_excerpt: string
    confidence_score: number
    monetary_indicator: number | null
    monetary_context: string | null
    created_at: string
    pain_point_categories: { display_name: string } | null
  }

  // Dedupe repeated lead-enrichment runs: the classifier re-runs stack fresh
  // rows for the same contact + pain point category, often with slightly
  // different monetary estimates. Collapse to a single row per category,
  // keeping the highest-confidence representative (ties broken by most
  // recent). Surface occurrence_count and monetary min/max so the UI can
  // show provenance and range.
  const rawRows = (evidenceRows || []) as EvidenceRow[]
  type DedupeEntry = {
    row: EvidenceRow
    count: number
    monetary_min: number | null
    monetary_max: number | null
  }
  const dedupeMap = new Map<string, DedupeEntry>()
  for (const row of rawRows) {
    const key = row.pain_point_category_id ?? `__no_category__:${row.id}`
    const amount =
      row.monetary_indicator == null ? null : Number(row.monetary_indicator)
    const existing = dedupeMap.get(key)
    if (!existing) {
      dedupeMap.set(key, {
        row,
        count: 1,
        monetary_min: amount,
        monetary_max: amount,
      })
      continue
    }
    existing.count += 1
    if (amount != null) {
      existing.monetary_min =
        existing.monetary_min == null ? amount : Math.min(existing.monetary_min, amount)
      existing.monetary_max =
        existing.monetary_max == null ? amount : Math.max(existing.monetary_max, amount)
    }
    const prevConf = Number(existing.row.confidence_score ?? 0)
    const curConf = Number(row.confidence_score ?? 0)
    const shouldReplace =
      curConf > prevConf ||
      (curConf === prevConf &&
        new Date(row.created_at).getTime() > new Date(existing.row.created_at).getTime())
    if (shouldReplace) existing.row = row
  }
  const dedupedRows = [...dedupeMap.values()].sort(
    (a, b) => Number(b.row.confidence_score ?? 0) - Number(a.row.confidence_score ?? 0)
  )

  const evidence = dedupedRows.map(({ row, count, monetary_min, monetary_max }) => ({
    id: row.id,
    source_type: row.source_type,
    source_id: row.source_id,
    source_excerpt: row.source_excerpt,
    confidence_score: row.confidence_score,
    monetary_indicator: row.monetary_indicator,
    monetary_min,
    monetary_max,
    monetary_context: row.monetary_context,
    created_at: row.created_at,
    display_name: row.pain_point_categories?.display_name ?? null,
    occurrence_count: count,
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
