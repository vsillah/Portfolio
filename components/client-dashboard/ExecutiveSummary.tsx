'use client'

import { ArrowRight, BarChart3, FileText, LineChart, ListChecks, Radar } from 'lucide-react'
import type { AssessmentCategory, CategoryScores } from '@/lib/assessment-scoring'

const CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  business_challenges: 'Business',
  tech_stack: 'Tech',
  automation_needs: 'Automation',
  ai_readiness: 'AI Readiness',
  budget_timeline: 'Budget',
  decision_making: 'Decision',
}

interface ExecutiveSummaryProps {
  clientCompany: string | null
  overallScore: number
  categoryScores: CategoryScores
  scoreDelta: { absolute: number; percentage: number }
  tasksCompleted: number
  tasksTotal: number
  highPriorityRemaining: number
  snapshotsCount: number
  recommendationsCount: number
  diagnosticSummary: string | null
  recommendedActions: string[] | null
}

function scoreBand(score: number): string {
  if (score >= 80) return 'strong operating foundation'
  if (score >= 60) return 'workable foundation with clear improvement paths'
  if (score >= 40) return 'developing foundation with visible execution gaps'
  return 'early foundation that needs the basics connected first'
}

function formatDelta(delta: { absolute: number; percentage: number }): string {
  if (delta.absolute === 0 && delta.percentage === 0) return 'holding steady'
  const direction = delta.absolute > 0 ? 'up' : 'down'
  return `${direction} ${Math.abs(delta.absolute)} points`
}

function strongestAndWeakest(scores: CategoryScores): { strongest: string; weakest: string } {
  const ranked = (Object.entries(scores) as Array<[AssessmentCategory, number]>)
    .sort((a, b) => b[1] - a[1])

  return {
    strongest: CATEGORY_LABELS[ranked[0]?.[0] || 'business_challenges'],
    weakest: CATEGORY_LABELS[ranked[ranked.length - 1]?.[0] || 'business_challenges'],
  }
}

function fallbackSummary(clientCompany: string | null): string {
  const subject = clientCompany || 'your business'
  return `This dashboard translates the assessment into an operating view for ${subject}: where the business stands now, which gaps matter most, and which actions move the score.`
}

export default function ExecutiveSummary({
  clientCompany,
  overallScore,
  categoryScores,
  scoreDelta,
  tasksCompleted,
  tasksTotal,
  highPriorityRemaining,
  snapshotsCount,
  recommendationsCount,
  diagnosticSummary,
  recommendedActions,
}: ExecutiveSummaryProps) {
  const { strongest, weakest } = strongestAndWeakest(categoryScores)
  const completionRate = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0
  const summary = diagnosticSummary?.trim() || fallbackSummary(clientCompany)
  const primaryActions = (recommendedActions || [])
    .map((action) => action.trim())
    .filter(Boolean)
    .slice(0, 2)
  const recommendationText = primaryActions.length > 0
    ? primaryActions.join(' ')
    : highPriorityRemaining > 0
      ? `Start with the ${highPriorityRemaining} high-priority action${highPriorityRemaining === 1 ? '' : 's'} and use the recommendations below to decide what should be handled first.`
      : 'Use the recommendations below to decide what to sustain, automate, or accelerate next.'

  const mapItems = [
    {
      label: 'Widgets',
      title: 'Current health',
      value: `${overallScore}/100`,
      detail: scoreBand(overallScore),
      icon: BarChart3,
    },
    {
      label: 'Radar',
      title: 'Category pattern',
      value: strongest,
      detail: `strongest; ${weakest} needs the most attention`,
      icon: Radar,
    },
    {
      label: 'Trajectory',
      title: 'Progress path',
      value: snapshotsCount > 0 ? formatDelta(scoreDelta) : 'projected after milestones',
      detail: snapshotsCount > 0 ? 'based on score snapshots and milestones' : 'will fill in as delivery evidence accumulates',
      icon: LineChart,
    },
    {
      label: 'Actions',
      title: 'Execution focus',
      value: `${completionRate}% complete`,
      detail: `${tasksCompleted}/${tasksTotal} tasks complete; ${recommendationsCount} acceleration option${recommendationsCount === 1 ? '' : 's'}`,
      icon: ListChecks,
    },
  ]

  return (
    <section className="rounded-xl border border-radiant-gold/20 bg-gradient-to-br from-silicon-slate/70 via-imperial-navy/70 to-silicon-slate/45 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-radiant-gold" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-radiant-gold">
              Executive Summary
            </h2>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-platinum-white/78">
            {summary}
          </p>
          <div className="mt-4 rounded-lg border border-radiant-gold/15 bg-imperial-navy/45 p-3 sm:p-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-platinum-white/45">
              Recommended focus
            </p>
            <p className="text-sm leading-6 text-platinum-white/82">{recommendationText}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {mapItems.map((item, index) => (
            <div
              key={item.label}
              className="relative rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-3 sm:p-4"
            >
              {index % 2 === 0 && (
                <ArrowRight className="absolute -right-4 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-radiant-gold/45 sm:block" />
              )}
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-radiant-gold/80">
                  {item.label}
                </span>
                <item.icon className="h-4 w-4 text-radiant-gold/80" />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-platinum-white/45 sm:text-xs">{item.title}</p>
              <p className="mt-1 text-sm font-semibold text-platinum-white">{item.value}</p>
              <p className="mt-1 hidden text-xs leading-5 text-platinum-white/58 sm:block">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
