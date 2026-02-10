/**
 * Value Evidence Pipeline - Monetary Calculation Engine
 * 
 * Provides 5 calculation methods for converting pain points into dollar values,
 * plus helpers for suggested pricing, benchmark lookup, and value statement generation.
 * 
 * Integrates with the Hormozi value equation in lib/sales-scripts.ts:
 * - Hormozi equation = perceived value scoring (1-100 scale)
 * - This module = concrete dollar amounts with full traceability
 */

// ============================================================================
// Types
// ============================================================================

export type CalculationMethod =
  | 'time_saved'
  | 'error_reduction'
  | 'revenue_acceleration'
  | 'opportunity_cost'
  | 'replacement_cost';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type BenchmarkType =
  | 'avg_hourly_wage'
  | 'avg_error_cost'
  | 'avg_daily_revenue'
  | 'avg_employee_cost'
  | 'avg_tool_spend'
  | 'avg_lead_value'
  | 'avg_deal_size'
  | 'avg_close_rate';

export interface CalculationResult {
  method: CalculationMethod;
  annualValue: number;
  formulaInputs: Record<string, number>;
  formulaExpression: string;
  formulaReadable: string;  // Human-friendly: "10 hrs/week × $45/hr × 52 weeks"
  confidenceLevel: ConfidenceLevel;
  benchmarksUsed: BenchmarkReference[];
}

export interface BenchmarkReference {
  id: string;
  type: BenchmarkType;
  value: number;
  source: string;
  sourceUrl?: string;
  year: number;
}

export interface IndustryBenchmark {
  id: string;
  industry: string;
  company_size_range: string;
  benchmark_type: BenchmarkType;
  value: number;
  source: string;
  source_url: string | null;
  year: number;
  notes: string | null;
}

export interface PainPointCategory {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  industry_tags: string[];
  frequency_count: number;
  avg_monetary_impact: number | null;
  related_services: string[];
  related_products: number[];
  is_active: boolean;
}

