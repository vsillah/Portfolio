import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/pain-points
 * List all pain point categories with evidence stats
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await supabaseAdmin
    .from('pain_point_categories')
    .select('*')
    .eq('is_active', true)
    .order('frequency_count', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get evidence counts per category
  const { data: evidenceCounts } = await supabaseAdmin
    .from('pain_point_evidence')
    .select('pain_point_category_id')

  const countMap: Record<string, number> = {}
  for (const e of evidenceCounts || []) {
    countMap[e.pain_point_category_id] = (countMap[e.pain_point_category_id] || 0) + 1
  }

  // Get calculation counts + confidence breakdown per category
  const { data: calcRows } = await supabaseAdmin
    .from('value_calculations')
    .select('pain_point_category_id, confidence_level')
    .eq('is_active', true)

  const calcMap: Record<string, number> = {}
  const confidenceMap: Record<string, { high: number; medium: number; low: number }> = {}
  for (const c of calcRows || []) {
    const catId = c.pain_point_category_id
    calcMap[catId] = (calcMap[catId] || 0) + 1
    if (!confidenceMap[catId]) confidenceMap[catId] = { high: 0, medium: 0, low: 0 }
    const level = c.confidence_level as 'high' | 'medium' | 'low'
    if (confidenceMap[catId][level] !== undefined) {
      confidenceMap[catId][level]++
    }
  }

  const enriched = (data || []).map((pp: any) => ({
    ...pp,
    evidence_count: countMap[pp.id] || 0,
    calculation_count: calcMap[pp.id] || 0,
    confidence_breakdown: confidenceMap[pp.id] || { high: 0, medium: 0, low: 0 },
  }))

  return NextResponse.json({ painPoints: enriched })
}

/**
 * POST /api/admin/value-evidence/pain-points
 * Create a new pain point category
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { name, display_name, description, related_services, related_products, industry_tags } = body

  if (!name || !display_name) {
    return NextResponse.json(
      { error: 'name and display_name are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('pain_point_categories')
    .insert({
      name,
      display_name,
      description: description || null,
      related_services: related_services || [],
      related_products: related_products || [],
      industry_tags: industry_tags || [],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ painPoint: data })
}
