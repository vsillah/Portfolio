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

const SHORT_CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  business_challenges: 'Business',
  tech_stack: 'Tech',
  automation_needs: 'Automation',
  ai_readiness: 'AI Readiness',
  budget_timeline: 'Budget',
  decision_making: 'Decision',
}

export default function ScoreRadarChart({ scores, dreamScores }: ScoreRadarChartProps) {
  const defaultDream = 90

  const data = (Object.keys(CATEGORY_LABELS) as AssessmentCategory[]).map((key) => ({
    category: SHORT_CATEGORY_LABELS[key],
    current: scores[key] || 0,
    target: dreamScores?.[key] ?? defaultDream,
  }))

  return (
    <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
      <h3 className="text-sm font-medium text-radiant-gold uppercase tracking-wider mb-4">
        Your Business Assessment Scores
      </h3>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="rgba(212, 175, 55, 0.22)" />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fill: '#EAECEE', fillOpacity: 0.68, fontSize: 11 }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#EAECEE', fillOpacity: 0.45, fontSize: 10 }}
              axisLine={false}
            />
            <Radar
              name="Target"
              dataKey="target"
              stroke="#F5D060"
              fill="#F5D060"
              fillOpacity={0.08}
              strokeDasharray="4 4"
            />
            <Radar
              name="Your Scores"
              dataKey="current"
              stroke="#D4AF37"
              fill="#D4AF37"
              fillOpacity={0.24}
              strokeWidth={2}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#EAECEE' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
