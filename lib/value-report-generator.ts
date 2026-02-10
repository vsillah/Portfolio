/**
 * Value Report Generator
 * 
 * Generates internal audit reports and client-facing value assessments
 * with full evidence chain traceability.
 * 
 * Two report types:
 * - internal_audit: Full evidence chain with links to every source, formula, and benchmark
 * - client_facing: Professional narrative with headline stats, aggregated evidence, and CTAs
 */

import { supabaseAdmin } from './supabase';
import {
  type CalculationMethod,
  type ConfidenceLevel,
  type IndustryBenchmark,
  type PainPointCategory,
  type SuggestedPricing,
  type PainPointValueSuggestion,
  type BenchmarkReference,
  autoGenerateCalculation,
  normalizeCompanySize,
  calculateROI,
  generateValueStatement,
  CALCULATION_METHOD_LABELS,
  CONFIDENCE_LABELS,
} from './value-calculations';

// ============================================================================
// Types
// ============================================================================

export interface ValueReportInput {
  contactSubmissionId?: number;
  industry?: string;
  companySize?: string;
  companyName?: string;
  contactName?: string;
}

export interface ValueReport {
  id?: string;
  contactSubmissionId: number | null;
  reportType: 'internal_audit' | 'client_facing';
  industry: string;
  companySizeRange: string;
  title: string;
  summaryMarkdown: string;
  valueStatements: ValueStatement[];
  totalAnnualValue: number;
  calculationIds: string[];
  evidenceChain: EvidenceChain;
  generatedBy: 'ai' | 'manual';
}

export interface ValueStatement {
  painPoint: string;
  painPointId: string;
  annualValue: number;
  calculationMethod: CalculationMethod;
  formulaReadable: string;
  evidenceSummary: string;
  confidence: ConfidenceLevel;
}

export interface EvidenceChain {
  rawSources: RawSourceRef[];
  classifications: ClassificationRef[];
  calculations: CalculationRef[];
}

export interface RawSourceRef {
  type: string;        // market_intelligence, diagnostic_audit, etc.
  id: string;
  platform?: string;
  url?: string;
  excerpt: string;
}

export interface ClassificationRef {
  evidenceId: string;
  category: string;
  confidence: number;
}

export interface CalculationRef {
  id: string;
  method: CalculationMethod;
  formula: string;
  annualValue: number;
  benchmarksUsed: string[];
}

// ============================================================================
// Core Report Generation
// ============================================================================

/**
 * Generate a value report for a given context
 * If contactSubmissionId is provided, uses the lead's industry/size
 * Otherwise uses the provided industry/companySize
 */
