import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/calculations
 * List value calculations, optionally filtered
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const industry = searchParams.get('industry')
  const companySize = searchParams.get('company_size')
  const painPointId = searchParams.get('pain_point_id')

  let query = supabaseAdmin
    .from('value_calculations')
    .select(`
      *,
      pain_point_categories (
        id, name, display_name
      )
    `)
    .eq('is_active', true)
    .order('annual_value', { ascending: false })

  if (industry) query = query.eq('industry', industry)
  if (companySize) query = query.eq('company_size_range', companySize)
  if (painPointId) query = query.eq('pain_point_category_id', painPointId)

  const { data, error } = await query.limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ calculations: data || [] })
}

/**
 * POST /api/admin/value-evidence/calculations
 * Create a manual calculation
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const {
    pain_point_category_id,
    industry,
    company_size_range,
    calculation_method,
    formula_inputs,
    formula_expression,
    annual_value,
    confidence_level,
    evidence_count,
    benchmark_ids,
    evidence_ids,
  } = body

  if (!pain_point_category_id || !industry || !company_size_range || !calculation_method || !formula_inputs || !formula_expression || annual_value === undefined) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('value_calculations')
    .insert({
      pain_point_category_id,
      industry,
      company_size_range,
      calculation_method,
      formula_inputs,
      formula_expression,
      annual_value,
      confidence_level: confidence_level || 'medium',
      evidence_count: evidence_count || 0,
      benchmark_ids: benchmark_ids || [],
      evidence_ids: evidence_ids || [],
      generated_by: 'manual',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ calculation: data })
}
