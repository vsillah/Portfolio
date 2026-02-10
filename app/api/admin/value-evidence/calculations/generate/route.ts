import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  autoGenerateCalculation,
  normalizeCompanySize,
  type IndustryBenchmark,
} from '@/lib/value-calculations'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/calculations/generate
 * Auto-generate a value calculation for a pain point + industry + size
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { pain_point_category_id, industry, company_size_range } = body

  if (!pain_point_category_id || !industry) {
    return NextResponse.json(
      { error: 'pain_point_category_id and industry are required' },
      { status: 400 }
    )
  }

  const normalizedSize = normalizeCompanySize(company_size_range || '11-50')

  // Get pain point category
  const { data: category } = await supabaseAdmin
    .from('pain_point_categories')
    .select('*')
    .eq('id', pain_point_category_id)
    .single()

  if (!category) {
    return NextResponse.json({ error: 'Pain point category not found' }, { status: 404 })
  }

  // Get benchmarks
  const { data: benchmarks } = await supabaseAdmin
    .from('industry_benchmarks')
    .select('*')
    .or(`industry.eq.${industry},industry.eq._default`)

  // Get evidence count
  const { count: evidenceCount } = await supabaseAdmin
    .from('pain_point_evidence')
    .select('*', { count: 'exact', head: true })
    .eq('pain_point_category_id', pain_point_category_id)
    .or(`industry.eq.${industry},industry.is.null`)

  // Check for direct monetary evidence
  const { count: monetaryCount } = await supabaseAdmin
    .from('pain_point_evidence')
    .select('*', { count: 'exact', head: true })
    .eq('pain_point_category_id', pain_point_category_id)
    .not('monetary_indicator', 'is', null)

  // Generate calculation
  const result = autoGenerateCalculation(
    category.name,
    (benchmarks || []) as IndustryBenchmark[],
    industry,
    normalizedSize,
    evidenceCount || 0,
    (monetaryCount || 0) > 0
  )

  if (!result) {
    return NextResponse.json(
      { error: `No calculation method configured for pain point: ${category.name}` },
      { status: 422 }
    )
  }

  // Save to database
  const { data: saved, error: saveError } = await supabaseAdmin
    .from('value_calculations')
    .insert({
      pain_point_category_id,
      industry,
      company_size_range: normalizedSize,
      calculation_method: result.method,
      formula_inputs: result.formulaInputs,
      formula_expression: result.formulaReadable,
      annual_value: result.annualValue,
      confidence_level: result.confidenceLevel,
      evidence_count: evidenceCount || 0,
      benchmark_ids: result.benchmarksUsed.map(b => b.id),
      evidence_ids: [],
      generated_by: 'system',
    })
    .select()
    .single()

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  return NextResponse.json({
    calculation: saved,
    details: {
      method: result.method,
      formulaReadable: result.formulaReadable,
      annualValue: result.annualValue,
      confidenceLevel: result.confidenceLevel,
      benchmarksUsed: result.benchmarksUsed,
      evidenceCount: evidenceCount || 0,
    },
  })
}
