/**
 * Acceleration Recommendation Engine
 *
 * Connects client assessment gaps to service offerings with data-backed
 * impact projections. Uses the value evidence pipeline (pain_point_categories,
 * content_pain_point_map, industry_benchmarks, value_calculations) to generate
 * personalized recommendations.
 *
 * Data source waterfall:
 *   1. Client-specific value_calculation (highest confidence)
 *   2. Industry benchmark for exact industry+size
 *   3. Blended (when both exist): 70% client-specific + 30% benchmark
 *   4. Cross-industry defaults (_default)
 */

import { supabaseAdmin } from './supabase'
import {
  findBestBenchmark,
  normalizeCompanySize,
  type IndustryBenchmark,
  type PainPointCategory,
  type ValueCalculation,
  type ConfidenceLevel,
} from './value-calculations'
import type { CategoryScores, GapAnalysis } from './assessment-scoring'
import { ASSESSMENT_CATEGORIES, CATEGORY_LABELS, calculateGapAnalysis } from './assessment-scoring'

// ============================================================================
// Types
// ============================================================================

export interface AccelerationRecommendation {
  id: string
  client_project_id: string
  pain_point_category_id: string | null
  content_type: string
  content_id: number
  service_title: string
  gap_category: string
  gap_description: string | null
  projected_impact_pct: number | null
  projected_annual_value: number | null
  impact_headline: string | null
  impact_explanation: string | null
  data_source: 'industry_benchmark' | 'client_specific' | 'blended'
  benchmark_ids: string[]
  value_calculation_id: string | null
  confidence_level: ConfidenceLevel
  display_order: number
  is_active: boolean
  cta_type: 'learn_more' | 'book_call' | 'view_proposal' | 'start_trial'
  cta_url: string | null
  dismissed_at: string | null
  converted_at: string | null
  created_at: string
  updated_at: string
}

interface ClientContext {
  projectId: string
  industry: string
  companySize: string
  contactSubmissionId: number | null
}

interface ContentMatch {
  contentType: string
  contentId: number
  title: string
  impactPercentage: number
  painPointCategory: PainPointCategory
}

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Generate acceleration recommendations for a client project.
 *
 * 1. Load client context (industry, company size)
 * 2. Identify gap categories from current scores
 * 3. Match pain points to services/products via content_pain_point_map
 * 4. Compute projected impact using benchmark/client data waterfall
 * 5. Insert into acceleration_recommendations
 */
export async function generateAccelerationRecs(
  clientProjectId: string,
  currentScores: CategoryScores
): Promise<{ count: number; error?: string }> {
  // Load client context
  const context = await loadClientContext(clientProjectId)
  if (!context) {
    return { count: 0, error: 'Could not load client context' }
  }

  // Identify gaps (sorted by largest gap first)
  const gaps = calculateGapAnalysis(currentScores)
    .filter((g) => g.gap > 10) // Only gaps worth addressing
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5) // Top 5 gaps

  if (gaps.length === 0) {
    return { count: 0 }
  }

  // Load all pain point categories + industry benchmarks
  const [painPoints, benchmarks, contentMaps] = await Promise.all([
    loadPainPointCategories(),
    loadBenchmarks(context.industry, context.companySize),
    loadContentPainPointMaps(),
  ])

  // Load client-specific value calculations if available
  const clientCalcs = context.contactSubmissionId
    ? await loadClientValueCalculations(context.industry, context.companySize)
    : []

  // For each gap, find matching services and compute impact
  const recommendations: Omit<AccelerationRecommendation, 'id' | 'created_at' | 'updated_at'>[] = []
  let displayOrder = 0

  for (const gap of gaps) {
    const matches = findContentMatches(gap, painPoints, contentMaps)

    for (const match of matches.slice(0, 2)) { // Max 2 recs per gap
      const impact = computeProjectedImpact(
        match,
        context,
        benchmarks,
        clientCalcs
      )

      recommendations.push({
        client_project_id: clientProjectId,
        pain_point_category_id: match.painPointCategory.id,
        content_type: match.contentType,
        content_id: match.contentId,
        service_title: match.title,
        gap_category: gap.category,
        gap_description: `Your ${gap.label} score is ${gap.currentScore}/100 (target: ${gap.dreamScore})`,
        projected_impact_pct: impact.impactPct,
        projected_annual_value: impact.annualValue,
        impact_headline: impact.headline,
        impact_explanation: impact.explanation,
        data_source: impact.dataSource,
        benchmark_ids: impact.benchmarkIds,
        value_calculation_id: impact.valueCalculationId,
        confidence_level: impact.confidence,
        display_order: displayOrder++,
        is_active: true,
        cta_type: 'learn_more',
        cta_url: match.contentType === 'service'
          ? `/services`
          : `/store/${match.contentId}`,
        dismissed_at: null,
        converted_at: null,
      })
    }
  }

  if (recommendations.length === 0) {
    return { count: 0 }
  }

  // Clear existing active recs (preserve dismissed/converted)
  await supabaseAdmin
    .from('acceleration_recommendations')
    .delete()
    .eq('client_project_id', clientProjectId)
    .is('dismissed_at', null)
    .is('converted_at', null)

  // Insert new recommendations
  const { error } = await supabaseAdmin
    .from('acceleration_recommendations')
    .insert(recommendations)

  if (error) {
    console.error('Error inserting acceleration recommendations:', error)
    return { count: 0, error: error.message }
  }

  return { count: recommendations.length }
}

