'use client';

import { type PricingTier, type TierItem, formatCurrency, formatPercent, formatPriceOrFree } from '@/lib/pricing-model';
import Link from 'next/link';
import { Check, Zap, Shield, Target, UserPlus, Lightbulb, TrendingUp, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PricingMethodologyNote, type CalculationContextDisplay } from '@/components/pricing/PricingMethodologyNote';
import type { ActiveCampaignSummary } from '@/hooks/useCampaignEligibility';

interface PricingCardProps {
  tier: PricingTier;
  onSelect?: (tierId: string) => void;
  calculationContext?: CalculationContextDisplay | null;
  campaign?: ActiveCampaignSummary | null;
}

/** Icon per outcome group label (default seed labels). */
const OUTCOME_ICONS: Record<string, LucideIcon> = {
  'Capture & Convert Leads': UserPlus,
  'Save Time & Scale Ops': Zap,
  'Strategy & Support': Lightbulb,
  'Grow Your Presence': TrendingUp,
};
const DEFAULT_OUTCOME_ICON = Target;

/** Group tier items by outcome for pricing chart; preserves item order within groups. */
function groupItemsByOutcome(items: TierItem[]): { label: string; items: TierItem[]; displayOrder: number }[] {
  const sectionMap = new Map<string, { label: string; items: TierItem[]; displayOrder: number }>();
  const sectionOrder: string[] = [];

  for (const item of items) {
    const key = item.outcomeGroup?.id ?? '__none__';
    const label = item.outcomeGroup?.label ?? 'Included';
    const displayOrder = item.outcomeGroup?.display_order ?? 999;

    if (!sectionMap.has(key)) {
      sectionMap.set(key, { label, items: [], displayOrder });
      sectionOrder.push(key);
    }
    sectionMap.get(key)!.items.push(item);
  }

  return sectionOrder
    .map((key) => sectionMap.get(key)!)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
}

function TierItemRow({ item }: { item: TierItem }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 flex-shrink-0 ${
        item.isDeployed
          ? 'text-radiant-gold'
          : item.offerRole === 'core_offer'
            ? 'text-imperial-navy dark:text-white'
            : 'text-gray-400'
      }`}>
        {item.isDeployed ? <Zap className="w-4 h-4 fill-current" /> : <Check className="w-4 h-4" />}
      </span>
      <div className="flex-1">
        <span className={`text-sm leading-tight block ${
          item.offerRole === 'core_offer'
            ? 'font-medium text-gray-900 dark:text-white'
            : 'text-gray-600 dark:text-gray-300'
        }`}>
          {item.title}
        </span>
        <div className="flex flex-wrap gap-2 mt-1">
          {item.isDeployed && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-radiant-gold bg-radiant-gold/10 px-1.5 py-0.5 rounded">Deployed</span>
          )}
          <span className="text-[10px] text-gray-400">
            Valued at {formatCurrency(item.perceivedValue)}
          </span>
        </div>
      </div>
    </li>
  );
}

export function PricingCard({ tier, onSelect, calculationContext, campaign }: PricingCardProps) {
  const sections = groupItemsByOutcome(tier.items);
  const showOutcomeHeadings = sections.length > 1 || (sections.length === 1 && sections[0].label !== 'Included');

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 p-6 shadow-sm transition-all duration-300 hover:shadow-xl ${
        tier.featured
          ? 'border-radiant-gold bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-900/10 dark:to-gray-900 transform scale-105 z-10'
          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 hover:border-radiant-gold/30'
      }`}
    >
      {tier.featured && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-radiant-gold px-4 py-1 text-sm font-heading font-bold uppercase tracking-wide text-imperial-navy shadow-md">
          Most Popular
        </div>
      )}
      {campaign && (
        <Link
          href={`/campaigns/${campaign.slug}`}
          className="absolute -top-3 right-3 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-xs font-bold text-white shadow-md hover:shadow-lg transition-shadow"
        >
          <Sparkles className="w-3 h-3" />
          {campaign.campaign_type === 'win_money_back' ? 'Win Your Money Back' : campaign.name}
        </Link>
      )}

      {/* Header */}
      <div className="mb-6">
        <h3 className="font-heading text-xl font-bold text-gray-900 dark:text-white uppercase tracking-wide">{tier.name}</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 min-h-[40px]">{tier.tagline}</p>
        <p className="mt-2 text-xs font-medium text-imperial-navy/60 dark:text-radiant-gold/60 uppercase tracking-wider">{tier.targetAudience}</p>
      </div>

      {/* Price */}
      <div className="mb-8">
        <div className="flex items-baseline gap-1">
          {tier.isCustomPricing && (
            <span className="text-sm font-medium text-gray-500">from</span>
          )}
          <span className="font-premium text-5xl font-bold text-gray-900 dark:text-white">
            {formatPriceOrFree(tier.price)}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm text-gray-400 line-through decoration-gray-300">
            {formatCurrency(tier.totalRetailValue)}
          </span>
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Save {formatPercent(tier.savingsPercent)}
          </span>
        </div>
        <PricingMethodologyNote
          variant="retail"
          compact
          calculationContext={calculationContext}
        />
      </div>

      {/* Items: grouped by outcome when present */}
      <div className="mb-8 flex-1 space-y-5">
        {sections.map((section, idx) => {
          const OutcomeIcon = showOutcomeHeadings ? (OUTCOME_ICONS[section.label] ?? DEFAULT_OUTCOME_ICON) : null;
          return (
          <div key={section.label === 'Included' ? 'included' : section.items[0]?.outcomeGroup?.id ?? `section-${idx}`}>
            {showOutcomeHeadings && OutcomeIcon && (
              <div className="flex items-center gap-2 mb-2">
                <OutcomeIcon className="w-3.5 h-3.5 text-imperial-navy/70 dark:text-radiant-gold/70" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  {section.label}
                </span>
              </div>
            )}
            <ul className="space-y-4">
              {section.items.map((item, idx) => (
                <TierItemRow key={idx} item={item} />
              ))}
            </ul>
          </div>
          );
        })}
      </div>

      {/* Guarantee */}
      {tier.guarantee ? (
        <div className="mb-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-radiant-gold" />
            <span className="text-xs font-bold uppercase tracking-wide text-gray-900 dark:text-white">
              {tier.guarantee.name}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {tier.guarantee.description}
          </p>
        </div>
      ) : (
        <div className="mb-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            No money-back guarantee — as-is delivery
          </p>
        </div>
      )}

      {/* CTA */}
      {onSelect ? (
        <button
          onClick={() => onSelect(tier.id)}
          className={`w-full rounded-full py-3.5 text-center text-sm font-heading font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] ${
            tier.featured
              ? 'bg-imperial-navy text-white hover:bg-imperial-navy/90 shadow-lg hover:shadow-xl'
              : 'bg-white text-imperial-navy border-2 border-imperial-navy hover:bg-gray-50 dark:bg-transparent dark:text-white dark:border-white dark:hover:bg-white/10'
          }`}
        >
          {tier.ctaText}
        </button>
      ) : (
        <Link
          href={tier.ctaHref}
          className={`block w-full rounded-full py-3.5 text-center text-sm font-heading font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] ${
            tier.featured
              ? 'bg-imperial-navy text-white hover:bg-imperial-navy/90 shadow-lg hover:shadow-xl'
              : 'bg-white text-imperial-navy border-2 border-imperial-navy hover:bg-gray-50 dark:bg-transparent dark:text-white dark:border-white dark:hover:bg-white/10'
          }`}
        >
          {tier.ctaText}
        </Link>
      )}
    </div>
  );
}
