/**
 * Evidence-to-Calculation Linking Engine (server-side only)
 *
 * Bridges scraped pain_point_evidence with value_calculations by:
 * 1. Counting evidence per category + industry
 * 2. Updating evidence_count, evidence_ids, confidence_level on calculations
 * 3. Recalculating annual_value when sufficient monetary evidence exists
 *
 * Must only be imported in server-side code (API routes) because it uses supabaseAdmin.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  determineConfidence,
  runCalculation,
  PAIN_POINT_DEFAULT_METHODS,
  type CalculationMethod,
  type ConfidenceLevel,
} from '@/lib/value-calculations'

// ============================================================================
// Types
// ============================================================================

export interface LinkResult {
  calculationId: string
  industry: string
  oldConfidence: ConfidenceLevel
  newConfidence: ConfidenceLevel
  oldValue: number
  newValue: number
  evidenceCount: number
  recalculated: boolean
}

export interface LinkSummary {
  updated: number
  recalculated: number
  details: LinkResult[]
}

interface EvidenceRow {
  id: string
  industry: string | null
  monetary_indicator: string | null
}

interface EvidenceStats {
  industry: string
  totalCount: number
  monetaryCount: number
  monetaryAvg: number | null
  evidenceIds: string[]
}

/**
 * Maps calculation methods to the formula input key that monetary evidence
 * should adjust. Only applies when evidence provides a reasonable signal.
 */
const MONETARY_INPUT_KEY: Partial<Record<CalculationMethod, string>> = {
  opportunity_cost: 'avg_deal_value',
  time_saved: 'hourly_rate',
  replacement_cost: 'avg_salary',
  error_reduction: 'cost_per_error',
}

// ============================================================================
// Core Linking Function
// ============================================================================

/**
 * Link evidence to calculations for a specific pain point category.
 * Optionally filter to a single industry.
 */
