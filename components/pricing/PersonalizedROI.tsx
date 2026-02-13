'use client';

import { formatCurrency } from '@/lib/pricing-model';

interface PersonalizedROIProps {
  roi: {
    roiPercent: number;
    roiFormatted: string;
    paybackMonths: number;
    paybackFormatted: string;
    annualSavings: number;
    netFirstYearValue: number;
    investmentRecovery: string | null;
  };
  tierPrice: number;
  tierName: string;
  className?: string;
}

export function PersonalizedROI({ roi, tierPrice, tierName, className = '' }: PersonalizedROIProps) {
  return (
    <div className={`rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-6 shadow-sm dark:border-green-800 dark:from-green-950/30 dark:to-gray-900 ${className}`}>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
        Your Projected ROI with {tierName}
      </h3>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Investment</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(tierPrice)}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Annual Value</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(roi.annualSavings)}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">First-Year ROI</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{roi.roiFormatted}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Payback Period</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{roi.paybackFormatted}</p>
        </div>
      </div>

      {roi.netFirstYearValue > 0 && (
        <div className="mt-4 rounded-lg bg-green-100 p-3 dark:bg-green-900/30">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            Net first-year value: <strong>{formatCurrency(roi.netFirstYearValue)}</strong>
          </p>
          {roi.investmentRecovery && (
            <p className="mt-1 text-xs text-green-700 dark:text-green-400">{roi.investmentRecovery}</p>
          )}
        </div>
      )}
    </div>
  );
}
