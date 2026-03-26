/**
 * One-off script: run the evidence-to-calculation linking engine
 * for all active categories. Updates evidence_count, confidence_level,
 * and annual_value on value_calculations.
 *
 * Usage: npx tsx scripts/bulk-link-evidence.ts [--prod]
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

import { createClient } from '@supabase/supabase-js'
import {
  determineConfidence,
  runCalculation,
  PAIN_POINT_DEFAULT_METHODS,
  type CalculationMethod,
  type ConfidenceLevel,
} from '../lib/value-calculations'

const isProd = process.argv.includes('--prod')

const supabaseUrl = isProd
  ? process.env.PROD_SUPABASE_URL!
  : process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = isProd
  ? process.env.PROD_SUPABASE_SERVICE_ROLE_KEY!
  : process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error(`Missing ${isProd ? 'PROD_' : ''}SUPABASE env vars`)
  process.exit(1)
}

console.log(`Target: ${isProd ? 'PRODUCTION' : 'DEV'} (${supabaseUrl})`)

const sb = createClient(supabaseUrl, serviceRoleKey)

const MONETARY_INPUT_KEY: Partial<Record<CalculationMethod, string>> = {
  opportunity_cost: 'avg_deal_value',
  time_saved: 'hourly_rate',
  replacement_cost: 'avg_salary',
  error_reduction: 'cost_per_error',
}

async function linkCategory(categoryId: string, categoryName: string): Promise<{ updated: number; recalculated: number }> {
  const { data: allEvidence } = await sb
    .from('pain_point_evidence')
    .select('id, industry, monetary_indicator')
    .eq('pain_point_category_id', categoryId)
    .order('created_at', { ascending: false })

  if (!allEvidence?.length) return { updated: 0, recalculated: 0 }

  // Aggregate by industry
  const statsByIndustry = new Map<string, { totalCount: number; monetaryCount: number; monetaryAvg: number | null; evidenceIds: string[] }>()

  for (const ev of allEvidence) {
    const ind = ev.industry || '_all'
    let stats = statsByIndustry.get(ind)
    if (!stats) {
      stats = { totalCount: 0, monetaryCount: 0, monetaryAvg: null, evidenceIds: [] }
      statsByIndustry.set(ind, stats)
    }
    stats.totalCount++
    if (stats.evidenceIds.length < 50) stats.evidenceIds.push(ev.id)
    if (ev.monetary_indicator != null && parseFloat(ev.monetary_indicator) > 0) {
      stats.monetaryCount++
    }
  }

  // Monetary averages
  for (const [ind, stats] of statsByIndustry) {
    if (stats.monetaryCount > 0) {
      const monetaryItems = allEvidence.filter(
        (e: any) => (e.industry || '_all') === ind && e.monetary_indicator != null && parseFloat(e.monetary_indicator) > 0
      )
      const sum = monetaryItems.reduce((s: number, e: any) => s + parseFloat(e.monetary_indicator), 0)
      stats.monetaryAvg = sum / monetaryItems.length
    }
  }

  // _all bucket
  const hasMoney = (e: any) => e.monetary_indicator != null && parseFloat(e.monetary_indicator) > 0
  const allStats = {
    totalCount: allEvidence.length,
    monetaryCount: allEvidence.filter(hasMoney).length,
    monetaryAvg: null as number | null,
    evidenceIds: allEvidence.slice(0, 50).map((e: any) => e.id),
  }
  if (allStats.monetaryCount > 0) {
    const monetaryAll = allEvidence.filter(hasMoney)
    allStats.monetaryAvg = monetaryAll.reduce((s: number, e: any) => s + parseFloat(e.monetary_indicator), 0) / monetaryAll.length
  }

  // Get active calculations
  const { data: calculations } = await sb
    .from('value_calculations')
    .select('id, industry, company_size_range, calculation_method, formula_inputs, annual_value, confidence_level, evidence_count, benchmark_ids')
    .eq('pain_point_category_id', categoryId)
    .eq('is_active', true)

  if (!calculations?.length) return { updated: 0, recalculated: 0 }

  const methodConfig = PAIN_POINT_DEFAULT_METHODS[categoryName]
  let updated = 0
  let recalculated = 0

  for (const calc of calculations) {
    const industryStats = statsByIndustry.get(calc.industry) || allStats
    const evidenceCount = industryStats.totalCount
    const hasBenchmarks = (calc.benchmark_ids?.length || 0) > 0
    const hasMonetaryEvidence = industryStats.monetaryCount > 0
    const newConfidence = determineConfidence(evidenceCount, hasBenchmarks, hasMonetaryEvidence)

    const oldValue = parseFloat(calc.annual_value)
    let newValue = oldValue
    let didRecalc = false

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
          if (ratio >= 0.1 && ratio <= 10) {
            const adjustedInputs = { ...calc.formula_inputs, [inputKey]: industryStats.monetaryAvg }
            const result = runCalculation(calc.calculation_method as CalculationMethod, adjustedInputs)
            newValue = result.annualValue
            didRecalc = true
          }
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      evidence_count: evidenceCount,
      evidence_ids: industryStats.evidenceIds,
      confidence_level: newConfidence,
    }

    if (didRecalc) {
      updatePayload.annual_value = newValue
      updatePayload.generated_by = 'ai'
      const inputKey = MONETARY_INPUT_KEY[calc.calculation_method as CalculationMethod]
      if (inputKey && industryStats.monetaryAvg != null) {
        updatePayload.formula_inputs = { ...calc.formula_inputs, [inputKey]: industryStats.monetaryAvg }
      }
    }

    await sb.from('value_calculations').update(updatePayload).eq('id', calc.id)

    updated++
    if (didRecalc) recalculated++
  }

  return { updated, recalculated }
}

async function main() {
  const { data: categories, error } = await sb
    .from('pain_point_categories')
    .select('id, name, display_name')
    .eq('is_active', true)

  if (error || !categories?.length) {
    console.error('Failed to load categories:', error?.message)
    process.exit(1)
  }

  console.log(`Processing ${categories.length} categories...\n`)

  let totalUpdated = 0
  let totalRecalculated = 0

  for (const cat of categories) {
    const result = await linkCategory(cat.id, cat.name)
    if (result.updated > 0) {
      console.log(`${cat.display_name}: ${result.updated} calcs updated, ${result.recalculated} recalculated`)
    }
    totalUpdated += result.updated
    totalRecalculated += result.recalculated

    // Refresh category stats
    const { data: evStats } = await sb
      .from('pain_point_evidence')
      .select('monetary_indicator')
      .eq('pain_point_category_id', cat.id)

    const count = evStats?.length || 0
    const monetaryItems = (evStats || []).filter(
      (e: any) => e.monetary_indicator != null && parseFloat(e.monetary_indicator) > 0
    )
    const avg = monetaryItems.length > 0
      ? monetaryItems.reduce((s: number, e: any) => s + parseFloat(e.monetary_indicator), 0) / monetaryItems.length
      : null

    await sb.from('pain_point_categories').update({ frequency_count: count, avg_monetary_impact: avg }).eq('id', cat.id)
  }

  console.log(`\n=== Summary ===`)
  console.log(`Calculations updated: ${totalUpdated}`)
  console.log(`Calculations recalculated (value adjusted): ${totalRecalculated}`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
