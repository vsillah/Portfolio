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

/**
 * PUT /api/admin/value-evidence/calculations
 * Update an existing calculation's editable fields
 */
export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { id, formula_inputs, annual_value, confidence_level, is_active } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (formula_inputs !== undefined) updates.formula_inputs = formula_inputs
  if (annual_value !== undefined) updates.annual_value = annual_value
  if (confidence_level !== undefined) updates.confidence_level = confidence_level
  if (is_active !== undefined) updates.is_active = is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('value_calculations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ calculation: data })
}

/**
 * DELETE /api/admin/value-evidence/calculations
 * Soft-delete (deactivate) a calculation
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
    .from('value_calculations')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
