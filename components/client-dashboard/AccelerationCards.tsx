'use client'

import { useState } from 'react'
import {
  Zap,
  TrendingUp,
  X,
  ArrowRight,
  Shield,
  BarChart,
  Info,
} from 'lucide-react'
import type { AccelerationRecommendation } from '@/lib/acceleration-engine'

interface AccelerationCardsProps {
  recommendations: AccelerationRecommendation[]
  token: string
  onDismiss: (recId: string) => void
}

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-emerald-500/15', text: 'text-emerald-200', label: 'High Confidence' },
  medium: { bg: 'bg-radiant-gold/15', text: 'text-gold-light', label: 'Moderate Confidence' },
  low: { bg: 'bg-platinum-white/10', text: 'text-platinum-white/65', label: 'Estimated' },
}

const DATA_SOURCE_LABELS: Record<string, string> = {
  client_specific: 'Based on your assessment data',
  industry_benchmark: 'Based on industry benchmarks',
  blended: 'Based on your data + industry benchmarks',
}

const CTA_LABELS: Record<string, string> = {
  learn_more: 'Learn More',
  book_call: 'Book a Call',
  view_proposal: 'View Proposal',
  start_trial: 'Start Trial',
}

const CONFIDENCE_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function getCtaLabel(rec: AccelerationRecommendation): string {
  if (rec.content_type === 'contract_option') return 'View Account'
  return CTA_LABELS[rec.cta_type] || 'Learn More'
}

function getGoalFit(rec: AccelerationRecommendation): string {
  if (rec.content_type === 'contract_option') {
    return 'Best if the priority is continuing the current work without opening a separate package decision.'
  }

  const category = rec.gap_category.replace(/_/g, ' ').toLowerCase()
  if (category.includes('tech')) {
    return 'Best if the priority is making the FireSpring launch path cleaner and easier to hand off.'
  }
  if (category.includes('automation')) {
    return 'Best if the priority is reducing manual routing across supporter, donor, sponsor, and program workflows.'
  }
  if (category.includes('budget')) {
    return 'Best if the priority is protecting scope, budget, and decision timing before more work begins.'
  }
  if (category.includes('ai')) {
    return 'Best if the priority is turning project knowledge into reusable operating assets after launch decisions settle.'
  }
  return 'Best if the priority is closing the highest visible gap from the current assessment pattern.'
}

function confidenceReason(rec: AccelerationRecommendation): string {
  const confidence = CONFIDENCE_STYLES[rec.confidence_level] || CONFIDENCE_STYLES.low
  const source = DATA_SOURCE_LABELS[rec.data_source] || 'Estimated'
  return `${confidence.label}; ${source.toLowerCase()}.`
}

function sortedRecommendations(recommendations: AccelerationRecommendation[]) {
  return [...recommendations].sort((a, b) => {
    const confidenceDelta =
      (CONFIDENCE_RANK[a.confidence_level] ?? CONFIDENCE_RANK.low) -
      (CONFIDENCE_RANK[b.confidence_level] ?? CONFIDENCE_RANK.low)
    if (confidenceDelta !== 0) return confidenceDelta
    const impactDelta = Number(b.projected_impact_pct || 0) - Number(a.projected_impact_pct || 0)
    if (impactDelta !== 0) return impactDelta
    return a.display_order - b.display_order
  })
}