// ============================================================================
// Impact Calculation
// ============================================================================

interface ImpactResult {
  impactPct: number | null
  annualValue: number | null
  headline: string
  explanation: string
  dataSource: 'industry_benchmark' | 'client_specific' | 'blended'
  confidence: ConfidenceLevel
  benchmarkIds: string[]
  valueCalculationId: string | null
}

/**
 * Compute projected impact using the data source waterfall:
 * 1. Client-specific value_calculation (highest priority)
 * 2. Industry benchmark (fallback)
 * 3. Blended (when both exist): 70% client + 30% benchmark
 * 4. Cross-industry default (last resort)
 */
function computeProjectedImpact(
  match: ContentMatch,
  context: ClientContext,
  benchmarks: IndustryBenchmark[],
  clientCalcs: ValueCalculation[]
): ImpactResult {
  const painPointName = match.painPointCategory.name
  const impactPct = match.impactPercentage

  // Find client-specific value calculation for this pain point
  const clientCalc = clientCalcs.find(
    (c) => c.pain_point_category_id === match.painPointCategory.id && c.is_active
  )

  // Find relevant benchmarks
  const dealBenchmark = findBestBenchmark(benchmarks, context.industry, context.companySize, 'avg_deal_size')
  const wageBenchmark = findBestBenchmark(benchmarks, context.industry, context.companySize, 'avg_hourly_wage')
  const benchmarkIds: string[] = []
  if (dealBenchmark) benchmarkIds.push(dealBenchmark.id)
  if (wageBenchmark) benchmarkIds.push(wageBenchmark.id)

  // Compute benchmark-based annual value estimate
  let benchmarkAnnualValue: number | null = null
  if (dealBenchmark) {
    // Rough estimate: deal value * impact percentage * 12 months
    benchmarkAnnualValue = dealBenchmark.value * (impactPct / 100) * 12
  } else if (wageBenchmark) {
    // Hours saved estimate: 10 hrs/week * hourly rate * 52 weeks * impact%
    benchmarkAnnualValue = 10 * wageBenchmark.value * 52 * (impactPct / 100)
  }

  let annualValue: number | null = null
  let dataSource: 'industry_benchmark' | 'client_specific' | 'blended'
  let confidence: ConfidenceLevel
  let valueCalculationId: string | null = null

  if (clientCalc && benchmarkAnnualValue !== null) {
    // Blended: 70% client-specific + 30% benchmark
    const clientAdjusted = clientCalc.annual_value * (impactPct / 100)
    annualValue = Math.round(clientAdjusted * 0.7 + benchmarkAnnualValue * 0.3)
    dataSource = 'blended'
    confidence = clientCalc.evidence_count >= 5 ? 'high' : 'medium'
    valueCalculationId = clientCalc.id
  } else if (clientCalc) {
    // Client-specific only
    annualValue = Math.round(clientCalc.annual_value * (impactPct / 100))
    dataSource = 'client_specific'
    confidence = clientCalc.evidence_count >= 5 ? 'high' : 'medium'
    valueCalculationId = clientCalc.id
  } else if (benchmarkAnnualValue !== null) {
    // Industry benchmark only
    annualValue = Math.round(benchmarkAnnualValue)
    dataSource = 'industry_benchmark'
    confidence = context.industry !== '_default' ? 'medium' : 'low'
  } else {
    // No data available
    annualValue = null
    dataSource = 'industry_benchmark'
    confidence = 'low'
  }

  // Generate headline and explanation
  const headline = formatImpactHeadline(
    match.title,
    impactPct,
    annualValue,
    dataSource,
    painPointName
  )
  const explanation = formatImpactExplanation(
    match.title,
    impactPct,
    annualValue,
    dataSource,
    context.industry,
    context.companySize,
    painPointName
  )

  return {
    impactPct,
    annualValue,
    headline,
    explanation,
    dataSource,
    confidence,
    benchmarkIds,
    valueCalculationId,
  }
}

