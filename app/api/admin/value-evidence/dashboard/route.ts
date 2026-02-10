import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/dashboard
 * Aggregated stats for the value evidence admin dashboard
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Pain point category stats
  const { data: categories } = await supabaseAdmin
    .from('pain_point_categories')
    .select('id, name, display_name, frequency_count, avg_monetary_impact, industry_tags')
    .eq('is_active', true)
    .order('frequency_count', { ascending: false })
    .limit(20)

  // Total evidence count
  const { count: totalEvidence } = await supabaseAdmin
    .from('pain_point_evidence')
    .select('*', { count: 'exact', head: true })

  // Evidence by source type
  const { data: evidenceBySource } = await supabaseAdmin
    .from('pain_point_evidence')
    .select('source_type')

  const sourceBreakdown: Record<string, number> = {}
  for (const e of evidenceBySource || []) {
    sourceBreakdown[e.source_type] = (sourceBreakdown[e.source_type] || 0) + 1
  }

  // Market intelligence stats
  const { count: totalMarketIntel } = await supabaseAdmin
    .from('market_intelligence')
    .select('*', { count: 'exact', head: true })

  const { count: unprocessedMarketIntel } = await supabaseAdmin
    .from('market_intelligence')
    .select('*', { count: 'exact', head: true })
    .eq('is_processed', false)

  // Top calculations by value
  const { data: topCalculations } = await supabaseAdmin
    .from('value_calculations')
    .select(`
      id, industry, company_size_range, calculation_method,
      formula_expression, annual_value, confidence_level, evidence_count,
      pain_point_categories (display_name)
    `)
    .eq('is_active', true)
    .order('annual_value', { ascending: false })
    .limit(10)

  // Industry breakdown of calculations
  const { data: calcsByIndustry } = await supabaseAdmin
    .from('value_calculations')
    .select('industry, annual_value')
    .eq('is_active', true)

  const industryTotals: Record<string, { count: number; totalValue: number }> = {}
  for (const c of calcsByIndustry || []) {
    if (!industryTotals[c.industry]) {
      industryTotals[c.industry] = { count: 0, totalValue: 0 }
    }
    industryTotals[c.industry].count++
    industryTotals[c.industry].totalValue += parseFloat(c.annual_value) || 0
  }

  // Report stats
  const { count: totalReports } = await supabaseAdmin
    .from('value_reports')
    .select('*', { count: 'exact', head: true })

  // Benchmark count
  const { count: totalBenchmarks } = await supabaseAdmin
    .from('industry_benchmarks')
    .select('*', { count: 'exact', head: true })

  // Content mapping count
  const { count: totalMappings } = await supabaseAdmin
    .from('content_pain_point_map')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    overview: {
      totalPainPoints: categories?.length || 0,
      totalEvidence: totalEvidence || 0,
      totalMarketIntel: totalMarketIntel || 0,
      unprocessedMarketIntel: unprocessedMarketIntel || 0,
      totalCalculations: calcsByIndustry?.length || 0,
      totalReports: totalReports || 0,
      totalBenchmarks: totalBenchmarks || 0,
      totalContentMappings: totalMappings || 0,
    },
    topPainPoints: categories || [],
    topCalculations: topCalculations || [],
    evidenceBySource: sourceBreakdown,
    industryBreakdown: industryTotals,
  })
}