export default function AccelerationCards({
  recommendations,
  token,
  onDismiss,
}: AccelerationCardsProps) {
  const [dismissing, setDismissing] = useState<string | null>(null)

  if (recommendations.length === 0) {
    return null
  }

  const handleDismiss = async (recId: string) => {
    setDismissing(recId)
    try {
      const res = await fetch(`/api/client/dashboard/${token}/accelerators/${recId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      })
      if (res.ok) {
        onDismiss(recId)
      }
    } catch {
      // Silent fail
    } finally {
      setDismissing(null)
    }
  }

  const handleConvert = async (recId: string) => {
    try {
      const res = await fetch(`/api/client/dashboard/${token}/accelerators/${recId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'convert' }),
      })
      const data = await res.json()
      if (data.ctaUrl) {
        if (typeof data.ctaUrl === 'string' && data.ctaUrl.startsWith('#')) {
          window.location.hash = data.ctaUrl
        } else {
          window.open(data.ctaUrl, '_blank')
        }
      }
    } catch {
      // Silent fail
    }
  }

  const orderedRecommendations = sortedRecommendations(recommendations)
  const recommended = orderedRecommendations[0]
  const alternatives = orderedRecommendations.slice(1)

  const renderRecommendation = (rec: AccelerationRecommendation, featured = false) => {
    const confidence = CONFIDENCE_STYLES[rec.confidence_level] || CONFIDENCE_STYLES.low
    const isDismissing = dismissing === rec.id
    const projectedAnnualValue = Number(rec.projected_annual_value || 0)
    const projectedImpactPct = Number(rec.projected_impact_pct || 0)
    const isContractOption = rec.content_type === 'contract_option'

    return (
      <div
        key={rec.id}
        className={`rounded-xl border p-4 transition-opacity ${
          featured
            ? 'border-radiant-gold/35 bg-radiant-gold/10'
            : 'border-radiant-gold/15 bg-imperial-navy/45'
        } ${isDismissing ? 'opacity-50' : ''}`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-radiant-gold/20 bg-radiant-gold/10">
                  <TrendingUp className="h-4 w-4 text-radiant-gold" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-platinum-white/90">{rec.service_title}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-platinum-white/42">
                    {rec.gap_category.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(rec.id)}
                disabled={isDismissing}
                className="shrink-0 p-1 text-platinum-white/35 hover:text-platinum-white/70"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {rec.impact_headline && (
              <p className="mb-3 text-xs leading-relaxed text-platinum-white/72">
                {rec.impact_headline}
              </p>
            )}

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/45 p-2.5">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-radiant-gold/75">
                  Why this fits
                </p>
                <p className="text-xs leading-5 text-platinum-white/68">{getGoalFit(rec)}</p>
              </div>
              <div className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/45 p-2.5">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-radiant-gold/75">
                  Confidence basis
                </p>
                <p className="text-xs leading-5 text-platinum-white/68">{confidenceReason(rec)}</p>
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 space-y-3 lg:w-64">
            {projectedAnnualValue > 0 && (
              <div className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/55 p-2.5">
                <div className="flex items-center gap-2">
                  <BarChart className="h-4 w-4 text-gold-light" />
                  <span className="text-lg font-bold text-gold-light">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0,
                    }).format(projectedAnnualValue)}
                    <span className="text-xs font-normal text-platinum-white/42">
                      {' '}{isContractOption ? 'contract' : 'package'}
                    </span>
                  </span>
                </div>
                {projectedImpactPct > 0 && (
                  <p className="mt-0.5 text-[10px] text-platinum-white/45">
                    +{projectedImpactPct}% improvement
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${confidence.bg} ${confidence.text}`}>
                <Shield className="mr-0.5 inline h-2.5 w-2.5" />
                {confidence.label}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-platinum-white/42">
                <Info className="h-3 w-3 text-platinum-white/35" />
                {DATA_SOURCE_LABELS[rec.data_source] || 'Estimated'}
              </span>
            </div>

            <button
              onClick={() => handleConvert(rec.id)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-radiant-gold/25 bg-radiant-gold/12 px-3 py-2 text-sm font-medium text-gold-light transition-colors hover:bg-radiant-gold/20"
            >
              {getCtaLabel(rec)}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-radiant-gold" />
        <h3 className="text-sm font-medium text-radiant-gold uppercase tracking-wider">
          Package Options
        </h3>
      </div>
      <p className="text-xs text-platinum-white/55 mb-4">
        Tailored acceleration paths that connect the assessment gaps, task list, and available AmaduTown packages.
      </p>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-radiant-gold/80">
            Recommended next phase
          </p>
          {renderRecommendation(recommended, true)}
        </div>

        {alternatives.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-platinum-white/45">
              Other paths, ranked by confidence
            </p>
            <div className="space-y-3">
              {alternatives.map((rec) => renderRecommendation(rec))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
