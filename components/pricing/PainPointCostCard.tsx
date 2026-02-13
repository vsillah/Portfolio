'use client';

import { formatCurrency } from '@/lib/pricing-model';

interface PainPointCostCardProps {
  painPoints: Array<{
    categoryName: string;
    displayName: string;
    annualValue: number;
    formula: string;
    method: string;
    confidence: string;
  }>;
  totalAnnualWaste: number;
  className?: string;
}

const METHOD_LABELS: Record<string, string> = {
  time_saved: 'Time Saved',
  error_reduction: 'Error Reduction',
  revenue_acceleration: 'Revenue Growth',
  opportunity_cost: 'Missed Opportunities',
  replacement_cost: 'Labor Replacement',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function PainPointCostCard({ painPoints, totalAnnualWaste, className = '' }: PainPointCostCardProps) {
  if (painPoints.length === 0) return null;

  return (
    <div className={`rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-800 dark:bg-gray-900 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          What Your Pain Points Are Costing You
        </h3>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Annual Cost</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalAnnualWaste)}</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {painPoints.map((pp, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-800"
          >
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">{pp.displayName}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {METHOD_LABELS[pp.method] || pp.method}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLORS[pp.confidence] || CONFIDENCE_COLORS.medium}`}>
                  {pp.confidence} confidence
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{pp.formula}</p>
            </div>
            <div className="ml-4 text-right">
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(pp.annualValue)}</p>
              <p className="text-xs text-gray-400">/year</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