// ============================================================================
// Content Matching
// ============================================================================

/**
 * Find services/products that address a specific gap category.
 * Uses pain_point_categories.related_services and content_pain_point_map.
 */
function findContentMatches(
  gap: GapAnalysis,
  painPoints: PainPointCategory[],
  contentMaps: ContentPainPointMap[]
): ContentMatch[] {
  const matches: ContentMatch[] = []

  // Map assessment categories to pain point categories (heuristic)
  const categoryToPainPoints: Record<string, string[]> = {
    business_challenges: ['scaling_bottlenecks', 'customer_churn'],
    tech_stack: ['scattered_tools', 'manual_data_entry'],
    automation_needs: ['manual_data_entry', 'manual_reporting', 'employee_onboarding'],
    ai_readiness: ['slow_response_times', 'poor_lead_qualification'],
    budget_timeline: ['knowledge_loss', 'scaling_bottlenecks'],
    decision_making: ['inconsistent_followup', 'poor_lead_qualification'],
  }

  const relevantPainPointNames = categoryToPainPoints[gap.category] || []

  for (const ppName of relevantPainPointNames) {
    const pp = painPoints.find((p) => p.name === ppName)
    if (!pp) continue

    // Find content mapped to this pain point
    const maps = contentMaps.filter((m) => m.pain_point_category_id === pp.id)

    for (const map of maps) {
      matches.push({
        contentType: map.content_type,
        contentId: parseInt(map.content_id, 10),
        title: map.cached_title || pp.display_name,
        impactPercentage: map.impact_percentage,
        painPointCategory: pp,
      })
    }

    // If no explicit content mapped, use related_services as fallback
    if (maps.length === 0 && pp.related_services.length > 0) {
      for (const serviceType of pp.related_services.slice(0, 1)) {
        matches.push({
          contentType: 'service',
          contentId: 0, // Will be resolved at display time
          title: `${pp.display_name} ${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}`,
          impactPercentage: 50, // Default impact for generic match
          painPointCategory: pp,
        })
      }
    }
  }

  // Sort by impact percentage descending
  return matches.sort((a, b) => b.impactPercentage - a.impactPercentage)
}

// ============================================================================
// Headline & Explanation Formatters
// ============================================================================

function formatImpactHeadline(
  serviceTitle: string,
  impactPct: number,
  annualValue: number | null,
  dataSource: string,
  painPointName: string
): string {
  const displayPainPoint = painPointName.replace(/_/g, ' ')

  if (annualValue !== null && annualValue > 0) {
    const formattedValue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(annualValue)

    return `${serviceTitle} could save ${formattedValue}/year by addressing ${displayPainPoint}`
  }

  return `${serviceTitle} could improve ${displayPainPoint} by ${impactPct}%`
}

function formatImpactExplanation(
  serviceTitle: string,
  impactPct: number,
  annualValue: number | null,
  dataSource: string,
  industry: string,
  companySize: string,
  painPointName: string
): string {
  const sourceLabel =
    dataSource === 'client_specific'
      ? 'Based on your assessment data'
      : dataSource === 'blended'
        ? 'Based on your assessment data combined with industry benchmarks'
        : industry !== '_default'
          ? `Based on ${industry.replace(/_/g, ' ')} benchmarks for ${companySize} employee companies`
          : 'Based on cross-industry benchmarks'

  const valuePhrase =
    annualValue !== null && annualValue > 0
      ? ` with an estimated annual impact of ${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(annualValue)}`
      : ''

  return `${serviceTitle} addresses ${painPointName.replace(/_/g, ' ')} with an estimated ${impactPct}% improvement${valuePhrase}. ${sourceLabel}.`
}

// ============================================================================
// Recommendation Fetchers
// ============================================================================

/**
 * Get active, non-dismissed recommendations for a dashboard
 */
export async function getRecommendationsForDashboard(
  clientProjectId: string
): Promise<AccelerationRecommendation[]> {
  const { data } = await supabaseAdmin
    .from('acceleration_recommendations')
    .select('*')
    .eq('client_project_id', clientProjectId)
    .eq('is_active', true)
    .is('dismissed_at', null)
    .order('projected_annual_value', { ascending: false, nullsFirst: false })

  return (data || []) as AccelerationRecommendation[]
}

/**
 * Dismiss a recommendation (client doesn't want to see it)
 */
