'use client'

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { TrajectoryPoint } from '@/lib/assessment-scoring'

interface TrajectoryChartProps {
  token: string
  initialData?: TrajectoryPoint[]
}

export default function TrajectoryChart({ token, initialData }: TrajectoryChartProps) {
  const [data, setData] = useState<TrajectoryPoint[]>(initialData || [])

  useEffect(() => {
    if (!initialData) {
      fetch(`/api/client/dashboard/${token}/trajectory`)
        .then((res) => res.json())
        .then((res) => setData(res.trajectory || []))
        .catch(() => {})
    }
  }, [token, initialData])

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
          Score Trajectory
        </h3>
        <p className="text-gray-500 text-sm">
          Complete tasks to see your progress trajectory.
        </p>
      </div>
    )
  }

  const chartData = data.map((point) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: point.overallScore,
    isProjected: point.isProjected,
  }))

  // Split into actual and projected for different line styles
  const splitIndex = chartData.findIndex((d) => d.isProjected)

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-1">
        Score Trajectory
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Solid = actual progress, dashed = projected based on remaining tasks
      </p>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#6B7280', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#E5E7EB',
                fontSize: 12,
              }}
            />
            <ReferenceLine y={90} stroke="#6366F1" strokeDasharray="4 4" label={{ value: 'Target', fill: '#6366F1', fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={(props: Record<string, unknown>) => {
                const { cx, cy, index } = props as { cx: number; cy: number; index: number }
                const point = chartData[index as number]
                if (point?.isProjected) {
                  return (
                    <circle
                      key={`dot-${index}`}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="transparent"
                      stroke="#3B82F6"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                  )
                }
                return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#3B82F6" />
              }}
              strokeDasharray={splitIndex >= 0 ? undefined : undefined}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