export async function generateValueReport(
  input: ValueReportInput,
  reportType: 'internal_audit' | 'client_facing' = 'client_facing'
): Promise<ValueReport | null> {
  if (!supabaseAdmin) {
    console.error('supabaseAdmin not available - server-side only');
    return null;
  }

  // Step 1: Resolve lead context
  let industry = input.industry || '';
  let companySize = input.companySize || '11-50';
  let companyName = input.companyName || '';
  let contactName = input.contactName || '';
  let contactSubmissionId: number | null = input.contactSubmissionId || null;

  if (contactSubmissionId) {
    const { data: lead } = await supabaseAdmin
      .from('contact_submissions')
      .select('industry, employee_count, company, name')
      .eq('id', contactSubmissionId)
      .single();

    if (lead) {
      industry = industry || lead.industry || '';
      companySize = companySize || lead.employee_count || '11-50';
      companyName = companyName || lead.company || '';
      contactName = contactName || lead.name || '';
    }
  }

  const normalizedSize = normalizeCompanySize(companySize);

  // Step 2: Fetch benchmarks for this industry/size
  const { data: benchmarks } = await supabaseAdmin
    .from('industry_benchmarks')
    .select('*')
    .or(`industry.eq.${industry},industry.eq._default`);

  if (!benchmarks || benchmarks.length === 0) {
    console.warn('No benchmarks found for industry:', industry);
    return null;
  }

  // Step 3: Fetch pain points and evidence
  // Get pain points that have content mapped to them, or have evidence for this industry
  const { data: painPoints } = await supabaseAdmin
    .from('pain_point_categories')
    .select('*')
    .eq('is_active', true);

  if (!painPoints || painPoints.length === 0) return null;

  // Get evidence for this industry (or no industry filter if we don't know)
  const evidenceQuery = supabaseAdmin
    .from('pain_point_evidence')
    .select('*')
    .order('confidence_score', { ascending: false });

  if (industry) {
    evidenceQuery.or(`industry.eq.${industry},industry.is.null`);
  }

  if (contactSubmissionId) {
    // Also include evidence linked to this specific lead
    evidenceQuery.or(`contact_submission_id.eq.${contactSubmissionId}`);
  }

  const { data: allEvidence } = await evidenceQuery.limit(200);
  const evidence = allEvidence || [];

  // Step 4: Get existing calculations for this industry/size
  const { data: existingCalcs } = await supabaseAdmin
    .from('value_calculations')
    .select('*')
    .eq('industry', industry || '_default')
    .eq('company_size_range', normalizedSize)
    .eq('is_active', true);

  // Step 5: Build value statements
  const valueStatements: ValueStatement[] = [];
  const calculationIds: string[] = [];
  const evidenceChain: EvidenceChain = {
    rawSources: [],
    classifications: [],
    calculations: [],
  };

  for (const pp of painPoints) {
    // Check if there's an existing calculation
    const existingCalc = (existingCalcs || []).find(
      (c: any) => c.pain_point_category_id === pp.id
    );

    // Count evidence for this pain point
    const ppEvidence = evidence.filter((e: any) => e.pain_point_category_id === pp.id);
    const hasDirectMoney = ppEvidence.some((e: any) => e.monetary_indicator != null);

    let annualValue: number;
    let method: CalculationMethod;
    let formulaReadable: string;
    let confidence: ConfidenceLevel;
    let calcBenchmarks: BenchmarkReference[] = [];

    if (existingCalc) {
      // Use existing calculation
      annualValue = existingCalc.annual_value;
      method = existingCalc.calculation_method as CalculationMethod;
      formulaReadable = existingCalc.formula_expression;
      confidence = existingCalc.confidence_level as ConfidenceLevel;
      calculationIds.push(existingCalc.id);

      evidenceChain.calculations.push({
        id: existingCalc.id,
        method,
        formula: formulaReadable,
        annualValue,
        benchmarksUsed: existingCalc.benchmark_ids || [],
      });
    } else {
      // Auto-generate calculation
      const result = autoGenerateCalculation(
        pp.name,
        benchmarks as IndustryBenchmark[],
        industry || '_default',
        normalizedSize,
        ppEvidence.length,
        hasDirectMoney
      );

      if (!result || result.annualValue <= 0) continue;

      annualValue = result.annualValue;
      method = result.method;
      formulaReadable = result.formulaReadable;
      confidence = result.confidenceLevel;
      calcBenchmarks = result.benchmarksUsed;

      evidenceChain.calculations.push({
        id: 'auto-generated',
        method,
        formula: formulaReadable,
        annualValue,
        benchmarksUsed: calcBenchmarks.map(b => b.id),
      });
    }

    // Build evidence summary
    const sourceTypes = [...new Set(ppEvidence.map((e: any) => e.source_type))];
    const evidenceSummary = ppEvidence.length > 0
      ? `Based on ${ppEvidence.length} data point${ppEvidence.length > 1 ? 's' : ''} from ${sourceTypes.join(', ')}`
      : 'Based on industry benchmarks';

    valueStatements.push({
      painPoint: pp.display_name,
      painPointId: pp.id,
      annualValue,
      calculationMethod: method,
      formulaReadable,
      evidenceSummary,
      confidence,
    });

    // Add evidence to chain
    for (const ev of ppEvidence.slice(0, 5)) {
      evidenceChain.rawSources.push({
        type: ev.source_type,
        id: ev.source_id,
        excerpt: ev.source_excerpt?.substring(0, 200) || '',
      });
      evidenceChain.classifications.push({
        evidenceId: ev.id,
        category: pp.name,
        confidence: ev.confidence_score,
      });
    }
  }

  // Sort by annual value descending
  valueStatements.sort((a, b) => b.annualValue - a.annualValue);

  const totalAnnualValue = valueStatements.reduce((sum, vs) => sum + vs.annualValue, 0);

  // Step 6: Generate report markdown
  const summaryMarkdown = reportType === 'client_facing'
    ? generateClientFacingMarkdown(valueStatements, totalAnnualValue, companyName, industry, normalizedSize)
    : generateInternalAuditMarkdown(valueStatements, totalAnnualValue, evidenceChain, industry, normalizedSize);

  const title = reportType === 'client_facing'
    ? `Value Assessment${companyName ? ` for ${companyName}` : ''}`
    : `Internal Value Audit${industry ? ` - ${industry}` : ''} (${normalizedSize} employees)`;

  return {
    contactSubmissionId,
    reportType,
    industry: industry || '_default',
    companySizeRange: normalizedSize,
    title,
    summaryMarkdown,
    valueStatements,
    totalAnnualValue,
    calculationIds,
    evidenceChain,
    generatedBy: 'ai',
  };
}

// ============================================================================
// Suggested Pricing (for ProductClassifier / BundleEditor)
// ============================================================================

/**
 * Get suggested anchor pricing for a product/service based on the pain points it addresses
 */
