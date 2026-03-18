'use client';

import { useState } from 'react';
import { DollarSign, ChevronUp, ChevronDown } from 'lucide-react';

export interface ValueEvidenceCallPanelProps {
  /** Pain points with monetary indicators from contact-specific evidence */
  painPoints: { display_name: string | null; monetary_indicator: number; monetary_context: string | null }[];
  /** Total annual value from value report for this contact (if any) */
  totalAnnualValue: number | null;
  /** Whether the evidence API is still loading */
  loading?: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

/**
 * Displays call/contact-specific value evidence (pain_point_evidence + value_reports)
 * in the sales dashboard sidebar. Use alongside ValueEvidencePanel (industry-level)
 * so users can compare industry benchmarks vs this contact's stored evidence.
 */
export function ValueEvidenceCallPanel({
  painPoints,
  totalAnnualValue,
  loading = false,
}: ValueEvidenceCallPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasData = painPoints.length > 0 || totalAnnualValue != null;
  const totalFromPainPoints = painPoints.reduce((sum, pp) => sum + pp.monetary_indicator, 0);

  return (
    <div
      className="bg-gray-900 rounded-lg border border-teal-800/50 overflow-hidden"
      role="region"
      aria-labelledby="value-evidence-call-heading"
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-teal-500" aria-hidden />
          <h3 id="value-evidence-call-heading" className="font-medium text-white text-sm">
            Value evidence for this call
          </h3>
          {hasData && (totalAnnualValue != null ? totalAnnualValue : totalFromPainPoints) > 0 && (
            <span className="px-2 py-0.5 text-xs bg-teal-900/50 text-teal-300 rounded-full">
              {formatCurrency(totalAnnualValue ?? totalFromPainPoints)}/yr
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" aria-hidden />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-sm text-gray-500">
              Loading…
            </div>
          ) : hasData ? (
            <>
              <p className="text-xs text-gray-500">
                Stored evidence and reports for this contact.
              </p>
              {painPoints.length > 0 && (
                <ul className="text-sm text-gray-300 space-y-1.5">
                  {painPoints.map((pp, i) => (
                    <li key={i}>
                      <span className="font-medium text-gray-200">{pp.display_name || 'Pain point'}</span>
                      {' '}
                      <span className="text-teal-400">{formatCurrency(pp.monetary_indicator)}/yr</span>
                      {pp.monetary_context && (
                        <span className="text-gray-500 block text-xs mt-0.5">— {pp.monetary_context}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {totalAnnualValue != null && (
                <div className="p-2 bg-teal-900/20 border border-teal-800/50 rounded-lg text-center">
                  <div className="text-xs text-gray-400">Total value (report)</div>
                  <div className="text-lg font-bold text-teal-400">{formatCurrency(totalAnnualValue)}/yr</div>
                </div>
              )}
            </>
          ) : (
            <div className="py-3 text-center">
              <p className="text-xs text-gray-500">No value evidence for this contact yet.</p>
              <p className="text-[10px] text-gray-600 mt-1">
                Evidence appears here after pain points or reports are saved for this contact.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
