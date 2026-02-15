/**
 * Dynamic Pricing Engine
 *
 * Computes retail values for bundle items based on industry benchmarks
 * and segment context, replacing hardcoded perceivedValue numbers with
 * formula-derived, non-round values.
 *
 * Flow:
 *   1. Resolve segment → benchmark context (industry + company size)
 *   2. Look up hourly wage from benchmarks (with fallback chain)
 *   3. For each item: retailValue = baseHours × hourlyWage × categoryMultiplier
 *   4. For cumulative items: value = referenced tier's total
 *   5. Return items with dynamic values + calculation metadata
 */

import {
  ITEM_VALUE_METHODS,
  CATEGORY_RATE_MULTIPLIERS,
  SEGMENT_FALLBACK_RATES,
  segmentToBenchmarkContext,
  type ItemCategory,
} from './bundle-item-value-methods';
import {
  findBestBenchmark,
  normalizeCompanySize,
  type IndustryBenchmark,
} from './value-calculations';
import type { TierItem, PricingTier } from './pricing-model';

// ============================================================================
// Types
// ============================================================================

export interface DynamicItemValue {
  title: string;
  dynamicValue: number;
  staticValue: number;
  category: ItemCategory;
  baseHours: number;
  hourlyRate: number;
  multiplier: number;
  /** True if this item's value is the sum of a referenced tier */
  isCumulative: boolean;
  /** The tier this cumulative item references */
  cumulativeRef?: string;
}

export interface DynamicTierValues {
  tierId: string;
  totalRetailValue: number;
  items: DynamicItemValue[];
}

export interface CalculationContext {
  segment: string;
  industry: string;
  companySize: string;
  hourlyWageUsed: number;
  benchmarkSource: 'database' | 'segment_fallback' | 'absolute_fallback';
  isDefault: boolean;
}

export interface DynamicPricingResult {
  tiers: DynamicTierValues[];
  context: CalculationContext;
}

// ============================================================================
// Core Computation
// ============================================================================

/**
 * Resolve the effective hourly wage for a given context.
 * Uses the benchmark fallback chain, then segment fallbacks, then absolute fallback.
 */
export function resolveHourlyWage(
  benchmarks: IndustryBenchmark[],
  industry: string,
  companySize: string,
  segment?: string
): { wage: number; source: 'database' | 'segment_fallback' | 'absolute_fallback' } {
  const normalizedSize = normalizeCompanySize(companySize);

  // Try DB benchmarks first (4-tier fallback chain in findBestBenchmark)
  const benchmark = findBestBenchmark(benchmarks, industry, normalizedSize, 'avg_hourly_wage');
  if (benchmark) {
    return { wage: benchmark.value, source: 'database' };
  }

  // Segment-specific fallback
  const segmentRates = segment ? SEGMENT_FALLBACK_RATES[segment] : null;
  if (segmentRates) {
    return { wage: segmentRates.avg_hourly_wage, source: 'segment_fallback' };
  }

  // Absolute fallback
  const defaultRates = SEGMENT_FALLBACK_RATES._default;
  return { wage: defaultRates.avg_hourly_wage, source: 'absolute_fallback' };
}

/**
 * Compute the dynamic retail value for a single non-cumulative item.
 */
function computeItemValue(
  baseHours: number,
  category: ItemCategory,
  hourlyWage: number
): number {
  const multiplier = CATEGORY_RATE_MULTIPLIERS[category];
  return Math.round(baseHours * hourlyWage * multiplier);
}

/**
 * Compute dynamic retail values for a set of pricing tiers.
 *
 * Tiers must be ordered so that referenced tiers (via cumulative items)
 * appear before the tiers that reference them:
 *   quick-win → accelerator → growth-engine → digital-transformation
 *   ci-starter → ci-accelerator → ci-growth
 *
 * @param tiers - The pricing tiers with their static items
 * @param benchmarks - Industry benchmarks from the database
 * @param segment - The pricing page segment (smb, midmarket, nonprofit)
 * @param industry - Optional industry override (from ROI Calculator)
 * @param companySize - Optional company size override (from ROI Calculator)
 */
