'use client'

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { CategoryScores } from '@/lib/assessment-scoring'
import { CATEGORY_LABELS, type AssessmentCategory } from '@/lib/assessment-scoring'

interface ScoreRadarChartProps {
  scores: CategoryScores
  dreamScores?: Partial<CategoryScores>
}

export default function ScoreRadarChart({ scores, dreamScores }: ScoreRadarChartProps) {
  const defaultDream = 90

  const data = (Object.keys(CATEGORY_LABELS) as AssessmentCategory[]).map((key) => ({
    category: CATEGORY_LABELS[key],
    current: scores[key] || 0,
    target: dreamScores?.[key] ?? defaultDream,
  }))

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        Your Business Assessment Scores
      </h3>
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
              name="Target"
              dataKey="target"
              stroke="#6366F1"
              fill="#6366F1"
              fillOpacity={0.1}
              strokeDasharray="4 4"
            />
            <Radar
              name="Your Scores"
              dataKey="current"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
