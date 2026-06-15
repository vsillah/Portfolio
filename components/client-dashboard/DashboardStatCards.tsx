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
      color: 'from-radiant-gold/20 to-bronze/15 border-radiant-gold/45',
      iconColor: 'text-radiant-gold',
    },
    {
      label: 'Tasks Completed',
      value: `${tasksCompleted}/${tasksTotal}`,
      icon: CheckSquare,
      delta: null,
      deltaPositive: false,
      color: 'from-silicon-slate/75 to-imperial-navy/70 border-radiant-gold/25',
      iconColor: 'text-gold-light',
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      icon: Target,
      delta: null,
      deltaPositive: false,
      color: 'from-silicon-slate/65 to-bronze/15 border-bronze/45',
      iconColor: 'text-radiant-gold',
    },
    {
      label: 'High Priority',
      value: highPriorityRemaining.toString(),
      icon: AlertTriangle,
      delta: null,
      deltaPositive: false,
      color: 'from-bronze/20 to-imperial-navy/70 border-bronze/50',
      iconColor: 'text-gold-light',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`bg-gradient-to-r ${card.color} border rounded-lg p-4 md:p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-platinum-white/60 uppercase tracking-wider">
              {card.label}
            </span>
            <card.icon className={`w-5 h-5 ${card.iconColor}`} />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl md:text-3xl font-bold text-platinum-white font-heading">
              {card.value}
            </span>
            {card.delta && (
              <span
                className={`text-xs font-medium mb-1 ${
                  card.deltaPositive ? 'text-gold-light' : 'text-bronze'
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
