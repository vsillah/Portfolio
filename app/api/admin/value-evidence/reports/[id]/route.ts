import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/reports/[id]
 * Get full report with evidence chain and benchmarks used
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('value_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // If linked to a contact, get contact info
  let contact = null
  if (data.contact_submission_id) {
    const { data: contactData } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, name, email, company, industry, employee_count, lead_score')
      .eq('id', data.contact_submission_id)
      .single()
    contact = contactData
  }

  // Collect benchmark IDs from evidence_chain.calculations
  const benchmarkIds = new Set<string>()
  const ec = data.evidence_chain as { calculations?: Array<{ benchmarksUsed?: string[]; benchmarks_used?: string[] }> } | null
  if (ec?.calculations) {
    for (const calc of ec.calculations) {
      const ids = calc.benchmarksUsed ?? calc.benchmarks_used ?? []
      for (const bid of ids) {
        if (typeof bid === 'string' && bid.length > 0) benchmarkIds.add(bid)
      }
    }
  }

  // Also collect from value_calculations if report has calculation_ids
  const calculationIds = (data.calculation_ids as string[] | null) ?? []
  if (calculationIds.length > 0) {
    const { data: calcs } = await supabaseAdmin
      .from('value_calculations')
      .select('benchmark_ids')
      .in('id', calculationIds)
    for (const c of calcs ?? []) {
      const ids = (c.benchmark_ids as string[] | null) ?? []
      for (const bid of ids) {
        if (typeof bid === 'string' && bid.length > 0) benchmarkIds.add(bid)
      }
    }
  }

  // Fetch benchmark details (source, source_url, etc.)
  let benchmarks: Array<{
    id: string
    industry: string
    company_size_range: string
    benchmark_type: string
    value: number
    source: string
    source_url: string | null
    year: number
    notes: string | null
  }> = []

  if (benchmarkIds.size > 0) {
    const { data: benchRows } = await supabaseAdmin
      .from('industry_benchmarks')
      .select('id, industry, company_size_range, benchmark_type, value, source, source_url, year, notes')
      .in('id', Array.from(benchmarkIds))
    benchmarks = (benchRows ?? []).map((b: Record<string, unknown>) => ({
      id: b.id as string,
      industry: b.industry as string,
      company_size_range: b.company_size_range as string,
      benchmark_type: b.benchmark_type as string,
      value: Number(b.value),
      source: b.source as string,
      source_url: (b.source_url as string | null) ?? null,
      year: b.year as number,
      notes: (b.notes as string | null) ?? null,
    }))
    // Dedupe and sort by industry, type
    benchmarks = benchmarks
      .filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i)
      .sort((a, b) => a.industry.localeCompare(b.industry) || a.benchmark_type.localeCompare(b.benchmark_type))
  }

  return NextResponse.json({ report: data, contact, benchmarks })
}