export function computeDynamicPricing(
  tiers: PricingTier[],
  benchmarks: IndustryBenchmark[],
  segment: 'smb' | 'midmarket' | 'nonprofit',
  industry?: string,
  companySize?: string
): DynamicPricingResult {
  const ctx = segmentToBenchmarkContext(segment, industry, companySize);
  const { wage, source } = resolveHourlyWage(benchmarks, ctx.industry, ctx.companySize, segment);

  // Store computed tier totals for cumulative item lookups
  const tierTotals = new Map<string, number>();
  const tierResults: DynamicTierValues[] = [];

  for (const tier of tiers) {
    const dynamicItems: DynamicItemValue[] = [];

    for (const item of tier.items) {
      const method = ITEM_VALUE_METHODS[item.title];

      if (!method) {
        // No mapping — keep static value
        dynamicItems.push({
          title: item.title,
          dynamicValue: item.perceivedValue,
          staticValue: item.perceivedValue,
          category: 'consulting',
          baseHours: 0,
          hourlyRate: wage,
          multiplier: 1,
          isCumulative: false,
        });
        continue;
      }

      if (method.cumulativeRef) {
        // Cumulative item — value = referenced tier's total
        const refTotal = tierTotals.get(method.cumulativeRef) ?? item.perceivedValue;
        dynamicItems.push({
          title: item.title,
          dynamicValue: refTotal,
          staticValue: item.perceivedValue,
          category: method.category,
          baseHours: 0,
          hourlyRate: wage,
          multiplier: 1,
          isCumulative: true,
          cumulativeRef: method.cumulativeRef,
        });
        continue;
      }

      // Standard item — compute from baseHours × rate × multiplier
      const dynamicValue = computeItemValue(method.baseHours, method.category, wage);
      const multiplier = CATEGORY_RATE_MULTIPLIERS[method.category];

      dynamicItems.push({
        title: item.title,
        dynamicValue,
        staticValue: item.perceivedValue,
        category: method.category,
        baseHours: method.baseHours,
        hourlyRate: wage,
        multiplier,
        isCumulative: false,
      });
    }

    const totalRetailValue = dynamicItems.reduce((sum, i) => sum + i.dynamicValue, 0);
    tierTotals.set(tier.id, totalRetailValue);

    tierResults.push({
      tierId: tier.id,
      totalRetailValue,
      items: dynamicItems,
    });
  }

  return {
    tiers: tierResults,
    context: {
      segment,
      industry: ctx.industry,
      companySize: ctx.companySize,
      hourlyWageUsed: wage,
      benchmarkSource: source,
      isDefault: !industry && !companySize,
    },
  };
}

/**
 * Apply dynamic values to a set of PricingTier objects in-place.
 * Returns the tiers with updated perceivedValue, totalRetailValue, and savingsPercent.
 * Also returns the calculation context.
 */
export function applyDynamicPricing(
  tiers: PricingTier[],
  benchmarks: IndustryBenchmark[],
  segment: 'smb' | 'midmarket' | 'nonprofit',
  industry?: string,
  companySize?: string
): { tiers: PricingTier[]; context: CalculationContext } {
  const result = computeDynamicPricing(tiers, benchmarks, segment, industry, companySize);

  const updatedTiers = tiers.map((tier, idx) => {
    const dynamic = result.tiers[idx];
    if (!dynamic || dynamic.tierId !== tier.id) {
      // Safety check — tier ordering must match
      return tier;
    }

    const updatedItems = tier.items.map((item, itemIdx) => {
      const dynamicItem = dynamic.items[itemIdx];
      if (!dynamicItem) return item;
      return {
        ...item,
        perceivedValue: dynamicItem.dynamicValue,
      };
    });

    const totalRetailValue = dynamic.totalRetailValue;
    const savingsPercent = totalRetailValue > 0
      ? Math.round(((totalRetailValue - tier.price) / totalRetailValue) * 100)
      : 0;

    return {
      ...tier,
      items: updatedItems,
      totalRetailValue,
      savingsPercent,
    };
  });

  return {
    tiers: updatedTiers,
    context: result.context,
  };
}
