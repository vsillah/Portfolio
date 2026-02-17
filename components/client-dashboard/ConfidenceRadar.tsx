'use client'

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import type { CategoryScores } from '@/lib/assessment-scoring'
import { CATEGORY_LABELS, type AssessmentCategory } from '@/lib/assessment-scoring'

interface ConfidenceRadarProps {
  /** Per-category confidence 0-100 (same shape as CategoryScores) */
  confidence: CategoryScores
}

export default function ConfidenceRadar({ confidence }: ConfidenceRadarProps) {
  const data = (Object.keys(CATEGORY_LABELS) as AssessmentCategory[]).map((key) => ({
    category: CATEGORY_LABELS[key],
    value: confidence[key] ?? 0,
  }))

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-1">
        Confidence in this view
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Higher confidence means more personalized; answering more questions and completing engagement steps will increase it.
      </p>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#6B7280', fontSize: 10 }}
              axisLine={false}
            />
            <Radar
              name="Confidence"
              dataKey="value"
              stroke="#10B981"
              fill="#10B981"
              fillOpacity={0.25}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
