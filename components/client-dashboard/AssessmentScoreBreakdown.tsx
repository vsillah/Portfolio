'use client'

import { AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react'
import type { AssessmentCategory, CategoryScores } from '@/lib/assessment-scoring'

interface AssessmentScoreBreakdownProps {
  scores: CategoryScores
  dreamScores?: Partial<CategoryScores>
}

const CATEGORY_EXPLANATIONS: Record<AssessmentCategory, string> = {
  business_challenges:
    'The business need and migration outcome are clear enough to guide decisions.',
  tech_stack:
    'FireSpring can support the work, but template limits and navigation depth still need confirmation.',
  automation_needs:
    'Supporter, donor, sponsor, and program paths still rely on manual routing and follow-up.',
  ai_readiness:
    'AI is not the immediate blocker; reusable knowledge capture can improve after launch decisions stabilize.',
  budget_timeline:
    'Scope control and vendor timing matter because the current contract should not absorb unlimited rebuild work.',
  decision_making:
    'The main choices are known, but board and vendor feedback still decide final launch readiness.',
}

const SHORT_LABELS: Record<AssessmentCategory, string> = {
  business_challenges: 'Business',
  tech_stack: 'Tech',
  automation_needs: 'Automation',
  ai_readiness: 'AI readiness',
  budget_timeline: 'Budget',
  decision_making: 'Decision',
}

const CATEGORY_ORDER: AssessmentCategory[] = [
  'business_challenges',
  'tech_stack',
  'automation_needs',
  'ai_readiness',
  'budget_timeline',
  'decision_making',
]

const TARGET_SCORE = 90

function getStatus(score: number, target: number) {
  const gap = Math.max(target - score, 0)
  if (gap <= 10) return { label: 'Strong', Icon: CheckCircle2, className: 'text-emerald-200' }
  if (gap <= 25) return { label: 'Watch', Icon: MinusCircle, className: 'text-gold-light' }
  return { label: 'Gap', Icon: AlertTriangle, className: 'text-amber-200' }
}

export default function AssessmentScoreBreakdown({
  scores,
  dreamScores,
}: AssessmentScoreBreakdownProps) {
  const entries = CATEGORY_ORDER
    .map((category) => {
      const score = Number(scores[category] || 0)
      const target = Number(dreamScores?.[category] ?? TARGET_SCORE)
      return {
        category,
        score,
        target,
        gap: Math.max(target - score, 0),
      }
    })
    .sort((a, b) => b.gap - a.gap)

  return (
    <div className="rounded-lg border border-radiant-gold/15 bg-imperial-navy/35 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-radiant-gold/80">
            Score breakdown
          </h3>
          <p className="mt-1 text-xs text-platinum-white/52">
            Category detail behind the radar chart.
          </p>
        </div>
        <div className="text-right text-[10px] uppercase tracking-[0.14em] text-platinum-white/42">
          Target {TARGET_SCORE}
        </div>
      </div>
      <div className="space-y-3">
        {entries.map(({ category, score, target, gap }) => {
          const status = getStatus(score, target)
          const pct = Math.max(0, Math.min(100, score))
          const StatusIcon = status.Icon

          return (
            <div key={category} className="rounded-lg border border-radiant-gold/10 bg-silicon-slate/25 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-platinum-white/86">
                    {SHORT_LABELS[category]}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-platinum-white/58">
                    {CATEGORY_EXPLANATIONS[category]}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold text-platinum-white">{score}</p>
                  <div className={`mt-0.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] ${status.className}`}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </div>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-imperial-navy/70">
                <div
                  className="h-full rounded-full bg-radiant-gold/80"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-platinum-white/40">
                {gap > 0 ? `${gap} points below target` : 'At target'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