export interface ValueCalculation {
  id: string;
  pain_point_category_id: string;
  industry: string;
  company_size_range: string;
  calculation_method: CalculationMethod;
  formula_inputs: Record<string, number>;
  formula_expression: string;
  annual_value: number;
  confidence_level: ConfidenceLevel;
  evidence_count: number;
  benchmark_ids: string[];
  evidence_ids: string[];
  generated_by: 'system' | 'manual' | 'ai';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PainPointValueSuggestion {
  category: string;
  categoryDisplayName: string;
  annualValue: number;
  calculationId: string | null;
  calculationMethod: CalculationMethod;
  formulaReadable: string;
  evidenceSummary: string;
  confidenceLevel: ConfidenceLevel;
  impactPercentage: number;  // From content_pain_point_map (1-100)
  adjustedValue: number;     // annualValue * (impactPercentage / 100)
}

export interface SuggestedPricing {
  suggestedRetailPrice: number;       // Anchor: total cost of problems
  suggestedPerceivedValue: number;     // Same as retail for evidence-backed
  painPointsAddressed: PainPointValueSuggestion[];
  totalEvidenceCount: number;
  overallConfidence: ConfidenceLevel;
  benchmarksUsed: BenchmarkReference[];
}

// ============================================================================
// Calculation Methods
// ============================================================================

/**
 * Method 1: Time Saved
 * Annual Value = hours_per_week × hourly_rate × weeks_per_year
 * 
 * Best for: Manual processes, data entry, repetitive tasks
 */
export function calculateTimeSaved(params: {
  hoursPerWeek: number;
  hourlyRate: number;
  weeksPerYear?: number;
}): CalculationResult {
  const { hoursPerWeek, hourlyRate, weeksPerYear = 52 } = params;
  const annualValue = hoursPerWeek * hourlyRate * weeksPerYear;

  return {
    method: 'time_saved',
    annualValue: Math.round(annualValue * 100) / 100,
    formulaInputs: {
      hours_per_week: hoursPerWeek,
      hourly_rate: hourlyRate,
      weeks_per_year: weeksPerYear,
    },
    formulaExpression: 'hours_per_week × hourly_rate × weeks_per_year',
    formulaReadable: `${hoursPerWeek} hrs/week × $${hourlyRate}/hr × ${weeksPerYear} weeks`,
    confidenceLevel: 'medium',
    benchmarksUsed: [],
  };
}

/**
 * Method 2: Error Reduction
 * Annual Value = error_rate × cost_per_error × annual_volume
 * 
 * Best for: Quality issues, compliance, data accuracy
 */
export function calculateErrorReduction(params: {
  errorRate: number;        // As decimal (0.05 = 5%)
  costPerError: number;
  annualVolume: number;
}): CalculationResult {
  const { errorRate, costPerError, annualVolume } = params;
  const annualValue = errorRate * costPerError * annualVolume;
  const errorPct = (errorRate * 100).toFixed(1);

  return {
    method: 'error_reduction',
    annualValue: Math.round(annualValue * 100) / 100,
    formulaInputs: {
      error_rate: errorRate,
      cost_per_error: costPerError,
      annual_volume: annualVolume,
    },
    formulaExpression: 'error_rate × cost_per_error × annual_volume',
    formulaReadable: `${errorPct}% error rate × $${costPerError}/error × ${annualVolume.toLocaleString()} transactions`,
    confidenceLevel: 'medium',
    benchmarksUsed: [],
  };
}

/**
 * Method 3: Revenue Acceleration
 * Annual Value = days_faster × daily_revenue_impact
 * 
 * Best for: Speed-to-market, faster sales cycles, quicker delivery
 */
export function calculateRevenueAcceleration(params: {
  daysFaster: number;
  dailyRevenueImpact: number;
}): CalculationResult {
  const { daysFaster, dailyRevenueImpact } = params;
  const annualValue = daysFaster * dailyRevenueImpact;

  return {
    method: 'revenue_acceleration',
    annualValue: Math.round(annualValue * 100) / 100,
    formulaInputs: {
      days_faster: daysFaster,
      daily_revenue_impact: dailyRevenueImpact,
    },
    formulaExpression: 'days_faster × daily_revenue_impact',
    formulaReadable: `${daysFaster} days faster × $${dailyRevenueImpact.toLocaleString()}/day revenue impact`,
    confidenceLevel: 'low',
    benchmarksUsed: [],
  };
}

/**
 * Method 4: Opportunity Cost
 * Annual Value = missed_opportunities × avg_deal_value × close_rate
 * 
 * Best for: Lead follow-up, sales pipeline, customer acquisition
 */
export function calculateOpportunityCost(params: {
  missedOpportunities: number;  // Per year
  avgDealValue: number;
  closeRate: number;            // As decimal (0.25 = 25%)
}): CalculationResult {
  const { missedOpportunities, avgDealValue, closeRate } = params;
  const annualValue = missedOpportunities * avgDealValue * closeRate;
  const closePct = (closeRate * 100).toFixed(0);

  return {
    method: 'opportunity_cost',
    annualValue: Math.round(annualValue * 100) / 100,
    formulaInputs: {
      missed_opportunities: missedOpportunities,
      avg_deal_value: avgDealValue,
      close_rate: closeRate,
    },
    formulaExpression: 'missed_opportunities × avg_deal_value × close_rate',
    formulaReadable: `${missedOpportunities} missed leads × $${avgDealValue.toLocaleString()} avg deal × ${closePct}% close rate`,
    confidenceLevel: 'low',
    benchmarksUsed: [],
  };
}

/**
 * Method 5: Replacement Cost
 * Annual Value = fte_count × avg_salary × benefits_multiplier
 * 
 * Best for: Headcount reduction, automation of full roles
 */
export function calculateReplacementCost(params: {
  fteCount: number;            // Can be fractional (e.g., 0.5 for part-time)
  avgSalary: number;
  benefitsMultiplier?: number; // Default 1.3 (30% benefits overhead)
}): CalculationResult {
  const { fteCount, avgSalary, benefitsMultiplier = 1.3 } = params;
  const annualValue = fteCount * avgSalary * benefitsMultiplier;
  const multiplierPct = ((benefitsMultiplier - 1) * 100).toFixed(0);

  return {
    method: 'replacement_cost',
    annualValue: Math.round(annualValue * 100) / 100,
    formulaInputs: {
      fte_count: fteCount,
      avg_salary: avgSalary,
      benefits_multiplier: benefitsMultiplier,
    },
    formulaExpression: 'fte_count × avg_salary × benefits_multiplier',
    formulaReadable: `${fteCount} FTE × $${avgSalary.toLocaleString()} salary × ${benefitsMultiplier}x (${multiplierPct}% benefits)`,
    confidenceLevel: 'medium',
    benchmarksUsed: [],
  };
}

// ============================================================================
// Method Dispatcher
// ============================================================================

/**
 * Run a calculation by method name with dynamic inputs
 */
export function runCalculation(
  method: CalculationMethod,
  inputs: Record<string, number>
): CalculationResult {
  switch (method) {
    case 'time_saved':
      return calculateTimeSaved({
        hoursPerWeek: inputs.hours_per_week ?? 0,
        hourlyRate: inputs.hourly_rate ?? 0,
        weeksPerYear: inputs.weeks_per_year,
      });
    case 'error_reduction':
      return calculateErrorReduction({
        errorRate: inputs.error_rate ?? 0,
        costPerError: inputs.cost_per_error ?? 0,
        annualVolume: inputs.annual_volume ?? 0,
      });
    case 'revenue_acceleration':
      return calculateRevenueAcceleration({
        daysFaster: inputs.days_faster ?? 0,
        dailyRevenueImpact: inputs.daily_revenue_impact ?? 0,
      });
    case 'opportunity_cost':
      return calculateOpportunityCost({
        missedOpportunities: inputs.missed_opportunities ?? 0,
        avgDealValue: inputs.avg_deal_value ?? 0,
        closeRate: inputs.close_rate ?? 0,
      });
    case 'replacement_cost':
      return calculateReplacementCost({
        fteCount: inputs.fte_count ?? 0,
        avgSalary: inputs.avg_salary ?? 0,
        benefitsMultiplier: inputs.benefits_multiplier,
      });
    default:
      throw new Error(`Unknown calculation method: ${method}`);
  }
}

// ============================================================================
// Benchmark Helpers
// ============================================================================

/**
 * Find the best matching benchmark value
 * Falls back through: exact industry+size -> exact industry any size -> _default+size -> _default
 */
export function findBestBenchmark(
  benchmarks: IndustryBenchmark[],
  industry: string,
  companySize: string,
  benchmarkType: BenchmarkType
): IndustryBenchmark | null {
  // Priority 1: Exact match (industry + size + type)
  const exact = benchmarks.find(
    b => b.industry === industry &&
         b.company_size_range === companySize &&
         b.benchmark_type === benchmarkType
  );
  if (exact) return exact;

  // Priority 2: Same industry, any size
  const sameIndustry = benchmarks.find(
    b => b.industry === industry &&
         b.benchmark_type === benchmarkType
  );
  if (sameIndustry) return sameIndustry;

  // Priority 3: Default industry, exact size
  const defaultSize = benchmarks.find(
    b => b.industry === '_default' &&
         b.company_size_range === companySize &&
         b.benchmark_type === benchmarkType
  );
  if (defaultSize) return defaultSize;

  // Priority 4: Default industry, any size
  const defaultAny = benchmarks.find(
    b => b.industry === '_default' &&
         b.benchmark_type === benchmarkType
  );
  return defaultAny || null;
}

/**
 * Normalize company size to a standard range
 * Handles various formats: "25", "11-50", "51-200 employees", etc.
 */
export function normalizeCompanySize(input: string | null | undefined): string {
  if (!input) return '11-50'; // Default to mid-range

  const cleaned = input.replace(/[^0-9-]/g, '');

  // If it's a range already, normalize it
  if (cleaned.includes('-')) {
    const [low] = cleaned.split('-').map(Number);
    if (low <= 10) return '1-10';
    if (low <= 50) return '11-50';
    if (low <= 200) return '51-200';
    return '201-1000';
  }

  // Single number
  const num = parseInt(cleaned, 10);
  if (isNaN(num) || num <= 10) return '1-10';
  if (num <= 50) return '11-50';
  if (num <= 200) return '51-200';
  return '201-1000';
}

// ============================================================================
// Confidence Calculation
// ============================================================================

/**
 * Determine confidence level based on evidence count and benchmark quality
 */
export function determineConfidence(
  evidenceCount: number,
  hasBenchmarks: boolean,
  hasDirectMonetaryEvidence: boolean
): ConfidenceLevel {
  if (evidenceCount >= 5 && hasBenchmarks && hasDirectMonetaryEvidence) return 'high';
  if (evidenceCount >= 5 && hasBenchmarks) return 'high';
  if (evidenceCount >= 2 && hasBenchmarks) return 'medium';
  if (evidenceCount >= 2) return 'medium';
  return 'low';
}

// ============================================================================
// Pain Point -> Calculation Method Mapping
// ============================================================================

/**
 * Default calculation method per pain point category
 * Used when auto-generating calculations
 */
export const PAIN_POINT_DEFAULT_METHODS: Record<string, {
  method: CalculationMethod;
  defaultInputs: Record<string, number>;
}> = {
  manual_data_entry: {
    method: 'time_saved',
    defaultInputs: { hours_per_week: 10, weeks_per_year: 52 },
  },
  slow_response_times: {
    method: 'opportunity_cost',
    defaultInputs: { missed_opportunities: 50, close_rate: 0.25 },
  },
  inconsistent_followup: {
    method: 'opportunity_cost',
    defaultInputs: { missed_opportunities: 100, close_rate: 0.20 },
  },
  scattered_tools: {
    method: 'time_saved',
    defaultInputs: { hours_per_week: 5, weeks_per_year: 52 },
  },
  manual_reporting: {
    method: 'time_saved',
    defaultInputs: { hours_per_week: 8, weeks_per_year: 52 },
  },
  poor_lead_qualification: {
    method: 'opportunity_cost',
    defaultInputs: { missed_opportunities: 75, close_rate: 0.15 },
  },
  knowledge_loss: {
    method: 'replacement_cost',
    defaultInputs: { fte_count: 0.25, benefits_multiplier: 1.3 },
  },
  scaling_bottlenecks: {
    method: 'revenue_acceleration',
    defaultInputs: { days_faster: 30 },
  },
  employee_onboarding: {
    method: 'time_saved',
    defaultInputs: { hours_per_week: 15, weeks_per_year: 12 },
    // 15 hrs/week for 12 weeks per new hire
  },
  customer_churn: {
    method: 'opportunity_cost',
    defaultInputs: { missed_opportunities: 20, close_rate: 0.80 },
    // 20 churned customers × deal value × 80% save rate
  },
};

// ============================================================================
// Auto-Calculation Generator
// ============================================================================

/**
 * Auto-generate a calculation for a pain point using benchmarks
 * This is the main entry point for generating monetary values
 */
export function autoGenerateCalculation(
  painPointName: string,
  benchmarks: IndustryBenchmark[],
  industry: string,
  companySize: string,
  evidenceCount: number = 0,
  hasDirectMonetaryEvidence: boolean = false
): CalculationResult | null {
  const config = PAIN_POINT_DEFAULT_METHODS[painPointName];
  if (!config) return null;

  const normalizedSize = normalizeCompanySize(companySize);
  const inputs = { ...config.defaultInputs };
  const benchmarksUsed: BenchmarkReference[] = [];

  // Fill in benchmark-driven values
  switch (config.method) {
    case 'time_saved': {
      const wageBenchmark = findBestBenchmark(benchmarks, industry, normalizedSize, 'avg_hourly_wage');
      if (wageBenchmark) {
        inputs.hourly_rate = wageBenchmark.value;
        benchmarksUsed.push({
          id: wageBenchmark.id,
          type: 'avg_hourly_wage',
          value: wageBenchmark.value,
          source: wageBenchmark.source,
          sourceUrl: wageBenchmark.source_url || undefined,
          year: wageBenchmark.year,
        });
      } else {
        inputs.hourly_rate = inputs.hourly_rate ?? 40; // Absolute fallback
      }
      break;
    }
    case 'error_reduction': {
      const errorBenchmark = findBestBenchmark(benchmarks, industry, normalizedSize, 'avg_error_cost');
      if (errorBenchmark) {
        inputs.cost_per_error = errorBenchmark.value;
        benchmarksUsed.push({
          id: errorBenchmark.id,
          type: 'avg_error_cost',
          value: errorBenchmark.value,
          source: errorBenchmark.source,
          sourceUrl: errorBenchmark.source_url || undefined,
          year: errorBenchmark.year,
        });
      }
      if (!inputs.error_rate) inputs.error_rate = 0.05;
      if (!inputs.annual_volume) inputs.annual_volume = 1000;
      break;
    }
    case 'revenue_acceleration': {
      const revBenchmark = findBestBenchmark(benchmarks, industry, normalizedSize, 'avg_daily_revenue');
      if (revBenchmark) {
        inputs.daily_revenue_impact = revBenchmark.value;
        benchmarksUsed.push({
          id: revBenchmark.id,
          type: 'avg_daily_revenue',
          value: revBenchmark.value,
          source: revBenchmark.source,
          sourceUrl: revBenchmark.source_url || undefined,
          year: revBenchmark.year,
        });
      }
      break;
    }
    case 'opportunity_cost': {
      const dealBenchmark = findBestBenchmark(benchmarks, industry, normalizedSize, 'avg_deal_size');
      const rateBenchmark = findBestBenchmark(benchmarks, industry, normalizedSize, 'avg_close_rate');
      if (dealBenchmark) {
        inputs.avg_deal_value = dealBenchmark.value;
        benchmarksUsed.push({
          id: dealBenchmark.id,
          type: 'avg_deal_size',
          value: dealBenchmark.value,
          source: dealBenchmark.source,
          sourceUrl: dealBenchmark.source_url || undefined,
          year: dealBenchmark.year,
        });
      }
      if (rateBenchmark) {
        inputs.close_rate = rateBenchmark.value;
        benchmarksUsed.push({
          id: rateBenchmark.id,
          type: 'avg_close_rate',
          value: rateBenchmark.value,
          source: rateBenchmark.source,
          sourceUrl: rateBenchmark.source_url || undefined,
          year: rateBenchmark.year,
        });
      }
      break;
    }
    case 'replacement_cost': {
      const costBenchmark = findBestBenchmark(benchmarks, industry, normalizedSize, 'avg_employee_cost');
      if (costBenchmark) {
        inputs.avg_salary = costBenchmark.value;
        benchmarksUsed.push({
          id: costBenchmark.id,
          type: 'avg_employee_cost',
          value: costBenchmark.value,
          source: costBenchmark.source,
          sourceUrl: costBenchmark.source_url || undefined,
          year: costBenchmark.year,
        });
      }
      break;
    }
  }

  const result = runCalculation(config.method, inputs);
  result.benchmarksUsed = benchmarksUsed;
  result.confidenceLevel = determineConfidence(
    evidenceCount,
    benchmarksUsed.length > 0,
    hasDirectMonetaryEvidence
  );

  return result;
}

// ============================================================================
// Value Statement Generation
// ============================================================================

/**
 * Generate a human-readable value statement for a calculation
 */
export function generateValueStatement(
  painPointDisplayName: string,
  annualValue: number,
  method: CalculationMethod,
  evidenceCount: number,
  industry?: string
): string {
  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(annualValue);

  const methodDescriptions: Record<CalculationMethod, string> = {
    time_saved: 'based on estimated time savings',
    error_reduction: 'based on error cost reduction',
    revenue_acceleration: 'based on revenue acceleration',
    opportunity_cost: 'based on estimated missed opportunities',
    replacement_cost: 'based on equivalent labor costs',
  };

  const industryPhrase = industry ? ` in ${industry}` : '';
  const evidencePhrase = evidenceCount > 0
    ? ` (supported by ${evidenceCount} data point${evidenceCount > 1 ? 's' : ''})`
    : '';

  return `${painPointDisplayName} costs businesses${industryPhrase} approximately ${formattedValue}/year, ${methodDescriptions[method]}${evidencePhrase}.`;
}

// ============================================================================
// ROI Calculations
// ============================================================================

/**
 * Calculate ROI metrics for a proposal/offer
 */
export function calculateROI(totalPainPointValue: number, offerPrice: number): {
  roi: number;               // As percentage
  roiFormatted: string;      // e.g., "732%"
  paybackMonths: number;
  paybackFormatted: string;  // e.g., "1.2 months"
  annualSavings: number;
  netFirstYearValue: number;
} {
  const roi = offerPrice > 0 ? ((totalPainPointValue - offerPrice) / offerPrice) * 100 : 0;
  const paybackMonths = totalPainPointValue > 0
    ? (offerPrice / (totalPainPointValue / 12))
    : 0;

  return {
    roi: Math.round(roi),
    roiFormatted: `${Math.round(roi)}%`,
    paybackMonths: Math.round(paybackMonths * 10) / 10,
    paybackFormatted: paybackMonths < 1
      ? `${Math.round(paybackMonths * 30)} days`
      : `${(Math.round(paybackMonths * 10) / 10).toFixed(1)} months`,
    annualSavings: totalPainPointValue,
    netFirstYearValue: totalPainPointValue - offerPrice,
  };
}

// ============================================================================
// Method Display Helpers
// ============================================================================

export const CALCULATION_METHOD_LABELS: Record<CalculationMethod, string> = {
  time_saved: 'Time Saved',
  error_reduction: 'Error Reduction',
  revenue_acceleration: 'Revenue Acceleration',
  opportunity_cost: 'Opportunity Cost',
  replacement_cost: 'Replacement Cost',
};

export const CALCULATION_METHOD_DESCRIPTIONS: Record<CalculationMethod, string> = {
  time_saved: 'Calculates value from hours of manual work eliminated',
  error_reduction: 'Calculates value from reduced errors and their associated costs',
  revenue_acceleration: 'Calculates value from faster time-to-revenue',
  opportunity_cost: 'Calculates value from leads and opportunities no longer missed',
  replacement_cost: 'Calculates value equivalent to headcount that can be redirected',
};

export const CALCULATION_METHOD_ICONS: Record<CalculationMethod, string> = {
  time_saved: 'Clock',
  error_reduction: 'ShieldCheck',
  revenue_acceleration: 'TrendingUp',
  opportunity_cost: 'Target',
  replacement_cost: 'Users',
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'High Confidence',
  medium: 'Medium Confidence',
  low: 'Estimated',
};

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: 'bg-green-500/20 text-green-400 border-green-500/50',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
};
