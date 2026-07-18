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
        window.open(data.ctaUrl, '_blank')
      }
    } catch {
      // Silent fail
    }
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

      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {recommendations.map((rec) => {
          const confidence = CONFIDENCE_STYLES[rec.confidence_level] || CONFIDENCE_STYLES.low
          const isDismissing = dismissing === rec.id
          const projectedAnnualValue = Number(rec.projected_annual_value || 0)
          const projectedImpactPct = Number(rec.projected_impact_pct || 0)

          return (
            <div
              key={rec.id}
              className={`flex-shrink-0 w-[280px] md:w-[320px] rounded-xl border border-radiant-gold/15 bg-imperial-navy/45 p-4 snap-start transition-opacity ${
                isDismissing ? 'opacity-50' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-radiant-gold/10 border border-radiant-gold/20 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-radiant-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-platinum-white/90">{rec.service_title}</p>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-platinum-white/42">
                      {rec.gap_category.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDismiss(rec.id)}
                  disabled={isDismissing}
                  className="text-platinum-white/35 hover:text-platinum-white/70 p-1"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Impact Headline */}
              {rec.impact_headline && (
                <p className="text-xs text-platinum-white/72 mb-3 leading-relaxed">
                  {rec.impact_headline}
                </p>
              )}

              {/* Projected Value */}
              {projectedAnnualValue > 0 && (
                <div className="bg-imperial-navy/55 rounded-lg border border-radiant-gold/10 p-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-gold-light" />
                    <span className="text-lg font-bold text-gold-light">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0,
                      }).format(projectedAnnualValue)}
                      <span className="text-xs font-normal text-platinum-white/42"> package</span>
                    </span>
                  </div>
                  {projectedImpactPct > 0 && (
                    <p className="text-[10px] text-platinum-white/45 mt-0.5">
                      +{projectedImpactPct}% improvement
                    </p>
                  )}
                </div>
              )}

              {/* Confidence + Data Source */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${confidence.bg} ${confidence.text}`}>
                  <Shield className="w-2.5 h-2.5 inline mr-0.5" />
                  {confidence.label}
                </span>
              </div>
              <div className="flex items-center gap-1 mb-4">
                <Info className="w-3 h-3 text-platinum-white/35" />
                <span className="text-[10px] text-platinum-white/42">
                  {DATA_SOURCE_LABELS[rec.data_source] || 'Estimated'}
                </span>
              </div>

              {/* CTA */}
              <button
                onClick={() => handleConvert(rec.id)}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/25 bg-radiant-gold/12 px-3 py-2 text-sm font-medium text-gold-light transition-colors hover:bg-radiant-gold/20"
              >
                {CTA_LABELS[rec.cta_type] || 'Learn More'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
