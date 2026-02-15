'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Info, ExternalLink } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface CalculationContextDisplay {
  segment: string;
  industry: string;
  companySize: string;
  hourlyWageUsed?: number;
  benchmarkSource?: string;
  isDefault: boolean;
}

interface PricingMethodologyNoteProps {
  /**
   * Controls which copy is shown:
   *   - retail: retail value / price anchor (strikethrough price)
   *   - roi: ROI / savings calculations
   *   - painpoint: pain point cost estimates
   */
  variant: 'retail' | 'roi' | 'painpoint';
  /** Compact mode: shorter collapsed text, no expanded detail */
  compact?: boolean;
  /** The calculation context returned from the pricing API */
  calculationContext?: CalculationContextDisplay | null;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Copy per variant
// ============================================================================

const VARIANT_COPY = {
  retail: {
    collapsed: 'How we calculated this value',
    collapsedCompact: 'Based on industry benchmarks',
    expanded: [
      'Retail values are derived from estimated delivery effort (hours) multiplied by industry-standard rates for each item category (consulting, technology, content, support).',
      'Rates are sourced from BLS wage data and industry salary surveys, adjusted for specialization and geographic factors.',
    ],
    methods: ['Time-based costing', 'Category rate multipliers', 'Industry benchmark lookup'],
  },
  roi: {
    collapsed: 'How we calculated this estimate',
    collapsedCompact: 'Industry-average estimate',
    expanded: [
      'ROI estimates use conservative industry benchmarks for hourly wages, deal sizes, and employee costs. Savings assumptions range from 40-60% of identified waste depending on company size.',
      'Actual results depend on your specific situation. These are starting-point estimates, not guarantees.',
    ],
    methods: ['Time savings', 'Opportunity cost', 'Replacement cost'],
  },
  painpoint: {
    collapsed: 'How we estimated this cost',
    collapsedCompact: 'Estimated from benchmarks',
    expanded: [
      'Pain point costs are calculated using one of five methods: Time Saved, Error Reduction, Revenue Acceleration, Opportunity Cost, or Replacement Cost.',
      'Each method uses industry-specific benchmarks from BLS, Glassdoor, and published industry reports.',
    ],
    methods: ['Time Saved', 'Error Reduction', 'Revenue Acceleration', 'Opportunity Cost', 'Replacement Cost'],
  },
};

// ============================================================================
// Component
// ============================================================================

export function PricingMethodologyNote({
  variant,
  compact = false,
  calculationContext,
  className = '',
}: PricingMethodologyNoteProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const copy = VARIANT_COPY[variant];

  // Format the context for display
  const contextLabel = calculationContext
    ? formatContextLabel(calculationContext)
    : null;

  if (compact) {
    return (
      <div className={`mt-2 ${className}`}>
        <Link
          href="/pricing/methodology"
          className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
        >
          <Info className="w-3 h-3 flex-shrink-0" />
          <span>{copy.collapsedCompact}</span>
          {contextLabel && (
            <span className="text-gray-300 dark:text-gray-600"> · {contextLabel}</span>
          )}
        </Link>
      </div>
    );
  }

  return (
    <div className={`mt-3 ${className}`}>
      {/* Collapsed trigger */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
        aria-expanded={isExpanded}
      >
        <Info className="w-3 h-3 flex-shrink-0" />
        <span>{copy.collapsed}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/50 text-[11px] text-gray-500 dark:text-gray-400 space-y-2">
          {copy.expanded.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}

          {/* Calculation methods used */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {copy.methods.map((method) => (
              <span
                key={method}
                className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              >
                {method}
              </span>
            ))}
          </div>

          {/* Context info */}
          {calculationContext && (
            <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                <span className="font-medium">Calculated for:</span>{' '}
                {formatContextDetail(calculationContext)}
                {calculationContext.isDefault && (
                  <span className="ml-1 text-gray-300 dark:text-gray-600">
                    (default — use the ROI Calculator to personalize)
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Link to full methodology page */}
          <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
            <Link
              href="/pricing/methodology"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              View full methodology
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatContextLabel(ctx: CalculationContextDisplay): string {
  const parts: string[] = [];
  if (ctx.industry && ctx.industry !== '_default') {
    parts.push(formatIndustryName(ctx.industry));
  }
  if (ctx.companySize) {
    parts.push(`${ctx.companySize} employees`);
  }
  return parts.join(', ') || 'General';
}

function formatContextDetail(ctx: CalculationContextDisplay): string {
  const industry = ctx.industry === '_default' ? 'General' : formatIndustryName(ctx.industry);
  return `${industry}, ${ctx.companySize} employees, ${formatSegmentName(ctx.segment)} segment`;
}

function formatIndustryName(industry: string): string {
  return industry
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSegmentName(segment: string): string {
  const names: Record<string, string> = {
    smb: 'Small Business',
    midmarket: 'Mid-Market',
    nonprofit: 'Nonprofit',
  };
  return names[segment] || segment;
}
