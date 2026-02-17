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
  high: { bg: 'bg-green-900/40', text: 'text-green-300', label: 'High Confidence' },
  medium: { bg: 'bg-yellow-900/40', text: 'text-yellow-300', label: 'Moderate Confidence' },
  low: { bg: 'bg-gray-800', text: 'text-gray-400', label: 'Estimated' },
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
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Acceleration Opportunities
        </h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Tailored recommendations to help you achieve your goals faster, backed by data.
      </p>

      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {recommendations.map((rec) => {
          const confidence = CONFIDENCE_STYLES[rec.confidence_level] || CONFIDENCE_STYLES.low
          const isDismissing = dismissing === rec.id

          return (
            <div
              key={rec.id}
              className={`flex-shrink-0 w-[280px] md:w-[320px] bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 snap-start transition-opacity ${
                isDismissing ? 'opacity-50' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600/30 to-indigo-600/30 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-200">{rec.service_title}</p>
                    <p className="text-[10px] text-gray-500">
                      {rec.gap_category.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDismiss(rec.id)}
                  disabled={isDismissing}
                  className="text-gray-600 hover:text-gray-400 p-1"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Impact Headline */}
              {rec.impact_headline && (
                <p className="text-xs text-gray-300 mb-3 leading-relaxed">
                  {rec.impact_headline}
                </p>
              )}

              {/* Projected Value */}
              {rec.projected_annual_value && rec.projected_annual_value > 0 && (
                <div className="bg-gray-900/60 rounded-lg p-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-emerald-400" />
                    <span className="text-lg font-bold text-emerald-400">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0,
                      }).format(rec.projected_annual_value)}
                      <span className="text-xs font-normal text-gray-500">/year</span>
                    </span>
                  </div>
                  {rec.projected_impact_pct && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      +{rec.projected_impact_pct}% improvement
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
                <Info className="w-3 h-3 text-gray-600" />
                <span className="text-[10px] text-gray-600">
                  {DATA_SOURCE_LABELS[rec.data_source] || 'Estimated'}
                </span>
              </div>

              {/* CTA */}
              <button
                onClick={() => handleConvert(rec.id)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {CTA_LABELS[rec.cta_type] || 'Learn More'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
