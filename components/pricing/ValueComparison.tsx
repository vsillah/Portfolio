'use client';

import type { PricingTier } from '@/lib/pricing-model';
import { formatCurrency, formatPercent } from '@/lib/pricing-model';
import { PricingMethodologyNote, type CalculationContextDisplay } from '@/components/pricing/PricingMethodologyNote';

interface ValueComparisonProps {
  tiers: PricingTier[];
  recommendedTierId: string;
  onSelect?: (tierId: string) => void;
  className?: string;
  calculationContext?: CalculationContextDisplay | null;
}

export function ValueComparison({ tiers, recommendedTierId, onSelect, className = '', calculationContext }: ValueComparisonProps) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 ${className}`}>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
        All Available Packages
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Based on your situation, we recommend the highlighted package.
      </p>

      <div className="mt-6 space-y-3">
        <PricingMethodologyNote variant="retail" compact calculationContext={calculationContext} className="mb-2" />
        {tiers.map((tier) => {
          const isRecommended = tier.id === recommendedTierId;
          return (
            <div
              key={tier.id}
              className={`flex items-center justify-between rounded-lg border-2 p-4 transition-all ${
                isRecommended
                  ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-950/30'
                  : 'border-gray-100 hover:border-gray-200 dark:border-gray-800 dark:hover:border-gray-700'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold ${isRecommended ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                    {tier.name}
                  </p>
                  {isRecommended && (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{tier.tagline}</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {tier.items.filter(i => i.isDeployed).length} deployed AI tools included
                </p>
              </div>

              <div className="ml-4 text-right">
                <div className="flex items-baseline gap-1">
                  {tier.isCustomPricing && <span className="text-xs text-gray-500">from</span>}
                  <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(tier.price)}</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Save {formatPercent(tier.savingsPercent)} ({formatCurrency(tier.totalRetailValue)} value)
                </p>
                {onSelect && (
                  <button
                    onClick={() => onSelect(tier.id)}
                    className={`mt-2 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      isRecommended
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {isRecommended ? 'Select This Package' : 'Select'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
