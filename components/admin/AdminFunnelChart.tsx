'use client'

import { CHART_SEGMENT_COLORS } from '@/lib/admin-chart-theme'

export type FunnelStage = { name: string; value: number }

interface AdminFunnelChartProps {
  /** Stages in order: left to right (e.g. Total Leads, Contacted, Replied) */
  data: FunnelStage[]
  /** Accessible chart description */
  ariaLabel: string
  /** Optional height in pixels; default 140 */
  height?: number
  /** Optional title shown above chart */
  title?: string
}

/**
 * Horizontal funnel: stages left to right. Each stage is a vertical bar whose
 * height is proportional to its value (relative to the first stage). Visually
 * narrows as you move right (Total → Contacted → Replied).
 */
export default function AdminFunnelChart({
  data,
  ariaLabel,
  height = 140,
  title,
}: AdminFunnelChartProps) {
  const maxValue = data.length > 0 ? Math.max(...data.map((d) => d.value), 1) : 1
  const minHeightPercent = 8 // so zero-value stages still show a sliver

  const stages = data.map((d, i) => ({
    ...d,
    heightPercent: maxValue > 0 ? Math.max(minHeightPercent, (d.value / maxValue) * 100) : minHeightPercent,
    color: CHART_SEGMENT_COLORS[i % CHART_SEGMENT_COLORS.length],
  }))

  const hasAnyData = data.some((d) => d.value > 0) || data.length > 0

  if (!hasAnyData) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-silicon-slate/50 bg-silicon-slate/10"
        style={{ minHeight: height }}
        role="img"
        aria-label={`${ariaLabel}: No data`}
      >
        <span className="text-sm text-platinum-white/50">No data</span>
      </div>
    )
  }

  const barAreaHeight = Math.max(80, height - 40) // space for bars; rest for title + labels

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="w-full"
    >
      {title && (
        <p className="text-xs font-medium text-platinum-white/80 mb-1.5">{title}</p>
      )}
      <div className="flex flex-row items-end justify-center gap-3 sm:gap-4" style={{ height: barAreaHeight + 28 }}>
        {stages.map((stage, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col items-center justify-end gap-1.5 min-w-0"
          >
            <div
              className="w-full rounded-t-md transition-all duration-300 flex items-start justify-center pt-1"
              style={{
                height: `${(stage.heightPercent / 100) * barAreaHeight}px`,
                minHeight: 24,
                backgroundColor: stage.color,
                color: '#121E31',
              }}
            >
              <span className="text-xs font-semibold tabular-nums">{stage.value}</span>
            </div>
            <span className="text-xs font-medium text-platinum-white/80 truncate w-full text-center">{stage.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
