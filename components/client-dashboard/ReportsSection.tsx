'use client'

import { useState } from 'react'
import { BarChart3, Presentation, ChevronDown, ChevronUp, DollarSign, ExternalLink } from 'lucide-react'
import type { ClientValueReport, ClientGammaReport } from '@/lib/client-dashboard'

interface ReportsSectionProps {
  valueReports: ClientValueReport[]
  gammaReports: ClientGammaReport[]
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  client_facing: 'Value Assessment',
  internal_audit: 'Internal Audit',
  value_quantification: 'Value Quantification',
  implementation_strategy: 'Implementation Strategy',
  audit_summary: 'Audit Summary',
  prospect_overview: 'Prospect Overview',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ReportsSection({ valueReports, gammaReports }: ReportsSectionProps) {
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)

  if (valueReports.length === 0 && gammaReports.length === 0) return null

  return (
    <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
      <h3 className="text-sm font-medium text-radiant-gold uppercase tracking-wider mb-4">
        Your Reports
      </h3>

      <div className="space-y-3">
        {/* Value Reports */}
        {valueReports.map((report) => {
          const isExpanded = expandedReportId === report.id
          const totalValue = typeof report.total_annual_value === 'number'
            ? report.total_annual_value
            : parseFloat(String(report.total_annual_value))

          return (
            <div
              key={report.id}
              className="rounded-lg bg-imperial-navy/45 border border-radiant-gold/10 overflow-hidden"
            >
              <button
                onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-radiant-gold/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-radiant-gold/10 border border-radiant-gold/20">
                    <BarChart3 className="w-4 h-4 text-radiant-gold" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-platinum-white truncate">
                      {report.title}
                    </p>
                    <p className="text-xs text-platinum-white/45">
                      {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
                      {' \u00B7 '}
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {totalValue > 0 && (
                    <span className="text-sm font-semibold text-gold-light">
                      {formatCurrency(totalValue)}/yr
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-radiant-gold/60" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-radiant-gold/60" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Value statements */}
                  {Array.isArray(report.value_statements) && report.value_statements.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-platinum-white/50 uppercase tracking-wider px-1">
                        Opportunity Areas
                      </p>
                      {(report.value_statements as Array<{ painPoint?: string; pain_point?: string; annualValue?: number; annual_value?: number }>).map((vs, i) => {
                        const name = vs.painPoint || vs.pain_point || 'Unknown'
                        const value = vs.annualValue || vs.annual_value || 0
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-2 bg-silicon-slate/45 rounded-lg"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <DollarSign className="w-3.5 h-3.5 text-radiant-gold/70 flex-shrink-0" />
                              <span className="text-sm text-platinum-white/75 truncate">{name}</span>
                            </div>
                            {value > 0 && (
                              <span className="text-xs font-medium text-gold-light flex-shrink-0">
                                {formatCurrency(value)}/yr
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {totalValue > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-radiant-gold/10 rounded-lg border border-radiant-gold/25">
                      <span className="text-sm font-medium text-platinum-white/75">Total Annual Impact</span>
                      <span className="text-sm font-bold text-gold-light">
                        {formatCurrency(totalValue)}/yr
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Gamma Decks */}
        {gammaReports.map((gamma) => {
          const isReady = gamma.status === 'completed' && gamma.gamma_url
          const isGenerating = gamma.status === 'generating' || (gamma.status === 'completed' && !gamma.gamma_url)
          const isFailed = gamma.status === 'failed'
          return (
            <div
              key={gamma.id}
              className="flex items-center justify-between p-3 rounded-lg bg-imperial-navy/45 border border-radiant-gold/10 gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-radiant-gold/10 border border-radiant-gold/20">
                  <Presentation className="w-4 h-4 text-radiant-gold" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-platinum-white truncate">
                    {gamma.title || 'Presentation Deck'}
                  </p>
                  <p className="text-xs text-platinum-white/45">
                    {REPORT_TYPE_LABELS[gamma.report_type] || 'Presentation'}
                    {' \u00B7 '}
                    {formatDate(gamma.created_at)}
                  </p>
                  {isGenerating && (
                    <p className="text-xs text-gold-light mt-1">
                      Your deck is being prepared. Check back shortly.
                    </p>
                  )}
                  {isFailed && (
                    <p className="text-xs text-platinum-white/60 mt-1">
                      We couldn&apos;t finish this deck automatically. Your consultant can share an updated link.
                    </p>
                  )}
                </div>
              </div>
              {isReady ? (
                <a
                  href={gamma.gamma_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-imperial-navy bg-radiant-gold hover:bg-gold-light rounded-lg transition-colors shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Deck
                </a>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
