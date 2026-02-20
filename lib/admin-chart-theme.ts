/**
 * Amadutown design system colors for admin dashboard charts.
 * Ensures visual consistency and sufficient contrast for accessibility.
 */

// Brand palette (from tailwind.config)
export const CHART_COLORS = {
  radiantGold: '#D4AF37',
  goldLight: '#F5D060',
  amber: '#F59E0B',
  siliconSlate: '#2C3E50',
  imperialNavy: '#121E31',
  platinumWhite: '#EAECEE',
} as const

/**
 * Palette for pie/bar chart segments.
 * Uses distinct hues for clear differentiation (not just gold shades).
 * Order: gold accent, teal, amber, slate-blue, rose, cyan.
 */
export const CHART_SEGMENT_COLORS = [
  CHART_COLORS.radiantGold,
  '#10B981', // emerald - good contrast
  CHART_COLORS.amber,
  '#6366F1', // indigo
  '#EC4899', // pink
  '#06B6D4', // cyan
] as const

/** Tick and axis colors for bar charts */
export const CHART_AXIS_COLORS = {
  tick: CHART_COLORS.platinumWhite,
  tickOpacity: 0.7,
  grid: CHART_COLORS.siliconSlate,
  gridOpacity: 0.4,
} as const

/** Tooltip styling matching admin dark theme */
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: CHART_COLORS.imperialNavy,
  border: `1px solid ${CHART_COLORS.siliconSlate}`,
  borderRadius: '8px',
  color: CHART_COLORS.platinumWhite,
  fontSize: 12,
  padding: '8px 12px',
} as const
