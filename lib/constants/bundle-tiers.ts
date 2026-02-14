/**
 * Pricing tier options for admin bundle Create/Edit modals and card labels.
 * Used by app/admin/sales/bundles and any UI that displays or selects pricing tier.
 */

export const TIER_OPTIONS = [
  { value: 'quick-win', label: 'AI Quick Win ($997)' },
  { value: 'accelerator', label: 'AI Accelerator ($7,497)' },
  { value: 'growth-engine', label: 'Growth Engine ($14,997)' },
  { value: 'digital-transformation', label: 'Digital Transformation ($29,997+)' },
] as const;

export type PricingTierSlug = (typeof TIER_OPTIONS)[number]['value'];