export async function getSuggestedPricing(params: {
  contentType: string;
  contentId: string;
  industry?: string;
  companySize?: string;
  contactSubmissionId?: number;
}): Promise<SuggestedPricing | null> {
  if (!supabaseAdmin) return null;

  let industry = params.industry || '';
  let companySize = params.companySize || '11-50';

  // Resolve from lead if provided
  if (params.contactSubmissionId) {
    const { data: lead } = await supabaseAdmin
      .from('contact_submissions')
      .select('industry, employee_count')
      .eq('id', params.contactSubmissionId)
      .single();

    if (lead) {
      industry = industry || lead.industry || '';
      companySize = companySize || lead.employee_count || '11-50';
    }
  }

  const normalizedSize = normalizeCompanySize(companySize);

  // Get pain points mapped to this content
  const { data: mappings } = await supabaseAdmin
    .from('content_pain_point_map')
    .select(`
      impact_percentage,
      pain_point_categories (
        id, name, display_name, frequency_count
      )
    `)
    .eq('content_type', params.contentType)
    .eq('content_id', params.contentId);

  if (!mappings || mappings.length === 0) return null;

  // Get benchmarks
  const { data: benchmarks } = await supabaseAdmin
    .from('industry_benchmarks')
    .select('*')
    .or(`industry.eq.${industry || '_default'},industry.eq._default`);

  // Get evidence counts
  const painPointIds = mappings
    .map((m: any) => (m.pain_point_categories as any)?.id)
    .filter(Boolean);

  const { data: evidenceCounts } = await supabaseAdmin
    .from('pain_point_evidence')
    .select('pain_point_category_id')
    .in('pain_point_category_id', painPointIds);

  const evidenceCountMap: Record<string, number> = {};
  for (const e of evidenceCounts || []) {
    evidenceCountMap[e.pain_point_category_id] =
      (evidenceCountMap[e.pain_point_category_id] || 0) + 1;
  }

  // Calculate value for each pain point
  const suggestions: PainPointValueSuggestion[] = [];
  const allBenchmarksUsed: BenchmarkReference[] = [];
  let totalEvidenceCount = 0;

  for (const mapping of mappings) {
    const pp = mapping.pain_point_categories as any;
    if (!pp) continue;

    const evCount = evidenceCountMap[pp.id] || 0;
    totalEvidenceCount += evCount;

    // Try existing calculation first
    const { data: existingCalc } = await supabaseAdmin
      .from('value_calculations')
      .select('*')
      .eq('pain_point_category_id', pp.id)
      .eq('industry', industry || '_default')
      .eq('company_size_range', normalizedSize)
      .eq('is_active', true)
      .limit(1)
      .single();

    let annualValue: number;
    let method: CalculationMethod;
    let formulaReadable: string;
    let confidence: ConfidenceLevel;
    let calcId: string | null = null;

    if (existingCalc) {
      annualValue = existingCalc.annual_value;
      method = existingCalc.calculation_method as CalculationMethod;
      formulaReadable = existingCalc.formula_expression;
      confidence = existingCalc.confidence_level as ConfidenceLevel;
      calcId = existingCalc.id;
    } else {
      const result = autoGenerateCalculation(
        pp.name,
        (benchmarks || []) as IndustryBenchmark[],
        industry || '_default',
        normalizedSize,
        evCount,
        false
      );
      if (!result || result.annualValue <= 0) continue;

      annualValue = result.annualValue;
      method = result.method;
      formulaReadable = result.formulaReadable;
      confidence = result.confidenceLevel;
      allBenchmarksUsed.push(...result.benchmarksUsed);
    }

    const impactPct = mapping.impact_percentage || 100;
    const adjustedValue = Math.round(annualValue * (impactPct / 100) * 100) / 100;

    suggestions.push({
      category: pp.name,
      categoryDisplayName: pp.display_name,
      annualValue,
      calculationId: calcId,
      calculationMethod: method,
      formulaReadable,
      evidenceSummary: evCount > 0
        ? `Based on ${evCount} data points`
        : 'Based on industry benchmarks',
      confidenceLevel: confidence,
      impactPercentage: impactPct,
      adjustedValue,
    });
  }

  if (suggestions.length === 0) return null;

  const totalRetail = suggestions.reduce((sum, s) => sum + s.adjustedValue, 0);

  // Overall confidence is the lowest among suggestions
  const confidencePriority: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1 };
  const overallConfidence = suggestions.reduce<ConfidenceLevel>(
    (worst, s) =>
      confidencePriority[s.confidenceLevel] < confidencePriority[worst]
        ? s.confidenceLevel
        : worst,
    'high'
  );

  return {
    suggestedRetailPrice: Math.round(totalRetail * 100) / 100,
    suggestedPerceivedValue: Math.round(totalRetail * 100) / 100,
    painPointsAddressed: suggestions,
    totalEvidenceCount,
    overallConfidence,
    benchmarksUsed: allBenchmarksUsed,
  };
}

