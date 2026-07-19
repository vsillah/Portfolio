'use client'

import { AlertTriangle, CheckCircle2, ExternalLink, MinusCircle } from 'lucide-react'
import type { AssessmentCategory, CategoryScores } from '@/lib/assessment-scoring'

interface AssessmentScoreBreakdownProps {
  scores: CategoryScores
  dreamScores?: Partial<CategoryScores>
  hasFormalAssessment?: boolean
  formalAssessmentHref?: string
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

const CATEGORY_BASIS: Record<AssessmentCategory, string> = {
  business_challenges:
    'Based on migration goals, client correspondence, and the website-template decision context.',
  tech_stack:
    'Based on FireSpring Balance constraints, proof-site feedback, and template-comparison artifacts.',
  automation_needs:
    'Based on support, donor, sponsor, shop, and program-routing follow-up captured in project evidence.',
  ai_readiness:
    'Based on whether launch decisions, knowledge capture, and reusable source records are stable enough for automation.',
  budget_timeline:
    'Based on paid contract value, logged delivery time, remaining capacity, and vendor-decision timing.',
  decision_making:
    'Based on board/logo follow-up, vendor navigation answers, and open launch-readiness decisions.',
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
  hasFormalAssessment = false,
  formalAssessmentHref = '/tools/audit',
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
            {hasFormalAssessment
              ? 'Category detail behind the completed assessment.'
              : 'Projected category detail from project evidence. Complete the formal assessment to replace estimates.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="text-right text-[10px] uppercase tracking-[0.14em] text-platinum-white/42">
            Target {TARGET_SCORE}
          </div>
          {!hasFormalAssessment && (
            <a
              href={formalAssessmentHref}
              className="inline-flex items-center gap-1 rounded-md border border-radiant-gold/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-radiant-gold transition hover:border-radiant-gold/45 hover:bg-radiant-gold/10"
            >
              Formal audit
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
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
                  <p className="mt-2 text-[11px] leading-5 text-platinum-white/45">
                    <span className="font-semibold uppercase tracking-[0.12em] text-radiant-gold/70">
                      Basis:
                    </span>{' '}
                    {CATEGORY_BASIS[category]}
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
