'use client'

import { BarChart3, CheckSquare, Target, AlertTriangle } from 'lucide-react'

interface DashboardStatCardsProps {
  overallScore: number
  scoreDelta: { absolute: number; percentage: number }
  tasksCompleted: number
  tasksTotal: number
  highPriorityRemaining: number
}

export default function DashboardStatCards({
  overallScore,
  scoreDelta,
  tasksCompleted,
  tasksTotal,
  highPriorityRemaining,
}: DashboardStatCardsProps) {
  const completionRate = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0

  const cards = [
    {
      label: 'Overall Score',
      value: overallScore.toString(),
      icon: BarChart3,
      delta: scoreDelta.percentage !== 0 ? `${scoreDelta.percentage > 0 ? '+' : ''}${scoreDelta.percentage}%` : null,
      deltaPositive: scoreDelta.percentage > 0,
      color: 'from-blue-600/20 to-indigo-600/20 border-blue-500/50',
      iconColor: 'text-blue-400',
    },
    {
      label: 'Tasks Completed',
      value: `${tasksCompleted}/${tasksTotal}`,
      icon: CheckSquare,
      delta: null,
      deltaPositive: false,
      color: 'from-emerald-600/20 to-green-600/20 border-emerald-500/50',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      icon: Target,
      delta: null,
      deltaPositive: false,
      color: 'from-purple-600/20 to-violet-600/20 border-purple-500/50',
      iconColor: 'text-purple-400',
    },
    {
      label: 'High Priority',
      value: highPriorityRemaining.toString(),
      icon: AlertTriangle,
      delta: null,
      deltaPositive: false,
      color: 'from-rose-600/20 to-red-600/20 border-rose-500/50',
      iconColor: 'text-rose-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`bg-gradient-to-r ${card.color} border rounded-xl p-4 md:p-5`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">
              {card.label}
            </span>
            <card.icon className={`w-5 h-5 ${card.iconColor}`} />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl md:text-3xl font-bold text-white font-heading">
              {card.value}
            </span>
            {card.delta && (
              <span
                className={`text-xs font-medium mb-1 ${
                  card.deltaPositive ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {card.delta}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
