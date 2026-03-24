import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/benchmarks
 * List industry benchmarks, optionally filtered by industry
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const industry = searchParams.get('industry')

  let query = supabaseAdmin
    .from('industry_benchmarks')
    .select('*')
    .order('industry')
    .order('company_size_range')
    .order('benchmark_type')

  if (industry) {
    query = query.or(`industry.eq.${industry},industry.eq._default`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by industry for easier consumption
  const grouped: Record<string, any[]> = {}
  for (const b of data || []) {
    if (!grouped[b.industry]) grouped[b.industry] = []
    grouped[b.industry].push(b)
  }

  return NextResponse.json({ benchmarks: data || [], grouped })
}

/**
 * POST /api/admin/value-evidence/benchmarks
 * Create or update a benchmark
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { industry, company_size_range, benchmark_type, value, source, source_url, year, notes } = body

  if (!industry || !company_size_range || !benchmark_type || value === undefined || !source || !year) {
    return NextResponse.json(
      { error: 'industry, company_size_range, benchmark_type, value, source, and year are required' },
      { status: 400 }
    )
  }

  // Upsert: update if same industry/size/type/year exists
  const { data, error } = await supabaseAdmin
    .from('industry_benchmarks')
    .upsert(
      {
        industry,
        company_size_range,
        benchmark_type,
        value,
        source,
        source_url: source_url || null,
        year,
        notes: notes || null,
      },
      { onConflict: 'industry,company_size_range,benchmark_type,year' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ benchmark: data })
}

/**
 * PUT /api/admin/value-evidence/benchmarks
 * Update an existing benchmark's editable fields
 */
export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { id, value, source, source_url, year, notes } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (value !== undefined) updates.value = value
  if (source !== undefined) updates.source = source
  if (source_url !== undefined) updates.source_url = source_url
  if (year !== undefined) updates.year = year
  if (notes !== undefined) updates.notes = notes

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('industry_benchmarks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ benchmark: data })
}

/**
 * DELETE /api/admin/value-evidence/benchmarks
 * Hard-delete a benchmark row
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('industry_benchmarks')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
