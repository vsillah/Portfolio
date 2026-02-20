'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { CHART_SEGMENT_COLORS, CHART_AXIS_COLORS, CHART_TOOLTIP_STYLE } from '@/lib/admin-chart-theme'

export type BarDataItem = { name: string; value: number }

interface AdminBarChartProps {
  /** Data: [{ name, value }] */
  data: BarDataItem[]
  /** Accessible chart description (used for aria-label) */
  ariaLabel: string
  /** Optional height in pixels; default 140 */
  height?: number
  /** Optional title shown above chart */
  title?: string
}

export default function AdminBarChart({
  data,
  ariaLabel,
  height = 140,
  title,
}: AdminBarChartProps) {
  const hasData = data.length > 0 && data.some((d) => d.value > 0)

  if (!hasData) {
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

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="w-full"
    >
      {title && (
        <p className="text-xs font-medium text-platinum-white/80 mb-1.5">{title}</p>
      )}
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
            layout="vertical"
          >
            <CartesianGrid
              stroke={CHART_AXIS_COLORS.grid}
              strokeOpacity={CHART_AXIS_COLORS.gridOpacity}
              horizontal={false}
              strokeDasharray="3 3"
            />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={60}
              tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number | undefined) => [String(value ?? 0), '']}
            />
            <Bar
              dataKey="value"
              fill={CHART_SEGMENT_COLORS[0]}
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
