'use client';

import { type DecoyComparison, formatCurrency, formatPriceOrFree } from '@/lib/pricing-model';
import { Check, X, ArrowRight, Shield, Heart, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { PricingMethodologyNote } from '@/components/pricing/PricingMethodologyNote';

interface CommunityImpactComparisonProps {
  comparisons: DecoyComparison[];
  className?: string;
  /** When true, shows intro header: "Community Impact vs. Full-Service" */
  showIntroHeader?: boolean;
}

export function CommunityImpactComparison({ comparisons, className = '', showIntroHeader = false }: CommunityImpactComparisonProps) {
  return (
    <div className={`space-y-12 ${className}`}>
      {showIntroHeader && (
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h3 className="font-heading text-xl font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-2">
            Community Impact vs. Full-Service
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Left: budget-friendly, self-serve. Right: hands-on delivery with outcome guarantees.
          </p>
        </div>
      )}
      {comparisons.map((comparison) => (
        <ComparisonPair key={comparison.decoyTier.id} comparison={comparison} />
      ))}
    </div>
  );
}

function ComparisonPair({ comparison }: { comparison: DecoyComparison }) {
  const { decoyTier, premiumTier, keyDifferences } = comparison;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* CI (Decoy) Card — Left, muted */}
      <div className="relative flex flex-col rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-50/30 to-white p-6 shadow-sm dark:from-emerald-900/10 dark:to-gray-900 dark:border-emerald-700/40">
        {/* Badge */}
        <div className="absolute -top-3 left-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-heading font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            <Heart className="w-3 h-3" />
            Community Impact
          </span>
        </div>
        <p className="mt-5 text-xs text-emerald-600/80 dark:text-emerald-400/80">Budget-friendly • Self-serve</p>

        {/* Header */}
        <div className="mt-2 mb-4">
          <h3 className="font-heading text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wide">
            {decoyTier.name}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{decoyTier.tagline}</p>
        </div>

        {/* Price */}
        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatPriceOrFree(decoyTier.price)}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {formatCurrency(decoyTier.totalRetailValue)} total value
          </p>
          <PricingMethodologyNote variant="retail" compact />
        </div>

        {/* Feature highlights */}
        <div className="flex-1 space-y-2 mb-6">
          {keyDifferences.map((diff) => (
            <div key={diff.feature} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                {diff.decoyValue === 'None' ? (
                  <X className="w-3 h-3 text-gray-400" />
                ) : (
                  <Check className="w-3 h-3 text-emerald-500" />
                )}
              </span>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">{diff.feature}:</span>{' '}
                <span className="text-gray-500 dark:text-gray-400">{diff.decoyValue}</span>
              </div>
            </div>
          ))}
        </div>

        {/* No guarantee callout */}
        <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <X className="w-3.5 h-3.5 text-gray-400" />
            No money-back guarantee — as-is delivery
          </p>
        </div>

        {/* CTA */}
        <Link
          href={decoyTier.ctaHref}
          className="w-full rounded-xl border-2 border-emerald-500/30 bg-white px-4 py-3 text-center text-sm font-heading font-bold uppercase tracking-wide text-emerald-700 transition-all hover:bg-emerald-50 hover:border-emerald-500 dark:bg-gray-900 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
        >
          {decoyTier.ctaText}
        </Link>
      </div>

      {/* Premium Card — Right, highlighted */}
      <div className="relative flex flex-col rounded-2xl border-2 border-radiant-gold bg-gradient-to-b from-amber-50/50 to-white p-6 shadow-lg dark:from-amber-900/10 dark:to-gray-900">
        {/* Badge */}
        <div className="absolute -top-3 left-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-radiant-gold px-3 py-1 text-xs font-heading font-bold uppercase tracking-wide text-imperial-navy shadow-md">
            <Shield className="w-3 h-3" />
            Full-Service Small Business
          </span>
        </div>
        <p className="mt-5 text-xs text-amber-700/90 dark:text-amber-300/90">Hands-on • Guarantees included</p>

        {/* Header */}
        <div className="mt-2 mb-4">
          <h3 className="font-heading text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wide">
            {premiumTier.name}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{premiumTier.tagline}</p>
        </div>

        {/* Price */}
        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(premiumTier.price)}
            </span>
            {premiumTier.isCustomPricing && (
              <span className="text-sm text-gray-400">starting</span>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {formatCurrency(premiumTier.totalRetailValue)} total value — {premiumTier.savingsPercent}% savings
          </p>
          <PricingMethodologyNote variant="retail" compact />
        </div>

        {/* Feature highlights */}
        <div className="flex-1 space-y-2 mb-6">
          {keyDifferences.map((diff) => (
            <div key={diff.feature} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Check className="w-3 h-3 text-radiant-gold" />
              </span>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">{diff.feature}:</span>{' '}
                <span className="text-gray-900 dark:text-white font-medium">{diff.premiumValue}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Guarantee callout */}
        {premiumTier.guarantee && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
            <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              {premiumTier.guarantee.name}: {premiumTier.guarantee.description}
            </p>
          </div>
        )}

        {/* CTA */}
        <Link
          href={premiumTier.ctaHref}
          className="group w-full rounded-xl bg-radiant-gold px-4 py-3 text-center text-sm font-heading font-bold uppercase tracking-wide text-imperial-navy transition-all hover:bg-amber-400 hover:scale-[1.02] flex items-center justify-center gap-2"
        >
          {premiumTier.ctaText}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>

        {/* Upgrade nudge */}
        <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
          Upgrade to full-service: Only {formatCurrency(premiumTier.price - decoyTier.price)} more for hands-on delivery + guarantee
        </p>
      </div>

      {/* Upsell context — "Why upgrade?" callout from offer_upsell_paths */}
      {comparison.upsellContext && (
        <div className="lg:col-span-2 mt-2 rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50/50 to-white p-5 dark:from-amber-900/10 dark:to-gray-900 dark:border-amber-700/30">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
              <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </span>
            <div className="flex-1">
              <h4 className="font-heading text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-1">
                Why Upgrade?
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                {comparison.upsellContext.nextProblem}
              </p>
              {comparison.upsellContext.valueFrame && (
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mb-1">
                  {comparison.upsellContext.valueFrame}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                {comparison.upsellContext.riskReversal && (
                  <span className="inline-flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-500" />
                    {comparison.upsellContext.riskReversal}
                  </span>
                )}
                {comparison.upsellContext.creditNote && (
                  <span className="inline-flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-500" />
                    {comparison.upsellContext.creditNote}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
