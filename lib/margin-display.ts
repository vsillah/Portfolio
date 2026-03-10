/**
 * Margin and ratio display helpers for cost/margin tracking.
 * Amadutown design system: use radiant-gold, amber, destructive for ratio states.
 */

/** Format margin % (profit / price). Returns "N/A" when price <= 0. */
export function formatMarginPercent(price: number, cost: number): string {
  if (price <= 0) return 'N/A'
  const profit = price - (cost ?? 0)
  const pct = (profit / price) * 100
  return `${Math.round(pct)}%`
}

/** Format margin $ (price - cost). */
export function formatMarginDollar(price: number, cost: number): string {
  const profit = price - (cost ?? 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(profit)
}

/**
 * Format Profit:Cost ratio (gross profit / cost).
 * Returns "N/A" when revenue = 0 or cost = 0 (no divide by zero).
 */
export function formatRatio(grossProfit: number, totalCost: number): string {
  if (totalCost <= 0 || grossProfit < 0) return 'N/A'
  const ratio = grossProfit / totalCost
  if (!Number.isFinite(ratio)) return 'N/A'
  return `${Math.round(ratio * 10) / 10}:1`
}

/** Target ratio (env PROFIT_COST_RATIO_TARGET, default 5). */
const RATIO_TARGET = 5

/** Caution threshold (below target but above this = yellow). */
const RATIO_CAUTION = 3

/**
 * Get ratio color class for Amadutown design system.
 * On target: radiant-gold; caution: amber; below: destructive (red).
 */
export function getRatioColor(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return 'text-platinum-white/70'
  if (ratio >= RATIO_TARGET) return 'text-radiant-gold'
  if (ratio >= RATIO_CAUTION) return 'text-amber-400'
  return 'text-red-400'
}

/**
 * Get Badge variant for ratio (default | secondary | destructive).
 * Maps to shadcn/ui Badge variants when available.
 */
export function getRatioBadgeVariant(ratio: number | null): 'default' | 'secondary' | 'destructive' {
  if (ratio === null || !Number.isFinite(ratio)) return 'secondary'
  if (ratio >= RATIO_TARGET) return 'default'
  if (ratio >= RATIO_CAUTION) return 'secondary'
  return 'destructive'
}
