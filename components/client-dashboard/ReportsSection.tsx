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
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
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
              className="rounded-lg bg-gray-800/50 border border-gray-700/50 overflow-hidden"
            >
              <button
                onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-800/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {report.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
                      {' \u00B7 '}
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {totalValue > 0 && (
                    <span className="text-sm font-semibold text-emerald-400">
                      {formatCurrency(totalValue)}/yr
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Value statements */}
                  {Array.isArray(report.value_statements) && report.value_statements.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-1">
                        Opportunity Areas
                      </p>
                      {(report.value_statements as Array<{ painPoint?: string; pain_point?: string; annualValue?: number; annual_value?: number }>).map((vs, i) => {
                        const name = vs.painPoint || vs.pain_point || 'Unknown'
                        const value = vs.annualValue || vs.annual_value || 0
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-2 bg-gray-900/50 rounded-lg"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-400/60 flex-shrink-0" />
                              <span className="text-sm text-gray-300 truncate">{name}</span>
                            </div>
                            {value > 0 && (
                              <span className="text-xs font-medium text-emerald-400/80 flex-shrink-0">
                                {formatCurrency(value)}/yr
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {totalValue > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                      <span className="text-sm font-medium text-gray-300">Total Annual Impact</span>
                      <span className="text-sm font-bold text-emerald-400">
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
        {gammaReports.map((gamma) => (
          <div
            key={gamma.id}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Presentation className="w-4 h-4 text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">
                  {gamma.title || 'Presentation Deck'}
                </p>
                <p className="text-xs text-gray-500">
                  {REPORT_TYPE_LABELS[gamma.report_type] || 'Presentation'}
                  {' \u00B7 '}
                  {formatDate(gamma.created_at)}
                </p>
              </div>
            </div>
            {gamma.gamma_url && (
              <a
                href={gamma.gamma_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Deck
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
