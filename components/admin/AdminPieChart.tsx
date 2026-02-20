'use client'

import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { CHART_COLORS, CHART_SEGMENT_COLORS, CHART_TOOLTIP_STYLE } from '@/lib/admin-chart-theme'

export type PieDataItem = { name: string; value: number }

interface AdminPieChartProps {
  /** Data: [{ name, value }] */
  data: PieDataItem[]
  /** Accessible chart description (used for aria-label) */
  ariaLabel: string
  /** Optional height in pixels; default 140 */
  height?: number
  /** Optional title shown above chart */
  title?: string
}

export default function AdminPieChart({
  data,
  ariaLabel,
  height = 140,
  title,
}: AdminPieChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const hasData = total > 0

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
          <RechartsPie margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="70%"
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              legendType="circle"
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={CHART_SEGMENT_COLORS[i % CHART_SEGMENT_COLORS.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number | undefined) => {
                const v = value ?? 0
                return [`${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`, '']
              }}
              itemStyle={{ color: CHART_COLORS.platinumWhite }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value, entry) => (
                <span className="text-platinum-white/90" style={{ color: entry?.color }}>
                  {value}
                </span>
              )}
              iconSize={8}
              iconType="circle"
              layout="horizontal"
              verticalAlign="bottom"
            />
          </RechartsPie>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