export async function dismissRecommendation(
  recId: string,
  clientProjectId: string
): Promise<{ success: boolean }> {
  const { error } = await supabaseAdmin
    .from('acceleration_recommendations')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', recId)
    .eq('client_project_id', clientProjectId)

  return { success: !error }
}

/**
 * Record a recommendation conversion (client clicked CTA)
 */
export async function convertRecommendation(
  recId: string,
  clientProjectId: string
): Promise<{ success: boolean; ctaUrl: string | null }> {
  const { data, error } = await supabaseAdmin
    .from('acceleration_recommendations')
    .update({ converted_at: new Date().toISOString() })
    .eq('id', recId)
    .eq('client_project_id', clientProjectId)
    .select('cta_url')
    .single()

  return { success: !error, ctaUrl: data?.cta_url || null }
}

/**
 * Refresh recommendations after score changes.
 * Preserves dismissed/converted recs.
 */
export async function refreshRecommendations(
  clientProjectId: string,
  currentScores: CategoryScores
): Promise<{ count: number; error?: string }> {
  return generateAccelerationRecs(clientProjectId, currentScores)
}

// ============================================================================
// Data Loaders
// ============================================================================

interface ContentPainPointMap {
  pain_point_category_id: string
  content_type: string
  content_id: string
  impact_percentage: number
  cached_title?: string
}

async function loadClientContext(
  projectId: string
): Promise<ClientContext | null> {
  const { data: project } = await supabaseAdmin
    .from('client_projects')
    .select(`
      id, contact_submission_id,
      contact_submissions:contact_submission_id (
        industry, employee_count
      )
    `)
    .eq('id', projectId)
    .single()

  if (!project) return null

  const contact = project.contact_submissions as unknown as {
    industry?: string
    employee_count?: string
  } | null

  return {
    projectId: project.id,
    industry: contact?.industry || '_default',
    companySize: normalizeCompanySize(contact?.employee_count),
    contactSubmissionId: project.contact_submission_id,
  }
}

async function loadPainPointCategories(): Promise<PainPointCategory[]> {
  const { data } = await supabaseAdmin
    .from('pain_point_categories')
    .select('*')
    .eq('is_active', true)

  return (data || []) as PainPointCategory[]
}

async function loadBenchmarks(
  industry: string,
  companySize: string
): Promise<IndustryBenchmark[]> {
  const { data } = await supabaseAdmin
    .from('industry_benchmarks')
    .select('*')
    .in('industry', [industry, '_default'])

  return (data || []) as IndustryBenchmark[]
}

async function loadContentPainPointMaps(): Promise<ContentPainPointMap[]> {
  const { data } = await supabaseAdmin
    .from('content_pain_point_map')
    .select('pain_point_category_id, content_type, content_id, impact_percentage')

  // Try to resolve titles
  const maps = (data || []) as ContentPainPointMap[]

  // Batch-resolve service titles
  const serviceIds = maps
    .filter((m) => m.content_type === 'service')
    .map((m) => parseInt(m.content_id, 10))
    .filter((id) => !isNaN(id))

  if (serviceIds.length > 0) {
    const { data: services } = await supabaseAdmin
      .from('services')
      .select('id, title')
      .in('id', serviceIds)

    if (services) {
      const titleMap = new Map(services.map((s: { id: number; title: string }) => [s.id, s.title]))
      for (const m of maps) {
        if (m.content_type === 'service') {
          const resolved = titleMap.get(parseInt(m.content_id, 10))
          m.cached_title = typeof resolved === 'string' ? resolved : undefined
        }
      }
    }
  }

  // Batch-resolve product titles
  const productIds = maps
    .filter((m) => m.content_type === 'product')
    .map((m) => parseInt(m.content_id, 10))
    .filter((id) => !isNaN(id))

  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, title')
      .in('id', productIds)

    if (products) {
      const titleMap = new Map(products.map((p: { id: number; title: string }) => [p.id, p.title]))
      for (const m of maps) {
        if (m.content_type === 'product') {
          const resolved = titleMap.get(parseInt(m.content_id, 10))
          m.cached_title = typeof resolved === 'string' ? resolved : undefined
        }
      }
    }
  }

  return maps
}

async function loadClientValueCalculations(
  industry: string,
  companySize: string
): Promise<ValueCalculation[]> {
  const normalizedSize = normalizeCompanySize(companySize)

  const { data } = await supabaseAdmin
    .from('value_calculations')
    .select('*')
    .eq('industry', industry)
    .eq('company_size_range', normalizedSize)
    .eq('is_active', true)

  return (data || []) as ValueCalculation[]
}