// ============================================================================
// Save Report to Database
// ============================================================================

/**
 * Save a generated value report to the database
 */
export async function saveValueReport(report: ValueReport): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from('value_reports')
    .insert({
      contact_submission_id: report.contactSubmissionId,
      report_type: report.reportType,
      industry: report.industry,
      company_size_range: report.companySizeRange,
      title: report.title,
      summary_markdown: report.summaryMarkdown,
      value_statements: report.valueStatements,
      total_annual_value: report.totalAnnualValue,
      calculation_ids: report.calculationIds,
      evidence_chain: report.evidenceChain,
      generated_by: report.generatedBy,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save value report:', error);
    return null;
  }

  return data?.id || null;
}

// ============================================================================
// Markdown Generators
// ============================================================================

function generateClientFacingMarkdown(
  statements: ValueStatement[],
  totalValue: number,
  companyName: string,
  industry: string,
  companySize: string
): string {
  const formattedTotal = formatCurrency(totalValue);
  const companyRef = companyName || 'your business';
  const industryRef = industry || 'your industry';

  let md = `# Value Assessment${companyName ? ` for ${companyName}` : ''}\n\n`;

  md += `## Executive Summary\n\n`;
  md += `Based on our analysis of businesses in **${industryRef}** with **${companySize} employees**, `;
  md += `we've identified **${statements.length} areas** where ${companyRef} may be losing an estimated `;
  md += `**${formattedTotal}/year** to operational inefficiencies and missed opportunities.\n\n`;

  md += `## The Cost of Doing Nothing\n\n`;

  for (const stmt of statements) {
    const value = formatCurrency(stmt.annualValue);
    md += `### ${stmt.painPoint}\n`;
    md += `**Estimated Annual Impact: ${value}**\n\n`;
    md += `*Calculation: ${stmt.formulaReadable}*\n\n`;
    md += `${stmt.evidenceSummary}. `;
    md += `Confidence: **${CONFIDENCE_LABELS[stmt.confidence]}**.\n\n`;
  }

  md += `---\n\n`;
  md += `## Total Estimated Annual Impact\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Pain Points Identified | ${statements.length} |\n`;
  md += `| Total Annual Cost | ${formattedTotal} |\n`;
  md += `| Monthly Cost | ${formatCurrency(totalValue / 12)} |\n\n`;

  md += `*Values calculated using industry benchmarks and proprietary analysis. `;
  md += `Full methodology available upon request.*\n`;

  return md;
}

function generateInternalAuditMarkdown(
  statements: ValueStatement[],
  totalValue: number,
  chain: EvidenceChain,
  industry: string,
  companySize: string
): string {
  const formattedTotal = formatCurrency(totalValue);

  let md = `# Internal Value Audit\n\n`;
  md += `**Industry:** ${industry || 'Unknown'} | **Size:** ${companySize} | `;
  md += `**Total Value:** ${formattedTotal} | **Generated:** ${new Date().toISOString()}\n\n`;

  md += `## Value Calculations (${statements.length})\n\n`;

  for (const stmt of statements) {
    const value = formatCurrency(stmt.annualValue);
    md += `### ${stmt.painPoint} — ${value}/yr [${stmt.confidence}]\n`;
    md += `- **Method:** ${CALCULATION_METHOD_LABELS[stmt.calculationMethod]}\n`;
    md += `- **Formula:** ${stmt.formulaReadable}\n`;
    md += `- **Evidence:** ${stmt.evidenceSummary}\n`;
    md += `- **Pain Point ID:** ${stmt.painPointId}\n\n`;
  }

  md += `## Evidence Chain\n\n`;

  md += `### Raw Sources (${chain.rawSources.length})\n\n`;
  for (const src of chain.rawSources) {
    md += `- [${src.type}] ${src.id}: "${src.excerpt.substring(0, 100)}..."`;
    if (src.url) md += ` ([source](${src.url}))`;
    md += `\n`;
  }

  md += `\n### Classifications (${chain.classifications.length})\n\n`;
  for (const cls of chain.classifications) {
    md += `- Evidence ${cls.evidenceId} → ${cls.category} (${(cls.confidence * 100).toFixed(0)}% confidence)\n`;
  }

  md += `\n### Calculations (${chain.calculations.length})\n\n`;
  for (const calc of chain.calculations) {
    md += `- [${calc.method}] ${calc.formula} = ${formatCurrency(calc.annualValue)}/yr\n`;
    if (calc.benchmarksUsed.length > 0) {
      md += `  - Benchmarks: ${calc.benchmarksUsed.join(', ')}\n`;
    }
  }

  return md;
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}
