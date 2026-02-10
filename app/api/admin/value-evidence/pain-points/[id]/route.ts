import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/pain-points/[id]
 * Full evidence chain for a single pain point category
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = params

  // Get the category
  const { data: category, error: catError } = await supabaseAdmin
    .from('pain_point_categories')
    .select('*')
    .eq('id', id)
    .single()

  if (catError || !category) {
    return NextResponse.json({ error: 'Pain point not found' }, { status: 404 })
  }

  // Get all evidence
  const { data: evidence } = await supabaseAdmin
    .from('pain_point_evidence')
    .select('*')
    .eq('pain_point_category_id', id)
    .order('confidence_score', { ascending: false })
    .limit(100)

  // Get all calculations
  const { data: calculations } = await supabaseAdmin
    .from('value_calculations')
    .select('*')
    .eq('pain_point_category_id', id)
    .eq('is_active', true)
    .order('annual_value', { ascending: false })

  // Get content mappings
  const { data: contentMappings } = await supabaseAdmin
    .from('content_pain_point_map')
    .select('*')
    .eq('pain_point_category_id', id)

  return NextResponse.json({
    category,
    evidence: evidence || [],
    calculations: calculations || [],
    contentMappings: contentMappings || [],
  })
}

/**
 * PATCH /api/admin/value-evidence/pain-points/[id]
 * Update a pain point category
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { display_name, description, related_services, related_products, industry_tags, is_active } = body

  const updates: Record<string, any> = {}
  if (display_name !== undefined) updates.display_name = display_name
  if (description !== undefined) updates.description = description
  if (related_services !== undefined) updates.related_services = related_services
  if (related_products !== undefined) updates.related_products = related_products
  if (industry_tags !== undefined) updates.industry_tags = industry_tags
  if (is_active !== undefined) updates.is_active = is_active

  const { data, error } = await supabaseAdmin
    .from('pain_point_categories')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ painPoint: data })
}