export async function linkEvidenceToCalculations(
  painPointCategoryId: string,
  filterIndustry?: string
): Promise<LinkSummary> {
  const sb = supabaseAdmin
  if (!sb) throw new Error('supabaseAdmin not available (server-side only)')

  // 1. Get the pain point category name (needed for method lookup)
  const { data: category } = await sb
    .from('pain_point_categories')
    .select('id, name')
    .eq('id', painPointCategoryId)
    .single()

  if (!category) return { updated: 0, recalculated: 0, details: [] }

  // 2. Get all evidence for this category
  let evidenceQuery = sb
    .from('pain_point_evidence')
    .select('id, industry, monetary_indicator')
    .eq('pain_point_category_id', painPointCategoryId)
    .order('created_at', { ascending: false })

  if (filterIndustry) {
    evidenceQuery = evidenceQuery.eq('industry', filterIndustry)
  }

  const { data: allEvidence } = await evidenceQuery

  if (!allEvidence || allEvidence.length === 0) {
    return { updated: 0, recalculated: 0, details: [] }
  }

  // 3. Aggregate evidence stats by industry
  const statsByIndustry = new Map<string, EvidenceStats>()

  for (const ev of allEvidence) {
    const ind = ev.industry || '_all'
    let stats = statsByIndustry.get(ind)
    if (!stats) {
      stats = { industry: ind, totalCount: 0, monetaryCount: 0, monetaryAvg: null, evidenceIds: [] }
      statsByIndustry.set(ind, stats)
    }
    stats.totalCount++
    if (stats.evidenceIds.length < 50) stats.evidenceIds.push(ev.id)
    if (ev.monetary_indicator != null && parseFloat(ev.monetary_indicator) > 0) {
      stats.monetaryCount++
    }
  }

  // Compute monetary averages
  for (const [ind, stats] of statsByIndustry) {
    if (stats.monetaryCount > 0) {
      const monetaryItems = allEvidence.filter(
        (e: { industry: string | null; monetary_indicator: string | null }) =>
          (e.industry || '_all') === ind &&
          e.monetary_indicator != null &&
          parseFloat(e.monetary_indicator!) > 0
      )
      const sum = monetaryItems.reduce(
        (s: number, e: { monetary_indicator: string | null }) => s + parseFloat(e.monetary_indicator!), 0
      )
      stats.monetaryAvg = sum / monetaryItems.length
    }
  }

  // Also create an _all bucket aggregating across industries
  const hasMoney = (e: EvidenceRow) => e.monetary_indicator != null && parseFloat(e.monetary_indicator!) > 0
  const allStats: EvidenceStats = {
    industry: '_all',
    totalCount: allEvidence.length,
    monetaryCount: allEvidence.filter(hasMoney).length,
    monetaryAvg: null,
    evidenceIds: allEvidence.slice(0, 50).map((e: EvidenceRow) => e.id),
  }
  if (allStats.monetaryCount > 0) {
    const monetaryAll = allEvidence.filter(hasMoney)
    allStats.monetaryAvg = monetaryAll.reduce((s: number, e: EvidenceRow) => s + parseFloat(e.monetary_indicator!), 0) / monetaryAll.length
  }

  // 4. Get calculations for this category
  let calcQuery = sb
    .from('value_calculations')
    .select('id, industry, company_size_range, calculation_method, formula_inputs, annual_value, confidence_level, evidence_count, benchmark_ids')
    .eq('pain_point_category_id', painPointCategoryId)
    .eq('is_active', true)

  if (filterIndustry) {
    calcQuery = calcQuery.eq('industry', filterIndustry)
  }

  const { data: calculations } = await calcQuery

  if (!calculations || calculations.length === 0) {
    return { updated: 0, recalculated: 0, details: [] }
  }

  // 5. Update each calculation
  const details: LinkResult[] = []
  const methodConfig = PAIN_POINT_DEFAULT_METHODS[category.name]

  for (const calc of calculations) {
    const industryStats = statsByIndustry.get(calc.industry) || allStats
    const evidenceCount = industryStats.totalCount
    const hasBenchmarks = (calc.benchmark_ids?.length || 0) > 0
    const hasMonetaryEvidence = industryStats.monetaryCount > 0
    const newConfidence = determineConfidence(evidenceCount, hasBenchmarks, hasMonetaryEvidence)

    const oldConfidence = calc.confidence_level as ConfidenceLevel
    const oldValue = parseFloat(calc.annual_value)
    let newValue = oldValue
    let recalculated = false

    // Attempt monetary-evidence-driven recalculation
    if (
      methodConfig &&
      industryStats.monetaryCount >= 2 &&
      industryStats.monetaryAvg != null &&
      industryStats.monetaryAvg > 0
    ) {
      const inputKey = MONETARY_INPUT_KEY[calc.calculation_method as CalculationMethod]
      if (inputKey) {
        const currentInput = calc.formula_inputs?.[inputKey]
        if (currentInput && currentInput > 0) {
          const ratio = industryStats.monetaryAvg / currentInput
          // Only apply if within 0.1x - 10x of current value (sanity guard)
          if (ratio >= 0.1 && ratio <= 10) {
            const adjustedInputs = { ...calc.formula_inputs, [inputKey]: industryStats.monetaryAvg }
            const result = runCalculation(calc.calculation_method as CalculationMethod, adjustedInputs)
            newValue = result.annualValue
            recalculated = true
          }
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      evidence_count: evidenceCount,
      evidence_ids: industryStats.evidenceIds,
      confidence_level: newConfidence,
    }

    if (recalculated) {
      updatePayload.annual_value = newValue
      updatePayload.generated_by = 'ai'
      const inputKey = MONETARY_INPUT_KEY[calc.calculation_method as CalculationMethod]
      if (inputKey && industryStats.monetaryAvg != null) {
        updatePayload.formula_inputs = { ...calc.formula_inputs, [inputKey]: industryStats.monetaryAvg }
      }
    }

    await sb
      .from('value_calculations')
      .update(updatePayload)
      .eq('id', calc.id)

    details.push({
      calculationId: calc.id,
      industry: calc.industry,
      oldConfidence,
      newConfidence,
      oldValue,
      newValue,
      evidenceCount,
      recalculated,
    })
  }

  return {
    updated: details.length,
    recalculated: details.filter(d => d.recalculated).length,
    details,
  }
}

// ============================================================================
// Category Stats Refresh
// ============================================================================

/**
 * Refresh frequency_count and avg_monetary_impact on a pain_point_categories row.
 * Tries the RPC first; falls back to a manual query if the function isn't deployed.
 */
export async function refreshCategoryStats(
  sb: NonNullable<typeof supabaseAdmin>,
  categoryId: string
): Promise<void> {
  const { error: rpcError } = await sb.rpc('refresh_pain_point_stats', { p_category_id: categoryId })

  if (!rpcError) return

  // Fallback: manual computation
  const { data: evStats } = await sb
    .from('pain_point_evidence')
    .select('monetary_indicator')
    .eq('pain_point_category_id', categoryId)

  const count = evStats?.length || 0
  const monetaryItems = (evStats || []).filter(
    (e: { monetary_indicator: string | null }) => e.monetary_indicator != null && parseFloat(e.monetary_indicator!) > 0
  )
  const avg = monetaryItems.length > 0
    ? monetaryItems.reduce((s: number, e: { monetary_indicator: string | null }) => s + parseFloat(e.monetary_indicator!), 0) / monetaryItems.length
    : null

  await sb
    .from('pain_point_categories')
    .update({ frequency_count: count, avg_monetary_impact: avg })
    .eq('id', categoryId)
}

// ============================================================================
// Bulk Linking (all categories or filtered)
// ============================================================================

export async function bulkLinkEvidence(
  filterCategoryId?: string,
  filterIndustry?: string
): Promise<{
  categoriesProcessed: number
  calculationsUpdated: number
  calculationsRecalculated: number
}> {
  const sb = supabaseAdmin
  if (!sb) throw new Error('supabaseAdmin not available (server-side only)')

  let categoryIds: string[]

  if (filterCategoryId) {
    categoryIds = [filterCategoryId]
  } else {
    const { data: categories } = await sb
      .from('pain_point_categories')
      .select('id')
      .eq('is_active', true)

    categoryIds = (categories || []).map((c: { id: string }) => c.id)
  }

  let totalUpdated = 0
  let totalRecalculated = 0

  for (const catId of categoryIds) {
    const result = await linkEvidenceToCalculations(catId, filterIndustry)
    totalUpdated += result.updated
    totalRecalculated += result.recalculated

    // Refresh category stats (frequency_count + avg_monetary_impact)
    await refreshCategoryStats(sb, catId)
  }

  return {
    categoriesProcessed: categoryIds.length,
    calculationsUpdated: totalUpdated,
    calculationsRecalculated: totalRecalculated,
  }
}
