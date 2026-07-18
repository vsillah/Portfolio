'use client'

import type { ReactNode } from 'react'
import { FileText, LineChart, ListChecks, Radar } from 'lucide-react'
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
  highPriorityRemaining: number
  diagnosticSummary: string | null
  recommendedActions: string[] | null
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
  highPriorityRemaining,
  diagnosticSummary,
  recommendedActions,
}: ExecutiveSummaryProps) {
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

  return (
    <section className="rounded-xl border border-radiant-gold/20 bg-gradient-to-br from-silicon-slate/70 via-imperial-navy/70 to-silicon-slate/45 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-radiant-gold" />
        <h2 className="text-sm font-medium uppercase tracking-wider text-radiant-gold">
          Executive Summary
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-start">
        <p className="text-sm leading-6 text-platinum-white/78">
          {summary}
        </p>
        <div className="rounded-lg border border-radiant-gold/15 bg-imperial-navy/45 p-3 sm:p-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-platinum-white/45">
            Recommended focus
          </p>
          <p className="text-sm leading-6 text-platinum-white/82">{recommendationText}</p>
        </div>
      </div>
    </section>
  )
}

interface SectionCommentaryProps {
  icon: typeof Radar
  title: string
  children: ReactNode
}

function SectionCommentary({ icon: Icon, title, children }: SectionCommentaryProps) {
  return (
    <div className="rounded-lg border border-radiant-gold/15 bg-imperial-navy/35 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-radiant-gold/85" />
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-radiant-gold/80">
          {title}
        </h3>
      </div>
      <p className="text-sm leading-6 text-platinum-white/72">{children}</p>
    </div>
  )
}

export function AssessmentScoresCommentary({ categoryScores }: { categoryScores: CategoryScores }) {
  const { strongest, weakest } = strongestAndWeakest(categoryScores)

  return (
    <SectionCommentary icon={Radar} title="How to read this chart">
      The radar shows the category pattern behind the score. {strongest} is the strongest area right now, while {weakest} is the clearest place to close the gap.
    </SectionCommentary>
  )
}

export function TrajectoryCommentary({
  scoreDelta,
  snapshotsCount,
}: {
  scoreDelta: { absolute: number; percentage: number }
  snapshotsCount: number
}) {
  return (
    <SectionCommentary icon={LineChart} title="What the trajectory means">
      {snapshotsCount > 0
        ? `The line connects score snapshots and projected milestones, so the current path is ${formatDelta(scoreDelta)} until more delivery evidence changes it.`
        : 'This will become a progress path once milestone projections and delivery evidence are available.'}
    </SectionCommentary>
  )
}

export function ActionFocusCommentary({
  tasksCompleted,
  tasksTotal,
  highPriorityRemaining,
  recommendationsCount,
}: {
  tasksCompleted: number
  tasksTotal: number
  highPriorityRemaining: number
  recommendationsCount: number
}) {
  const completionRate = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0

  return (
    <SectionCommentary icon={ListChecks} title="How to use this list">
      This is the execution view: {tasksCompleted}/{tasksTotal} tasks are complete, the dashboard is {completionRate}% complete, and {highPriorityRemaining} high-priority action{highPriorityRemaining === 1 ? '' : 's'} should be handled before lower-priority work. {recommendationsCount} acceleration option{recommendationsCount === 1 ? '' : 's'} can be used when you want to move faster.
    </SectionCommentary>
  )
}
